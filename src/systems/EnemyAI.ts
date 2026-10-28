import * as THREE from 'three';
import { PALETTE as C } from '../config/palette';
import { rand, rotateTowards, TAU } from '../core/math';
import type { World } from '../core/World';
import type { Damageable } from '../entities/Damageable';
import type { Enemy } from '../entities/Enemy';

const neighbors: Enemy[] = [];
const muzzle = new THREE.Vector3();
const aim = new THREE.Vector3();

/**
 * Enemy behaviour: pick a target (nearby structure, else the core), walk toward it with
 * crowd separation, get blocked by walls, and attack once in range.
 */
export function updateEnemyAI(e: Enemy, dt: number, world: World): void {
  const def = e.def;

  if (e.knockback.lengthSq() > 0.01) {
    e.position.x += e.knockback.x * dt;
    e.position.z += e.knockback.z * dt;
    e.knockback.multiplyScalar(Math.exp(-5 * dt));
  }

  if (def.spawner) updateSpawner(e, dt, world);

  if (e.stun > 0) {
    e.stun -= dt;
    e.moving = false;
    e.velocity.set(0, 0, 0);
    return;
  }

  e.retargetTimer -= dt;
  if (e.retargetTimer <= 0 || !e.target || !e.target.alive) {
    e.target = chooseTarget(e, world);
    e.retargetTimer = rand(0.4, 0.8);
  }
  const target = e.target ?? world.core;

  const dx = target.position.x - e.position.x;
  const dz = target.position.z - e.position.z;
  const dist = Math.hypot(dx, dz) || 1;
  const gap = dist - target.radius - def.radius;

  if (gap <= def.attack.range) {
    e.moving = false;
    e.yaw = rotateTowards(e.yaw, Math.atan2(dx, dz), 6 * dt);
    if (def.flying) {
      // Flyers strafe sideways around their target instead of hovering still.
      const side = e.id % 2 === 0 ? 1 : -1;
      e.velocity.set((-dz / dist) * side * def.speed * 0.35, 0, (dx / dist) * side * def.speed * 0.35);
      e.position.x += e.velocity.x * dt;
      e.position.z += e.velocity.z * dt;
    } else {
      e.velocity.set(0, 0, 0);
    }
    e.attackTimer -= dt;
    if (e.attackTimer <= 0) {
      e.attackTimer = def.attack.interval * rand(0.9, 1.1);
      attack(e, target, world);
    }
  } else {
    let mx = dx / dist;
    let mz = dz / dist;

    // Separation from nearby units of the same layer keeps swarms from stacking.
    world.enemies.neighbors(e.position.x, e.position.z, def.radius * 3, neighbors);
    for (const n of neighbors) {
      if (n === e || n.flying !== e.flying) continue;
      const ox = e.position.x - n.position.x;
      const oz = e.position.z - n.position.z;
      const d = Math.hypot(ox, oz);
      const min = def.radius + n.def.radius + 0.3;
      if (d > 0.001 && d < min) {
        const push = (min - d) / min;
        mx += (ox / d) * push * 1.6;
        mz += (oz / d) * push * 1.6;
      }
    }
    const len = Math.hypot(mx, mz) || 1;
    e.velocity.set((mx / len) * def.speed, 0, (mz / len) * def.speed);
    e.position.x += e.velocity.x * dt;
    e.position.z += e.velocity.z * dt;
    e.yaw = rotateTowards(e.yaw, Math.atan2(e.velocity.x, e.velocity.z), 5 * dt);
    e.moving = true;
    e.attackTimer = Math.min(e.attackTimer, def.attack.interval * 0.4);
  }

  if (!def.flying) {
    // Walls and turrets physically block ground units, which then attack whatever stopped them.
    const blocker = world.structures.resolveCollision(e);
    if (blocker && e.target !== blocker && def.attack.style === 'melee') {
      e.target = blocker;
      e.retargetTimer = 1.5;
    }
    const core = world.core;
    const cx = e.position.x - core.position.x;
    const cz = e.position.z - core.position.z;
    const cd = Math.hypot(cx, cz);
    const min = core.radius + def.radius;
    if (cd < min && cd > 0.001) {
      e.position.x = core.position.x + (cx / cd) * min;
      e.position.z = core.position.z + (cz / cd) * min;
    }
  }
}

function chooseTarget(e: Enemy, world: World): Damageable {
  const structure = world.structures.nearest(e.position.x, e.position.z, e.def.aggroRange + e.def.radius);
  return structure ?? world.core;
}

function attack(e: Enemy, target: Damageable, world: World): void {
  const def = e.def;
  const { effects, sfx, projectiles } = world;
  const pan = world.pan(e.position.x);
  aim.set(target.position.x, target.aimHeight, target.position.z);

  switch (def.attack.style) {
    case 'melee': {
      world.damageDefense(target, def.attack.damage);
      const toward = aim.clone().sub(e.position).setY(0).normalize();
      const hit = e.position.clone().addScaledVector(toward, def.radius + 0.3).setY(0.8);
      effects.impact(hit, C.enemyGlowHot, def.kind === 'juggernaut' ? 2 : 0.7);
      if (def.kind === 'juggernaut') effects.shake(0.08);
      sfx.melee(pan);
      break;
    }
    case 'bolt':
      e.muzzleWorld(muzzle);
      projectiles.fireEnemyBolt(muzzle, target, def.attack.damage, def.attack.projectileSpeed ?? 25);
      effects.muzzleFlash(muzzle, aim.clone().sub(muzzle).normalize(), C.enemyPlasma, 0.6);
      sfx.enemyShot(pan);
      break;
    case 'laser':
      e.muzzleWorld(muzzle);
      aim.x += rand(-0.4, 0.4);
      aim.z += rand(-0.4, 0.4);
      effects.laser(muzzle, aim, C.enemyGlow);
      world.damageDefense(target, def.attack.damage);
      sfx.laser(pan);
      break;
    case 'artillery':
      e.muzzleWorld(muzzle);
      projectiles.fireEnemyArtillery(muzzle, target, def.attack.damage, def.attack.splash ?? 3);
      effects.muzzleFlash(muzzle, new THREE.Vector3(0, 1, 0.4).normalize(), C.enemyPlasma, 2);
      effects.shake(0.12);
      sfx.mortar(pan);
      break;
  }
}

function updateSpawner(e: Enemy, dt: number, world: World): void {
  const spawner = e.def.spawner;
  if (!spawner) return;
  e.spawnTimer -= dt;
  if (e.spawnTimer > 0) return;
  e.spawnTimer = spawner.interval;
  for (let i = 0; i < spawner.count; i++) {
    const a = rand(0, TAU);
    const r = e.def.radius + rand(1, 2.5);
    const x = e.position.x + Math.sin(a) * r;
    const z = e.position.z + Math.cos(a) * r;
    world.enemies.spawn(spawner.kind, x, z);
    world.effects.warpIn(new THREE.Vector3(x, 0, z), C.enemyGlow);
  }
}
