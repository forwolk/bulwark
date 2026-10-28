import { smoothstep } from '../../core/math';
import { fbm, valueNoise } from '../../world/Noise';

// Ground-colour building blocks. Taur-style ground is flat colour zones with clean, slightly
// irregular edges, not soft gradients, so these all return near-hard masks.

/** Hard step at `edge` with a narrow band to keep the texture from aliasing. */
export function crisp(v: number, edge: number, width = 0.1): number {
  return smoothstep(edge - width, edge + width, v);
}

/** Small irregularity, in units, for wobbling edges so they never look ruled. */
export function edgeJitter(x: number, z: number, amplitude: number, seed: number): number {
  return (fbm(x * 0.45, z * 0.45, 2, seed) - 0.5) * 2 * amplitude;
}

/**
 * Blotchy patches with crisp, organic outlines: 1 inside, 0 outside. `scale` sets the patch
 * size (smaller = bigger patches); `coverage` in [0, 1] is roughly the share of ground covered.
 */
export function patches(x: number, z: number, scale: number, coverage: number, seed: number): number {
  const warp = (valueNoise(x * 0.5, z * 0.5, seed + 3) - 0.5) * 0.35;
  return crisp(fbm(x * scale + warp, z * scale - warp, 3, seed), 1 - (0.3 + coverage * 0.4), 0.02);
}

/** Scattered small flecks about half a unit across: 1 on a fleck. */
export function flecks(x: number, z: number, density: number, seed: number): number {
  return crisp(valueNoise(x * 1.1, z * 1.1, seed), 1 - density * 0.5, 0.04);
}
