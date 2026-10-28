import { smoothstep } from '../../core/math';

const SIZE = 240;
const HALF = SIZE / 2;

/**
 * Baked contact shadows: a 1-unit grid that props darken around their base.
 * The terrain multiplies its vertex colours by it, which grounds props without a real-time AO pass.
 */
export class OcclusionMap {
  private readonly values = new Float32Array(SIZE * SIZE);

  add(x: number, z: number, radius: number, strength = 1): void {
    const reach = radius * 1.7;
    for (let j = Math.floor(z - reach + HALF); j <= Math.ceil(z + reach + HALF); j++) {
      for (let i = Math.floor(x - reach + HALF); i <= Math.ceil(x + reach + HALF); i++) {
        if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) continue;
        const d = Math.hypot(i - HALF - x, j - HALF - z);
        const v = strength * (1 - smoothstep(radius * 0.4, reach, d));
        const k = j * SIZE + i;
        // Overlapping shadows deepen a little but never go fully black.
        this.values[k] = Math.min(1, Math.max(this.values[k], v) + v * 0.15);
      }
    }
  }

  /** Bilinear lookup in [0, 1]. */
  at(x: number, z: number): number {
    const fx = x + HALF;
    const fz = z + HALF;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= SIZE - 1 || j >= SIZE - 1) return 0;
    const tx = fx - i;
    const tz = fz - j;
    const v = this.values;
    const k = j * SIZE + i;
    const a = v[k] + (v[k + 1] - v[k]) * tx;
    const b = v[k + SIZE] + (v[k + SIZE + 1] - v[k + SIZE]) * tx;
    return a + (b - a) * tz;
  }
}
