import * as THREE from 'three';
import { PALETTE as C } from '../config/palette';
import type { WeaponDef } from '../config/structures';
import { angleDelta, rand, rotateTowards, yawTo } from '../core/math';
import type { World } from '../core/World';
import type { Enemy } from '../entities/Enemy';
import type { Structure } from '../entities/Structure';
import { matchesLayer } from './EnemyManager';

const muzzle = new THREE.Vector3();
const aim = new THREE.Vector3();
const dir = new THREE.Vector3();
const chainBuffer: Enemy[] = [];

function targetValid(s: Structure, w: WeaponDef): boolean {
  const t = s.target;
  if (!t || !t.alive || !matchesLayer(t, w.targets)) return false;
  const d = Math.hypot(t.position.x - s.position.x, t.position.z - s.position.z) - t.def.radius;
  return d <= w.range && d >= (w.minRange ?? 0);
}

/** Target acquisition, turning and firing for a single turret. */
export function updateTurret(s: Structure, dt: number, world: World): void {
  const w = s.def.weapon;
  if (!w) return;

  s.cooldown -= dt;
  s.retargetTimer -= dt;
  if (s.retargetTimer <= 0 || !targetValid(s, w)) {
    s.target = world.enemies.nearest(s.position.x, s.position.z, w.range, w.targets, w.minRange);
    s.retargetTimer = 0.3;
  }

  const target = s.target;
  if (!target) {
    s.yaw += dt * 0.3; // idle scan
    return;
  }

  const desired = yawTo(s.position.x, s.position.z, target.position.x, target.position.z);
  s.yaw = rotateTowards(s.yaw, desired, w.turnSpeed * dt);
  const aligned = w.style === 'arc' || Math.abs(angleDelta(s.yaw, desired)) < 0.12;
  if (!aligned || s.cooldown > 0) return;

  s.cooldown = w.interval;
  s.recoil = 1;
  const pan = world.pan(s.position.x);
  switch (w.style) {
    case 'gatling':
      fireGatling(s, target, w, world);
      world.sfx.gatling(pan);
      break;
    case 'flak':
      fireFlak(s, target, w, world);
      world.sfx.flak(pan);
      break;
    case 'mortar':
      fireMortar(s, target, w, world);
      world.sfx.mortar(pan);
      break;
    case 'arc':
      fireArc(s, target, w, world);
      world.sfx.zap(pan);
      break;
  }
}

function fireGatling(s: Structure, target: Enemy, w: WeaponDef, world: World): void {
  s.spinSpeed = 28;
  s.nextMuzzle(muzzle);
  target.aimPoint(aim);
  dir.subVectors(aim, muzzle).normalize();
  dir.x += rand(-0.04, 0.04);
  dir.z += rand(-0.04, 0.04);
  dir.normalize();
  world.projectiles.fireBullet({
    from: muzzle, dir, speed: w.projectileSpeed ?? 60, range: w.range + 2,
    damage: w.damage, splash: 0, layer: w.targets, color: C.flak, size: 0.1, length: 1.1,
  });
  world.effects.muzzleFlash(muzzle, dir, C.flak, 0.45);
}

function fireFlak(s: Structure, target: Enemy, w: WeaponDef, world: World): void {
  s.nextMuzzle(muzzle);
  const speed = w.projectileSpeed ?? 45;
  const d = muzzle.distanceTo(target.position);
  // Lead the target so shells meet fast flyers.
  target.aimPoint(aim).addScaledVector(target.velocity, d / speed);
  world.projectiles.fireFlak(muzzle, aim, w.damage, w.splash ?? 2.5, speed);
  dir.subVectors(aim, muzzle).normalize();
  world.effects.muzzleFlash(muzzle, dir, C.flak, 0.8);
}

function fireMortar(s: Structure, target: Enemy, w: WeaponDef, world: World): void {
  s.nextMuzzle(muzzle);
  const flight = THREE.MathUtils.clamp(muzzle.distanceTo(target.position) / (w.projectileSpeed ?? 20), 0.9, 2.2);
  aim.copy(target.position).addScaledVector(target.velocity, flight).setY(0);
  world.projectiles.fireShell(muzzle, aim, flight, w.damage, w.splash ?? 3.5);
  world.effects.muzzleFlash(muzzle, dir.set(0, 1, 0), C.fireMid, 1.4);
  for (let i = 0; i < 3; i++) world.effects.smokeTrail(muzzle, 2);
  world.effects.shake(0.04);
}

function fireArc(s: Structure, first: Enemy, w: WeaponDef, world: World): void {
  const { enemies, effects } = world;
  s.nextMuzzle(muzzle);
  const hit = new Set<Enemy>();
  let from = muzzle.clone();
  let current: Enemy | null = first;
  let damage = w.damage;
  const jumps = 1 + (w.chains ?? 0);

  for (let i = 0; i < jumps && current; i++) {
    hit.add(current);
    const to = current.aimPoint(new THREE.Vector3());
    effects.lightning(from, to, C.arc, i === 0 ? 1.4 : 1);
    enemies.damage(current, damage);
    current.stun = Math.max(current.stun, 0.15);
    damage *= 0.8;
    from = to;

    // Jump to the closest enemy not yet struck.
    enemies.neighbors(to.x, to.z, 6, chainBuffer);
    let next: Enemy | null = null;
    let best = 6;
    for (const e of chainBuffer) {
      if (!e.alive || hit.has(e)) continue;
      const d = Math.hypot(e.position.x - to.x, e.position.z - to.z);
      if (d < best) {
        best = d;
        next = e;
      }
    }
    current = next;
  }
}
