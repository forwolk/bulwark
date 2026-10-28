import type { Biome } from './types';

export const Surface = {
  Ground: 0,
  Blocked: 1,
  Hazard: 2,
} as const;
export type Surface = (typeof Surface)[keyof typeof Surface];

const SIZE = 192;
const HALF = SIZE / 2;
/** Height difference between neighbouring cells above which ground units can't climb. */
const MAX_STEP = 0.75;

/**
 * 1-unit grid over the battlefield: terrain height and what each cell is (walkable, blocked, hazard).
 * Outside the grid everything counts as blocked.
 */
export class NavGrid {
  static readonly size = SIZE;
  readonly heights = new Float32Array(SIZE * SIZE);
  readonly surface = new Uint8Array(SIZE * SIZE);

  constructor(biome: Biome) {
    for (let j = 0; j < SIZE; j++) {
      for (let i = 0; i < SIZE; i++) {
        this.heights[j * SIZE + i] = biome.height(i - HALF + 0.5, j - HALF + 0.5);
      }
    }
    for (let j = 0; j < SIZE; j++) {
      for (let i = 0; i < SIZE; i++) {
        const k = j * SIZE + i;
        if (biome.isHazard(i - HALF + 0.5, j - HALF + 0.5)) {
          this.surface[k] = Surface.Hazard;
        } else if (i === 0 || j === 0 || i === SIZE - 1 || j === SIZE - 1 || this.steep(i, j)) {
          this.surface[k] = Surface.Blocked;
        }
      }
    }
  }

  private steep(i: number, j: number): boolean {
    const h = this.heights[j * SIZE + i];
    return (
      Math.abs(this.heights[j * SIZE + i + 1] - h) > MAX_STEP ||
      Math.abs(this.heights[j * SIZE + i - 1] - h) > MAX_STEP ||
      Math.abs(this.heights[(j + 1) * SIZE + i] - h) > MAX_STEP ||
      Math.abs(this.heights[(j - 1) * SIZE + i] - h) > MAX_STEP
    );
  }

  /** Cell index for a world position, or -1 outside the grid. */
  index(x: number, z: number): number {
    const i = Math.floor(x + HALF);
    const j = Math.floor(z + HALF);
    if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) return -1;
    return j * SIZE + i;
  }

  cellCenterX(k: number): number {
    return (k % SIZE) - HALF + 0.5;
  }

  cellCenterZ(k: number): number {
    return Math.floor(k / SIZE) - HALF + 0.5;
  }

  surfaceAt(x: number, z: number): Surface {
    const k = this.index(x, z);
    return k < 0 ? Surface.Blocked : (this.surface[k] as Surface);
  }

  walkable(x: number, z: number): boolean {
    return this.surfaceAt(x, z) === Surface.Ground;
  }

  /** Bilinear terrain height between cell centres. */
  heightAt(x: number, z: number): number {
    const fx = Math.min(SIZE - 1.001, Math.max(0, x + HALF - 0.5));
    const fz = Math.min(SIZE - 1.001, Math.max(0, z + HALF - 0.5));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const h = this.heights;
    const k = j * SIZE + i;
    const a = h[k] + (h[k + 1] - h[k]) * tx;
    const b = h[k + SIZE] + (h[k + SIZE + 1] - h[k + SIZE]) * tx;
    return a + (b - a) * tz;
  }

  /** True when a straight walk between two points stays on walkable ground. */
  segmentWalkable(x0: number, z0: number, x1: number, z1: number): boolean {
    const dist = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.ceil(dist / 0.75);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (!this.walkable(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
    }
    return true;
  }

  /** Marks every cell whose centre lies inside the circle as blocked (unless it's a hazard). */
  block(x: number, z: number, radius: number): void {
    const r2 = radius * radius;
    for (let j = Math.floor(z - radius + HALF); j <= Math.ceil(z + radius + HALF); j++) {
      for (let i = Math.floor(x - radius + HALF); i <= Math.ceil(x + radius + HALF); i++) {
        if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) continue;
        const cx = i - HALF + 0.5 - x;
        const cz = j - HALF + 0.5 - z;
        const k = j * SIZE + i;
        if (cx * cx + cz * cz <= r2 && this.surface[k] !== Surface.Hazard) this.surface[k] = Surface.Blocked;
      }
    }
  }
}
