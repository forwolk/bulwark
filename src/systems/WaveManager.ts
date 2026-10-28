import * as THREE from 'three';
import { ARENA } from '../config/balance';
import { PALETTE as C } from '../config/palette';
import { ENEMIES } from '../config/enemies';
import { WAVES, type SpawnGroup } from '../config/waves';
import { rand, TAU } from '../core/math';
import type { World } from '../core/World';

interface ActiveGroup {
  group: SpawnGroup;
  spawned: number;
  timer: number;
  /** Approach direction in radians (0 = +Z). For ground units it is the gate's direction. */
  angle: number;
  /** Index into the level's gates, for ground units. */
  gate: number;
}

/** Schedules enemy spawns for the current wave and reports when it has been cleared. */
export class WaveManager {
  /** Index of the wave currently running or most recently finished (-1 before the first). */
  index = -1;
  private groups: ActiveGroup[] = [];
  private running = false;

  constructor(private readonly world: World) {}

  get total(): number {
    return WAVES.length;
  }

  /** 1-based number of the next wave to launch. */
  get nextWaveNumber(): number {
    return this.index + 2;
  }

  get isFinalWave(): boolean {
    return this.index === WAVES.length - 1;
  }

  get remainingToSpawn(): number {
    return this.groups.reduce((sum, g) => sum + (g.group.count - g.spawned), 0);
  }

  get cleared(): boolean {
    return this.running && this.remainingToSpawn === 0 && this.world.enemies.count === 0;
  }

  startNext(): void {
    this.index++;
    const wave = WAVES[this.index];
    const gates = this.world.level.def.gates;
    this.groups = wave.groups.map((group) => {
      const angle = group.angle !== undefined ? THREE.MathUtils.degToRad(group.angle) : rand(0, TAU);
      if (ENEMIES[group.kind].flying) return { group, spawned: 0, timer: group.delay, angle, gate: -1 };
      // Ground groups enter through the gate closest to their intended approach.
      const gate = this.nearestGate(angle);
      return { group, spawned: 0, timer: group.delay, angle: THREE.MathUtils.degToRad(gates[gate].angle), gate };
    });
    this.running = true;
    this.world.events.emit('waveStarted', { wave: this.index + 1, total: WAVES.length });
  }

  finish(): void {
    this.running = false;
  }

  update(dt: number): void {
    if (!this.running) return;
    for (const g of this.groups) {
      g.timer -= dt;
      while (g.timer <= 0 && g.spawned < g.group.count) {
        this.spawn(g);
        g.spawned++;
        g.timer += g.group.interval;
      }
    }
  }

  private nearestGate(angle: number): number {
    const gates = this.world.level.def.gates;
    let best = 0;
    let bestGap = Infinity;
    gates.forEach((gate, i) => {
      const gap = Math.abs(Math.atan2(Math.sin(angle - THREE.MathUtils.degToRad(gate.angle)), Math.cos(angle - THREE.MathUtils.degToRad(gate.angle))));
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    });
    return best;
  }

  private spawnPoint(g: ActiveGroup): { x: number; z: number } {
    if (g.gate < 0) {
      const a = g.angle + rand(-0.3, 0.3);
      const r = ARENA.spawnRadius + rand(0, 8);
      return { x: Math.sin(a) * r, z: Math.cos(a) * r };
    }
    const { level } = this.world;
    const gate = level.def.gates[g.gate];
    for (let attempt = 0; attempt < 6; attempt++) {
      const p = level.gatePoint(gate, rand(-1, 1));
      if (level.walkable(p.x, p.z)) return p;
    }
    return level.gatePoint(gate, 0);
  }

  private spawn(g: ActiveGroup): void {
    const { x, z } = this.spawnPoint(g);
    this.world.enemies.spawn(g.group.kind, x, z);
    if (g.group.kind === 'leviathan') {
      this.world.effects.warpIn(new THREE.Vector3(x, 0, z), C.enemyGlow);
      this.world.events.emit('message', { text: 'Leviathan approaching', tone: 'warn' });
    }
  }

  /** Direction (radians) of groups still spawning; used by the HUD threat markers. */
  activeAngles(): number[] {
    return this.groups.filter((g) => g.spawned < g.group.count && g.timer < 3).map((g) => g.angle);
  }

  reset(): void {
    this.index = -1;
    this.groups = [];
    this.running = false;
  }
}
