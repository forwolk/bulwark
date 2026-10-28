import * as THREE from 'three';
import { GRAVITY } from '../config/balance';
import { PALETTE as C } from '../config/palette';
import { damp, rand, rotateTowards, TAU } from '../core/math';
import type { World } from '../core/World';
import type { Damageable } from '../entities/Damageable';
import type { Enemy } from '../entities/Enemy';

const neighbors: Enemy[] = [];
/** Bombs keep this share of the bomber's forward speed when released. */
const BOMB_DRIFT = 0.8;
const muzzle = new THREE.Vector3();
const aim = new THREE.Vector3();
const flow = { x: 0, z: 0 };
/** Units this big are too heavy to be knocked into hazards. */
const UNSHOVEABLE_RADIUS = 2.5;

/**
 * Enemy behaviour: pick a target (nearby structure, else the core), path toward it through the
 * level with crowd separation, get blocked by walls, and attack once in range.
 */
export function updateEnemyAI(e: Enemy, dt: number, world: World): void {
  const def = e.def;
  const { level } = world;

  if (e.knockback.lengthSq() > 0.01) {
    const ox = e.position.x;
    const oz = e.position.z;
    e.position.x += e.knockback.x * dt;
    e.position.z += e.knockback.z * dt;
    e.knockback.multiplyScalar(Math.exp(-5 * dt));
    if (!def.flying && !level.walkable(e.position.x, e.position.z)) {
      if (def.radius < UNSHOVEABLE_RADIUS && hazardAhead(e, world)) {
        world.enemies.drop(e);
        return;
      }
      e.position.x = ox;
      e.position.z = oz;
      e.knockback.set(0, 0, 0);
    }
  }

  if (def.spawner) updateSpawner(e, dt, world);

  if (e.stun > 0) {
    e.stun -= dt;
    e.moving = false;
    e.velocity.set(0, 0, 0);
    followGround(e, dt, world);
    return;
  }

  if (def.bomber) {
    updateBomber(e, dt, world);
    followGround(e, dt, world);
    return;
  }

  e.retargetTimer -= dt;
  if (e.retargetTimer <= 0 || !e.target || !e.target.alive) {
    e.target = chooseTarget(e, world);
    e.retargetTimer = rand(0.4, 0.8);
    e.directPath = def.flying || level.nav.segmentWalkable(e.position.x, e.position.z, e.target.position.x, e.target.position.z);
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
    if (!e.directPath && level.flow.direction(e.position.x, e.position.z, flow)) {
      mx = flow.x;
      mz = flow.z;
    }

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
    const ox = e.position.x;
    const oz = e.position.z;
    e.position.x += e.velocity.x * dt;
    e.position.z += e.velocity.z * dt;
    // Walkers slide along walls and cliff edges instead of walking off them.
    if (!def.flying && !level.walkable(e.position.x, e.position.z)) {
      if (level.walkable(e.position.x, oz)) e.position.z = oz;
      else if (level.walkable(ox, e.position.z)) e.position.x = ox;
      else {
        e.position.x = ox;
        e.position.z = oz;
      }
    }
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
  followGround(e, dt, world);
}

/**
 * True when a shoved unit is at or over the lip of a hazard. The slope down into a chasm or pool
 * counts as blocked for walking, so look a little further along the push for the drop itself.
 */
function hazardAhead(e: Enemy, world: World): boolean {
  const { level } = world;
  const len = Math.hypot(e.knockback.x, e.knockback.z) || 1;
  const dx = e.knockback.x / len;
  const dz = e.knockback.z / len;
  for (let s = 0; s <= 2.5; s += 0.5) {
    if (level.isHazard(e.position.x + dx * s, e.position.z + dz * s)) return true;
  }
  return false;
}

function followGround(e: Enemy, dt: number, world: World): void {
  const { level } = world;
  if (e.flying) {
    // Flyers ease over mesas and crater rims instead of snapping to the terrain.
    e.groundY = damp(e.groundY, level.floorAt(e.position.x, e.position.z), 2.5, dt);
  } else {
    e.groundY = level.heightAt(e.position.x, e.position.z);
  }
}

/** Nearest structure or squad member within aggro range, else the core. */
function chooseTarget(e: Enemy, world: World): Damageable {
  const { x, z } = e.position;
  const reach = e.def.aggroRange + e.def.radius;
  const structure = world.structures.nearest(x, z, reach);
  // Only shooters can hit flying squads.
  const canHitAir = e.def.attack.style === 'bolt' || e.def.attack.style === 'laser';
  const ally = world.squads.nearest(x, z, reach, canHitAir);
  if (structure && ally) {
    const ds = Math.hypot(structure.position.x - x, structure.position.z - z);
    const da = Math.hypot(ally.position.x - x, ally.position.z - z);
    return ds <= da ? structure : ally;
  }
  return structure ?? ally ?? world.core;
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
    case 'laser': {
      e.muzzleWorld(muzzle);
      aim.x += rand(-0.4, 0.4);
      aim.z += rand(-0.4, 0.4);
      // A shield dome in the way takes the beam instead.
      const blocked = world.shields.intersect(muzzle, aim);
      effects.laser(muzzle, blocked ? blocked.point : aim, C.enemyGlow);
      if (blocked) world.shields.absorb(blocked, def.attack.damage);
      else world.damageDefense(target, def.attack.damage);
      sfx.laser(pan);
      break;
    }
    case 'rockets': {
      // A ripple-fired salvo; the launcher keeps firing even if its target dies mid-salvo.
      const salvo = def.attack.salvo ?? 4;
      for (let i = 0; i < salvo; i++) {
        world.timers.after(i * 0.2, () => {
          if (!e.alive) return;
          e.muzzleWorld(muzzle);
          muzzle.x += rand(-0.4, 0.4);
          world.projectiles.fireEnemyRocket(muzzle, target, def.attack.damage, def.attack.splash ?? 2.5);
          effects.muzzleFlash(muzzle, aim.set(Math.sin(e.yaw) * 0.5, 1, Math.cos(e.yaw) * 0.5).normalize(), C.enemyGlowHot, 0.9);
          effects.smokeTrail(muzzle, 1.6);
          sfx.rocketLaunch(world.pan(muzzle.x));
        });
      }
      break;
    }
    case 'bombs':
      // Bombers attack from updateBomber, never through the stop-and-shoot path.
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

/**
 * Bombing runs: fly at constant speed with a limited turn rate, so the plane overshoots its
 * target and loops back for another pass. Bombs are released early enough to land on it.
 */
function updateBomber(e: Enemy, dt: number, world: World): void {
  const def = e.def;
  const turnRate = def.bomber?.turnRate ?? 1;
  e.retargetTimer -= dt;
  if (e.retargetTimer <= 0 || !e.target || !e.target.alive) {
    // Mostly the core, sometimes a structure, so bombers spread their attention.
    const structure = Math.random() < 0.4 ? world.structures.nearest(e.position.x, e.position.z, def.aggroRange) : null;
    e.target = structure ?? world.core;
    e.retargetTimer = rand(4, 7);
  }
  const target = e.target ?? world.core;

  const desired = Math.atan2(target.position.x - e.position.x, target.position.z - e.position.z);
  e.yaw = rotateTowards(e.yaw, desired, turnRate * dt);
  e.velocity.set(Math.sin(e.yaw) * def.speed, 0, Math.cos(e.yaw) * def.speed);
  e.position.x += e.velocity.x * dt;
  e.position.z += e.velocity.z * dt;
  e.moving = true;

  e.attackTimer -= dt;
  if (e.attackTimer > 0) return;
  const height = Math.max(1, e.position.y - world.level.floorAt(e.position.x, e.position.z));
  const fall = Math.sqrt((2 * height) / GRAVITY);
  const lead = def.speed * BOMB_DRIFT * fall;
  const ix = e.position.x + Math.sin(e.yaw) * lead;
  const iz = e.position.z + Math.cos(e.yaw) * lead;
  if (Math.hypot(ix - target.position.x, iz - target.position.z) > target.radius + 2.5) return;

  e.attackTimer = def.attack.interval;
  const stick = def.attack.salvo ?? 3;
  world.sfx.bombWhistle(world.pan(e.position.x));
  for (let i = 0; i < stick; i++) {
    world.timers.after(i * 0.15, () => {
      if (!e.alive) return;
      e.muzzleWorld(muzzle);
      aim.copy(e.velocity).multiplyScalar(BOMB_DRIFT);
      world.projectiles.fireBomb(muzzle, aim, def.attack.damage, def.attack.splash ?? 3.5);
    });
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
    let x = e.position.x + Math.sin(a) * r;
    let z = e.position.z + Math.cos(a) * r;
    if (!world.level.walkable(x, z)) {
      x = e.position.x;
      z = e.position.z;
    }
    world.enemies.spawn(spawner.kind, x, z);
    world.effects.warpIn(new THREE.Vector3(x, 0, z), C.enemyGlow);
  }
}
