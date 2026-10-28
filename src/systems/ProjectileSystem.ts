import * as THREE from 'three';
import { PALETTE as C } from '../config/palette';
import type { TargetLayer } from '../config/structures';
import { segmentPointDistSqXZ } from '../core/math';
import type { World } from '../core/World';
import type { Ally } from '../entities/Ally';
import type { Damageable } from '../entities/Damageable';
import type { Enemy } from '../entities/Enemy';
import type { Structure } from '../entities/Structure';
import { matchesLayer } from './EnemyManager';

type Kind = 'bullet' | 'shell' | 'missile' | 'flak' | 'bolt' | 'artillery';

interface Projectile {
  kind: Kind;
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
  damage: number;
  splash: number;
  layer: TargetLayer;
  color: THREE.Color;
  size: number;
  length: number;
  targetEnemy: Enemy | null;
  targetDefense: Damageable | null;
  targetPoint: THREE.Vector3;
  trailTimer: number;
}

export interface BulletParams {
  from: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  range: number;
  damage: number;
  splash: number;
  layer: TargetLayer;
  color: number;
  size: number;
  length: number;
}

const GRAVITY = 30;
const MAX = 1500;
/** Knockback impulse from blasts. Light units near a drop get thrown into it. */
const BLAST_PUSH = { shell: 17, missile: 10 };
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpVec = new THREE.Vector3();
const enemyBuffer: Enemy[] = [];
const structureBuffer: Structure[] = [];
const allyBuffer: Ally[] = [];

/** All projectiles, player and enemy, simulated in one pool and drawn as a single instanced mesh. */
export class ProjectileSystem {
  private readonly active: Projectile[] = [];
  private readonly pool: Projectile[] = [];
  private readonly mesh: THREE.InstancedMesh;

  constructor(private readonly world: World) {
    const material = new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.5), material, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color());
    world.scene.add(this.mesh);
  }

  private acquire(kind: Kind, from: THREE.Vector3): Projectile | null {
    if (this.active.length >= MAX) return null;
    const p = this.pool.pop() ?? {
      kind, pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1,
      damage: 0, splash: 0, layer: 'both' as TargetLayer, color: new THREE.Color(), size: 0.2, length: 1,
      targetEnemy: null, targetDefense: null, targetPoint: new THREE.Vector3(), trailTimer: 0,
    };
    p.kind = kind;
    p.pos.copy(from);
    p.prev.copy(from);
    p.age = 0;
    p.trailTimer = 0;
    p.targetEnemy = null;
    p.targetDefense = null;
    p.splash = 0;
    this.active.push(p);
    return p;
  }

  fireBullet(b: BulletParams): void {
    const p = this.acquire('bullet', b.from);
    if (!p) return;
    p.vel.copy(b.dir).multiplyScalar(b.speed);
    p.life = b.range / b.speed;
    p.damage = b.damage;
    p.splash = b.splash;
    p.layer = b.layer;
    p.color.set(b.color).multiplyScalar(5);
    p.size = b.size;
    p.length = b.length;
  }

  /** Ballistic arc that lands on `to` after `flightTime` seconds. */
  fireShell(from: THREE.Vector3, to: THREE.Vector3, flightTime: number, damage: number, splash: number): void {
    const p = this.acquire('shell', from);
    if (!p) return;
    this.setBallistic(p, from, to, flightTime);
    p.damage = damage;
    p.splash = splash;
    p.layer = 'ground';
    p.color.set(C.fireMid).multiplyScalar(5);
    p.size = 0.38;
    p.length = 0.7;
  }

  fireMissile(from: THREE.Vector3, target: Enemy, damage: number, splash: number, launchDir: THREE.Vector3): void {
    const p = this.acquire('missile', from);
    if (!p) return;
    p.vel.copy(launchDir).multiplyScalar(14);
    p.life = 4;
    p.damage = damage;
    p.splash = splash;
    p.layer = 'both';
    p.targetEnemy = target;
    target.aimPoint(p.targetPoint);
    p.color.set(C.playerGlow).multiplyScalar(5);
    p.size = 0.22;
    p.length = 1.0;
  }

  fireFlak(from: THREE.Vector3, to: THREE.Vector3, damage: number, splash: number, speed: number): void {
    const p = this.acquire('flak', from);
    if (!p) return;
    p.targetPoint.copy(to);
    p.vel.subVectors(to, from);
    const dist = p.vel.length();
    p.vel.multiplyScalar(speed / dist);
    p.life = dist / speed;
    p.damage = damage;
    p.splash = splash;
    p.layer = 'air';
    p.color.set(C.flak).multiplyScalar(5);
    p.size = 0.18;
    p.length = 0.9;
  }

  fireEnemyBolt(from: THREE.Vector3, target: Damageable, damage: number, speed: number): void {
    const p = this.acquire('bolt', from);
    if (!p) return;
    p.targetDefense = target;
    p.targetPoint.set(target.position.x, target.aimHeight, target.position.z);
    p.vel.subVectors(p.targetPoint, from);
    const dist = p.vel.length();
    p.vel.multiplyScalar(speed / dist);
    p.life = dist / speed;
    p.damage = damage;
    p.color.set(C.enemyPlasma).multiplyScalar(5);
    p.size = 0.36;
    p.length = 1.3;
  }

  fireEnemyArtillery(from: THREE.Vector3, target: Damageable, damage: number, splash: number): void {
    const p = this.acquire('artillery', from);
    if (!p) return;
    const to = tmpVec.set(target.position.x, 0, target.position.z);
    this.setBallistic(p, from, to, THREE.MathUtils.clamp(from.distanceTo(to) / 14, 1.2, 2.4));
    p.damage = damage;
    p.splash = splash;
    p.color.set(C.enemyPlasma).multiplyScalar(5);
    p.size = 0.7;
    p.length = 1.2;
  }

  private setBallistic(p: Projectile, from: THREE.Vector3, to: THREE.Vector3, t: number): void {
    p.targetPoint.copy(to);
    p.vel.set((to.x - from.x) / t, (to.y - from.y + 0.5 * GRAVITY * t * t) / t, (to.z - from.z) / t);
    p.life = t;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.active.length) {
      const p = this.active[i];
      p.age += dt;
      p.prev.copy(p.pos);
      const done = this.step(p, dt);
      if (done) {
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
        this.pool.push(p);
        continue;
      }
      i++;
    }
    this.render();
  }

  /** Advances one projectile. Returns true when it should be removed. */
  private step(p: Projectile, dt: number): boolean {
    const { effects, level } = this.world;
    switch (p.kind) {
      case 'bullet': {
        p.pos.addScaledVector(p.vel, dt);
        // Shots skim the battlefield: they ride up slopes and fly level over chasms.
        const floor = level.floorAt(p.pos.x, p.pos.z);
        if (p.pos.y < floor + 0.9) {
          p.pos.y = floor + 0.9;
          p.vel.y = 0;
        }
        const hit = this.sweepEnemies(p);
        if (hit) {
          this.hitEnemy(p, hit);
          return true;
        }
        if (p.age >= p.life) {
          if (!level.isHazard(p.pos.x, p.pos.z)) effects.impact(p.pos.setY(floor + 0.3), effects.dustColor, 0.4);
          return true;
        }
        return false;
      }
      case 'shell':
      case 'artillery': {
        p.vel.y -= GRAVITY * dt;
        p.pos.addScaledVector(p.vel, dt);
        p.trailTimer -= dt;
        if (p.trailTimer <= 0) {
          p.trailTimer = 0.03;
          effects.emberTrail(p.pos, p.kind === 'shell' ? C.fireMid : C.enemyPlasma, p.kind === 'shell' ? 1 : 1.8);
          effects.smokeTrail(p.pos, p.kind === 'shell' ? 1 : 1.6);
        }
        const ground = level.heightAt(p.pos.x, p.pos.z);
        if (p.age >= p.life || p.pos.y <= ground) {
          p.pos.y = Math.max(p.pos.y, ground) + 0.2;
          if (p.kind === 'shell') this.splashEnemies(p.pos, p.splash, p.damage, 'ground', BLAST_PUSH.shell);
          else this.splashDefenses(p.pos, p.splash, p.damage);
          const size = p.kind === 'shell' ? 1.5 : 2.2;
          effects.explosion(p.pos, size, { debrisColor: effects.dustDarkColor, shake: p.kind === 'shell' ? 0.08 : 0.25, color: p.kind === 'shell' ? undefined : C.enemyPlasma });
          this.world.sfx.explosion(size, this.world.pan(p.pos.x));
          return true;
        }
        return false;
      }
      case 'missile': {
        const t = p.targetEnemy;
        if (t && t.alive) t.aimPoint(p.targetPoint);
        else if (t) p.targetEnemy = this.world.enemies.nearest(p.targetPoint.x, p.targetPoint.z, 10, 'both');
        // Steering ramps up after launch so missiles fan out first, then dive in.
        const speed = Math.min(42, 14 + p.age * 40);
        const turn = Math.min(14, 2 + p.age * 18);
        tmpDir.subVectors(p.targetPoint, p.pos).normalize().multiplyScalar(speed);
        p.vel.lerp(tmpDir, Math.min(1, turn * dt));
        p.vel.setLength(speed);
        p.pos.addScaledVector(p.vel, dt);
        p.trailTimer -= dt;
        if (p.trailTimer <= 0) {
          p.trailTimer = 0.018;
          effects.smokeTrail(p.pos, 1.1);
          effects.emberTrail(p.pos, C.playerGlow, 0.8);
        }
        const close = p.pos.distanceToSquared(p.targetPoint) < 1.2;
        if (close || p.pos.y <= level.floorAt(p.pos.x, p.pos.z) + 0.1 || p.age >= p.life) {
          this.splashEnemies(p.pos, p.splash, p.damage, 'both', BLAST_PUSH.missile);
          effects.explosion(p.pos, 1.1, { color: C.playerGlow, debrisColor: C.enemyShell, shake: 0.04 });
          this.world.sfx.explosion(1, this.world.pan(p.pos.x));
          return true;
        }
        return false;
      }
      case 'flak': {
        p.pos.addScaledVector(p.vel, dt);
        let detonate = p.age >= p.life;
        if (!detonate) {
          this.world.enemies.neighbors(p.pos.x, p.pos.z, 2.5, enemyBuffer);
          for (const e of enemyBuffer) {
            if (e.alive && e.flying && e.position.distanceToSquared(p.pos) < 3.2) {
              detonate = true;
              break;
            }
          }
        }
        if (detonate) {
          this.splashEnemies(p.pos, p.splash, p.damage, 'air');
          effects.explosion(p.pos, 0.9, { color: C.flak, scorch: false, light: false });
          this.world.sfx.explosion(0.6, this.world.pan(p.pos.x));
          return true;
        }
        return false;
      }
      case 'bolt': {
        p.pos.addScaledVector(p.vel, dt);
        p.trailTimer -= dt;
        if (p.trailTimer <= 0) {
          p.trailTimer = 0.04;
          effects.emberTrail(p.pos, C.enemyPlasma, 0.8);
        }
        if (p.age >= p.life) {
          const target = p.targetDefense;
          if (target && target.alive) this.world.damageDefense(target, p.damage);
          effects.impact(p.pos, C.enemyPlasma, 1);
          return true;
        }
        return false;
      }
    }
  }

  /** Swept test along this frame's path so fast bullets can't skip over small enemies. */
  private sweepEnemies(p: Projectile): Enemy | null {
    const mx = (p.pos.x + p.prev.x) / 2;
    const mz = (p.pos.z + p.prev.z) / 2;
    const half = Math.hypot(p.pos.x - p.prev.x, p.pos.z - p.prev.z) / 2;
    this.world.enemies.neighbors(mx, mz, half + 4.5, enemyBuffer);
    let best: Enemy | null = null;
    let bestDist = Infinity;
    for (const e of enemyBuffer) {
      if (!e.alive || !matchesLayer(e, p.layer)) continue;
      const r = e.def.radius + 0.25;
      if (segmentPointDistSqXZ(p.prev.x, p.prev.z, p.pos.x, p.pos.z, e.position.x, e.position.z) > r * r) continue;
      const d = (e.position.x - p.prev.x) ** 2 + (e.position.z - p.prev.z) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  private hitEnemy(p: Projectile, e: Enemy): void {
    const { effects, enemies } = this.world;
    const point = e.aimPoint(tmpVec);
    enemies.damage(e, p.damage);
    if (p.splash > 0) {
      for (const other of enemies.inRadius(point.x, point.z, p.splash, e.flying ? 'air' : 'ground', [])) {
        if (other !== e) enemies.damage(other, p.damage * 0.5);
      }
      effects.impact(point, C.playerGlow, 1.2);
    } else {
      effects.impact(point, C.flak, 0.6);
    }
  }

  private splashEnemies(pos: THREE.Vector3, radius: number, damage: number, layer: TargetLayer, push = 0): void {
    const { enemies } = this.world;
    for (const e of enemies.inRadius(pos.x, pos.z, radius, layer, [])) {
      const d = Math.hypot(e.position.x - pos.x, e.position.z - pos.z);
      const falloff = 1 - 0.5 * Math.min(1, d / radius);
      if (push > 0) enemies.push(e, pos.x, pos.z, push * falloff);
      enemies.damage(e, damage * falloff);
    }
  }

  private splashDefenses(pos: THREE.Vector3, radius: number, damage: number): void {
    for (const s of this.world.structures.inRadius(pos.x, pos.z, radius, structureBuffer)) this.world.damageDefense(s, damage);
    for (const a of this.world.squads.inRadius(pos.x, pos.z, radius, allyBuffer)) this.world.damageDefense(a, damage);
    const core = this.world.core;
    if (Math.hypot(core.position.x - pos.x, core.position.z - pos.z) <= radius + core.radius) this.world.damageDefense(core, damage);
  }

  private render(): void {
    const n = this.active.length;
    for (let i = 0; i < n; i++) {
      const p = this.active[i];
      tmpDir.copy(p.vel);
      const speed = tmpDir.length();
      if (speed > 1e-4) tmpDir.multiplyScalar(1 / speed);
      else tmpDir.set(0, 0, 1);
      tmpQuat.setFromUnitVectors(AXIS_Z, tmpDir);
      tmpScale.set(p.size, p.size, p.length);
      this.mesh.setMatrixAt(i, tmpMatrix.compose(p.pos, tmpQuat, tmpScale));
      this.mesh.setColorAt(i, p.color);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    for (const p of this.active) this.pool.push(p);
    this.active.length = 0;
    this.mesh.count = 0;
  }
}
