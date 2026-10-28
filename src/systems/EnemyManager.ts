import * as THREE from 'three';
import { ENEMIES, type EnemyKind } from '../config/enemies';
import { PALETTE as C } from '../config/palette';
import type { TargetLayer } from '../config/structures';
import { rand } from '../core/math';
import { SpatialHash } from '../core/SpatialHash';
import type { World } from '../core/World';
import { Enemy } from '../entities/Enemy';
import { updateEnemyAI } from './EnemyAI';

const tmp = new THREE.Vector3();

export function matchesLayer(e: Enemy, layer: TargetLayer): boolean {
  return layer === 'both' || (layer === 'air') === e.flying;
}

/** Owns enemy lifetimes: spawning, per-frame AI, damage, death and spatial queries. */
export class EnemyManager {
  private list: Enemy[] = [];
  /** Enemies lost to hazards, kept around only for their fall animation. */
  private falling: Enemy[] = [];
  private readonly hash = new SpatialHash<Enemy>(4);

  constructor(private readonly world: World) {}

  get all(): readonly Enemy[] {
    return this.list;
  }

  get count(): number {
    return this.list.length;
  }

  spawn(kind: EnemyKind, x: number, z: number): Enemy {
    const def = ENEMIES[kind];
    const { level } = this.world;
    const enemy = new Enemy(def, x, z, def.flying ? level.floorAt(x, z) : level.heightAt(x, z));
    enemy.addTo(this.world.scene);
    this.list.push(enemy);
    return enemy;
  }

  update(dt: number): void {
    this.hash.clear();
    for (const e of this.list) if (e.alive) this.hash.insert(e);

    if (this.world.playing) {
      for (const e of this.list) if (e.alive) updateEnemyAI(e, dt, this.world);
    }
    for (const e of this.list) e.animate(dt);

    if (this.list.some((e) => !e.alive)) {
      this.list = this.list.filter((e) => {
        if (e.alive) return true;
        if (e.falling) this.falling.push(e);
        else e.dispose(this.world.scene);
        return false;
      });
    }

    if (this.falling.length > 0) {
      const liquid = this.world.level.theme.hazard?.kind === 'liquid';
      this.falling = this.falling.filter((e) => {
        const done = e.updateFall(dt, liquid);
        if (done) e.dispose(this.world.scene);
        return !done;
      });
    }
  }

  /** Knockback impulse away from a point. Heavy units resist it. */
  push(e: Enemy, fromX: number, fromZ: number, strength: number): void {
    const dx = e.position.x - fromX;
    const dz = e.position.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    const k = strength / Math.max(1, e.def.radius);
    e.knockback.x += (dx / d) * k;
    e.knockback.z += (dz / d) * k;
  }

  /** An enemy knocked into a chasm or pool: counts as a kill, then plays out its fall. */
  drop(e: Enemy): void {
    if (!e.alive) return;
    const { effects, sfx, level } = this.world;
    const hazard = level.theme.hazard;
    const liquid = hazard?.kind === 'liquid';
    e.startFall();
    const at = e.position.clone();
    at.y = liquid ? -0.3 : level.floorAt(at.x, at.z);
    effects.hazardSplash(at, hazard?.color ?? C.enemyGlow, liquid);
    sfx.hazardFall(liquid, this.world.pan(at.x));
    this.reward(e, at);
  }

  damage(enemy: Enemy, amount: number): void {
    if (!enemy.alive) return;
    enemy.takeDamage(amount);
    if (enemy.hp <= 0) this.kill(enemy);
  }

  private kill(e: Enemy): void {
    e.alive = false;
    const { effects, sfx } = this.world;
    const def = e.def;
    const pos = e.aimPoint(new THREE.Vector3());

    if (def.kind === 'leviathan') {
      this.bossDeath(pos);
    } else {
      effects.explosion(pos, def.deathSize, {
        debrisColor: C.enemyShellLight,
        color: def.flying ? C.enemyGlow : undefined,
        shake: def.deathSize * 0.05,
      });
      sfx.explosion(def.deathSize, this.world.pan(pos.x));
    }

    this.reward(e, pos);
  }

  private reward(e: Enemy, pos: THREE.Vector3): void {
    const { economy, events, stats } = this.world;
    economy.earn(e.def.reward);
    stats.kills++;
    events.emit('enemyKilled', { kind: e.def.kind, reward: e.def.reward, position: pos });
  }

  /** Staggered chain of blasts across the boss's body, then a final shockwave. */
  private bossDeath(pos: THREE.Vector3): void {
    const { effects, sfx, timers } = this.world;
    for (let i = 0; i < 9; i++) {
      timers.after(i * 0.16, () => {
        const p = pos.clone().add(tmp.set(rand(-3, 3), rand(0, 3), rand(-3, 3)));
        effects.explosion(p, rand(1.4, 2.4), { debrisColor: C.enemyShellLight, shake: 0.2 });
        sfx.explosion(2, this.world.pan(p.x));
      });
    }
    timers.after(1.6, () => {
      effects.explosion(pos, 6, { debrisColor: C.enemyBone, shake: 1 });
      effects.shockwave(pos, 20, C.enemyGlow);
      sfx.explosion(4, 0);
    });
  }

  /** Candidates near a point. Exact distance tests are the caller's job. */
  neighbors(x: number, z: number, radius: number, out: Enemy[]): Enemy[] {
    return this.hash.query(x, z, radius, out);
  }

  nearest(x: number, z: number, range: number, layer: TargetLayer, minRange = 0): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = Infinity;
    for (const e of this.list) {
      if (!e.alive || !matchesLayer(e, layer)) continue;
      const d = Math.hypot(e.position.x - x, e.position.z - z) - e.def.radius;
      if (d > range || d < minRange) continue;
      // Light preference for already-damaged targets so turrets finish kills.
      const score = d - (1 - e.hp / e.def.hp) * 2;
      if (score < bestDist) {
        bestDist = score;
        best = e;
      }
    }
    return best;
  }

  inRadius(x: number, z: number, radius: number, layer: TargetLayer, out: Enemy[]): Enemy[] {
    out.length = 0;
    for (const e of this.list) {
      if (!e.alive || !matchesLayer(e, layer)) continue;
      const r = radius + e.def.radius;
      if ((e.position.x - x) ** 2 + (e.position.z - z) ** 2 <= r * r) out.push(e);
    }
    return out;
  }

  clear(): void {
    for (const e of this.list) e.dispose(this.world.scene);
    for (const e of this.falling) e.dispose(this.world.scene);
    this.list = [];
    this.falling = [];
    this.hash.clear();
  }
}
