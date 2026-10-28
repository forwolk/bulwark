import * as THREE from 'three';
import { ARENA, ECONOMY } from '../config/balance';
import { PALETTE as C } from '../config/palette';
import { STRUCTURES, type StructureKind } from '../config/structures';
import type { World } from '../core/World';
import type { Enemy } from '../entities/Enemy';
import { Structure } from '../entities/Structure';
import { updateTurret } from './TurretWeapons';

export type PlacementError = 'range' | 'terrain' | 'occupied' | 'funds' | null;

const cellKey = (x: number, z: number): string => `${Math.round(x / ARENA.gridSize)},${Math.round(z / ARENA.gridSize)}`;

/** Player structures: placement grid, per-frame weapon updates, collisions and destruction. */
export class StructureManager {
  private list: Structure[] = [];
  private readonly grid = new Map<string, Structure>();

  constructor(private readonly world: World) {}

  get all(): readonly Structure[] {
    return this.list;
  }

  static snap(v: number): number {
    return Math.round(v / ARENA.gridSize) * ARENA.gridSize;
  }

  placementError(kind: StructureKind, x: number, z: number): PlacementError {
    const r = Math.hypot(x, z);
    if (r < ARENA.buildMinRadius || r > ARENA.buildMaxRadius) return 'range';
    if (!this.world.level.walkable(x, z)) return 'terrain';
    if (this.grid.has(cellKey(x, z))) return 'occupied';
    if (!this.world.economy.canAfford(STRUCTURES[kind].cost)) return 'funds';
    return null;
  }

  place(kind: StructureKind, x: number, z: number): Structure | null {
    if (this.placementError(kind, x, z) !== null) return null;
    const def = STRUCTURES[kind];
    if (!this.world.economy.spend(def.cost)) return null;
    const s = new Structure(def, x, z);
    s.addTo(this.world.scene);
    this.list.push(s);
    this.grid.set(cellKey(x, z), s);
    this.world.stats.structuresBuilt++;
    this.world.events.emit('structureBuilt', { kind });
    return s;
  }

  sellValue(s: Structure): number {
    return Math.floor(s.def.cost * ECONOMY.sellRefund * (s.hp / s.maxHp));
  }

  sell(s: Structure): void {
    this.world.economy.earn(this.sellValue(s));
    this.world.effects.structurePlaced(s.position);
    this.remove(s);
  }

  at(x: number, z: number): Structure | null {
    return this.grid.get(cellKey(StructureManager.snap(x), StructureManager.snap(z))) ?? null;
  }

  nearest(x: number, z: number, range: number): Structure | null {
    let best: Structure | null = null;
    let bestDist = range;
    for (const s of this.list) {
      if (!s.alive) continue;
      const d = Math.hypot(s.position.x - x, s.position.z - z) - s.radius;
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  inRadius(x: number, z: number, radius: number, out: Structure[]): Structure[] {
    out.length = 0;
    for (const s of this.list) {
      if (s.alive && Math.hypot(s.position.x - x, s.position.z - z) <= radius + s.radius) out.push(s);
    }
    return out;
  }

  /** Pushes a ground enemy out of any structure it overlaps. Returns the structure that blocked it. */
  resolveCollision(e: Enemy): Structure | null {
    let blocker: Structure | null = null;
    for (const s of this.list) {
      if (!s.alive) continue;
      const dx = e.position.x - s.position.x;
      const dz = e.position.z - s.position.z;
      const min = s.radius + e.def.radius;
      // Square-ish footprint for walls so lines of barriers have no gaps.
      if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
      const d = Math.hypot(dx, dz);
      if (d >= min + 0.35) continue;
      if (d > 0.001) {
        const push = min + 0.35 - d;
        e.position.x += (dx / d) * push;
        e.position.z += (dz / d) * push;
      }
      blocker = s;
    }
    return blocker;
  }

  repairAll(fraction: number): void {
    for (const s of this.list) {
      if (s.hp < s.maxHp) {
        s.repair(fraction);
        this.world.effects.repairPulse(s.position);
      }
    }
  }

  update(dt: number): void {
    for (const s of this.list) {
      if (!s.alive) {
        this.destroy(s);
        continue;
      }
      if (this.world.playing && s.def.weapon) updateTurret(s, dt, this.world);
      s.animate(dt);
    }
  }

  private destroy(s: Structure): void {
    const { effects, sfx, events } = this.world;
    effects.explosion(new THREE.Vector3(s.position.x, 1, s.position.z), 1.8, { debrisColor: C.playerSteel, shake: 0.2 });
    sfx.explosion(1.8, this.world.pan(s.position.x));
    events.emit('structureLost', { kind: s.def.kind });
    events.emit('message', { text: `${s.def.name} destroyed`, tone: 'warn' });
    this.remove(s);
  }

  /** Safe to call while iterating: the list is replaced, not mutated. */
  private remove(s: Structure): void {
    s.hp = 0;
    this.list = this.list.filter((other) => other !== s);
    this.grid.delete(cellKey(s.position.x, s.position.z));
    s.dispose(this.world.scene);
  }

  clear(): void {
    for (const s of this.list) s.dispose(this.world.scene);
    this.list = [];
    this.grid.clear();
  }
}
