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
  private readonly hash = new SpatialHash<Enemy>(4);

  constructor(private readonly world: World) {}

  get all(): readonly Enemy[] {
    return this.list;
  }

  get count(): number {
    return this.list.length;
  }

  spawn(kind: EnemyKind, x: number, z: number): Enemy {
    const enemy = new Enemy(ENEMIES[kind], x, z);
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
        if (!e.alive) e.dispose(this.world.scene);
        return e.alive;
      });
    }
  }

  damage(enemy: Enemy, amount: number): void {
    if (!enemy.alive) return;
    enemy.takeDamage(amount);
    if (enemy.hp <= 0) this.kill(enemy);
  }

  private kill(e: Enemy): void {
    e.alive = false;
    const { effects, sfx, economy, events, stats } = this.world;
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

    economy.earn(def.reward);
    stats.kills++;
    events.emit('enemyKilled', { kind: def.kind, reward: def.reward, position: pos });
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
    this.list = [];
    this.hash.clear();
  }
}
