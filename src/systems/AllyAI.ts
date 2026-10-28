import * as THREE from 'three';
import { PALETTE as C } from '../config/palette';
import { SQUAD_LEASH } from '../config/squads';
import { angleDelta, damp, rand, rotateTowards } from '../core/math';
import type { World } from '../core/World';
import type { Ally } from '../entities/Ally';
import type { Enemy } from '../entities/Enemy';
import { matchesLayer } from './EnemyManager';

const slot = new THREE.Vector3();
const muzzle = new THREE.Vector3();
const aim = new THREE.Vector3();
const dir = new THREE.Vector3();
/** Kestrels circle their post at this radius and fire homing missiles from the circuit. */
const ORBIT_RADIUS = 8;

function distXZ(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

/** Enemies a squad member may engage: in weapon reach and not too far from its post. */
function inReach(a: Ally, e: Enemy): boolean {
  const w = a.unit.weapon;
  if (!e.alive || !matchesLayer(e, w.targets)) return false;
  const post = a.squad.post;
  return distXZ(e.position.x, e.position.z, post.x, post.z) - e.def.radius <= SQUAD_LEASH + w.range
    && distXZ(e.position.x, e.position.z, a.position.x, a.position.z) - e.def.radius <= w.range + 8;
}

/**
 * Squad member behaviour: hold a formation slot at the squad's post, engage enemies that come
 * within reach, chase a little but never stray past the leash, and fire when lined up.
 */
export function updateAlly(a: Ally, dt: number, world: World): void {
  const { level, enemies } = world;
  const unit = a.unit;
  const w = unit.weapon;
  a.cooldown -= dt;
  a.retargetTimer -= dt;
  if (a.retargetTimer <= 0 || (a.target && !inReach(a, a.target))) {
    const found = enemies.nearest(a.position.x, a.position.z, w.range + 8, w.targets);
    a.target = found && inReach(a, found) ? found : null;
    a.retargetTimer = rand(0.25, 0.45);
  }
  const t = a.target;
  const post = a.squad.post;

  // Where to go this frame.
  let gx: number;
  let gz: number;
  if (unit.flying) {
    // Circling the post rather than the target keeps them out of the swarm's guns.
    a.orbit += (dt * unit.speed * 0.6) / ORBIT_RADIUS;
    gx = post.x + Math.cos(a.orbit + a.slot * 2.1) * ORBIT_RADIUS;
    gz = post.z + Math.sin(a.orbit + a.slot * 2.1) * ORBIT_RADIUS;
  } else {
    a.squad.slotPosition(a.slot, slot);
    gx = slot.x;
    gz = slot.z;
    if (t) {
      const d = distXZ(t.position.x, t.position.z, a.position.x, a.position.z) - t.def.radius;
      const leashed = distXZ(a.position.x, a.position.z, post.x, post.z) > SQUAD_LEASH;
      if (d > w.range * 0.85 && !leashed) {
        gx = t.position.x;
        gz = t.position.z;
      } else if (d <= w.range) {
        // In range: stand and shoot.
        gx = a.position.x;
        gz = a.position.z;
      }
    }
  }

  let mx = gx - a.position.x;
  let mz = gz - a.position.z;
  const dist = Math.hypot(mx, mz);
  a.moving = dist > 0.4;
  if (a.moving) {
    mx /= dist;
    mz /= dist;
    // Keep squadmates from stacking.
    for (const other of a.squad.members) {
      if (other === a || !other.alive) continue;
      const ox = a.position.x - other.position.x;
      const oz = a.position.z - other.position.z;
      const d = Math.hypot(ox, oz);
      const min = a.radius + other.radius + 0.4;
      if (d > 0.001 && d < min) {
        mx += (ox / d) * (min - d) * 1.5;
        mz += (oz / d) * (min - d) * 1.5;
      }
    }
    const len = Math.hypot(mx, mz) || 1;
    const speed = unit.flying ? unit.speed : unit.speed * Math.min(1, dist / 1.5 + 0.3);
    a.velocity.set((mx / len) * speed, 0, (mz / len) * speed);
    const ox = a.position.x;
    const oz = a.position.z;
    a.position.x += a.velocity.x * dt;
    a.position.z += a.velocity.z * dt;
    if (!unit.flying && !level.walkable(a.position.x, a.position.z)) {
      if (level.walkable(a.position.x, oz)) a.position.z = oz;
      else if (level.walkable(ox, a.position.z)) a.position.x = ox;
      else {
        a.position.x = ox;
        a.position.z = oz;
      }
    }
    a.yaw = rotateTowards(a.yaw, Math.atan2(a.velocity.x, a.velocity.z), unit.turnSpeed * dt);
  } else {
    a.velocity.set(0, 0, 0);
  }

  a.groundY = unit.flying
    ? damp(a.groundY, level.floorAt(a.position.x, a.position.z), 2.5, dt)
    : level.heightAt(a.position.x, a.position.z);

  if (!t) {
    a.aimYaw = a.rig.head ? rotateTowards(a.aimYaw, a.yaw, unit.turnSpeed * dt) : a.yaw;
    if (!a.moving && !unit.flying) a.yaw = rotateTowards(a.yaw, a.squad.facing, unit.turnSpeed * 0.5 * dt);
    return;
  }

  const desired = Math.atan2(t.position.x - a.position.x, t.position.z - a.position.z);
  if (a.rig.head) {
    a.aimYaw = rotateTowards(a.aimYaw, desired, unit.turnSpeed * 1.5 * dt);
  } else {
    if (!a.moving && !unit.flying) a.yaw = rotateTowards(a.yaw, desired, unit.turnSpeed * dt);
    a.aimYaw = a.yaw;
  }
  const d = distXZ(t.position.x, t.position.z, a.position.x, a.position.z) - t.def.radius;
  // Missiles home in, so flyers fire from any heading.
  const aligned = w.style === 'missiles' || Math.abs(angleDelta(a.aimYaw, desired)) < 0.3;
  if (d > w.range || !aligned || a.cooldown > 0) return;
  a.cooldown = w.interval * rand(0.9, 1.1);
  fire(a, t, world);
}

function fire(a: Ally, t: Enemy, world: World): void {
  const { projectiles, effects, sfx, enemies } = world;
  const w = a.unit.weapon;
  const pan = world.pan(a.position.x);
  switch (w.style) {
    case 'blaster': {
      a.nextMuzzle(muzzle);
      dir.subVectors(t.aimPoint(aim), muzzle).normalize();
      dir.x += rand(-0.03, 0.03);
      dir.z += rand(-0.03, 0.03);
      dir.normalize();
      projectiles.fireBullet({
        from: muzzle, dir, speed: w.projectileSpeed ?? 70, range: w.range + 2,
        damage: w.damage, splash: 0, layer: w.targets, color: C.playerGlow, size: 0.1, length: 1,
      });
      effects.muzzleFlash(muzzle, dir, C.playerGlow, 0.35);
      sfx.gatling(pan);
      break;
    }
    case 'rail': {
      a.nextMuzzle(muzzle);
      t.aimPoint(aim);
      effects.railBeam(muzzle, aim, C.playerGlow);
      enemies.push(t, a.position.x, a.position.z, 6);
      enemies.damage(t, w.damage);
      sfx.rail(pan);
      break;
    }
    case 'cannon': {
      a.nextMuzzle(muzzle);
      dir.subVectors(t.aimPoint(aim), muzzle).normalize();
      projectiles.fireBullet({
        from: muzzle, dir, speed: w.projectileSpeed ?? 55, range: w.range + 2,
        damage: w.damage, splash: w.splash ?? 0, layer: w.targets, color: C.playerAccent, size: 0.3, length: 1.4,
      });
      effects.muzzleFlash(muzzle, dir, C.playerAccent, 1);
      effects.shake(0.03);
      sfx.cannon(pan);
      break;
    }
    case 'missiles': {
      for (let i = 0; i < 2; i++) {
        a.nextMuzzle(muzzle);
        const launch = new THREE.Vector3(Math.sin(a.yaw), 0.2, Math.cos(a.yaw)).normalize();
        projectiles.fireMissile(muzzle, t, w.damage, w.splash ?? 2, launch);
        effects.smokeTrail(muzzle, 1.2);
      }
      sfx.missile(pan);
      break;
    }
  }
}
