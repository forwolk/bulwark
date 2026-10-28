import * as THREE from 'three';
import { ARENA } from '../config/balance';
import { PALETTE as C } from '../config/palette';
import { WAVES, type SpawnGroup } from '../config/waves';
import { rand, TAU } from '../core/math';
import type { World } from '../core/World';

interface ActiveGroup {
  group: SpawnGroup;
  spawned: number;
  timer: number;
  angle: number;
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
    this.groups = wave.groups.map((group) => ({
      group,
      spawned: 0,
      timer: group.delay,
      angle: group.angle !== undefined ? THREE.MathUtils.degToRad(group.angle) : rand(0, TAU),
    }));
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

  private spawn(g: ActiveGroup): void {
    const a = g.angle + rand(-0.3, 0.3);
    const r = ARENA.spawnRadius + rand(0, 8);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
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
