import { fbm } from '../world/Noise';
import { inRing } from './biomes/shapes';
import type { DecorContext } from './types';

/** One kind of ground clutter and how often it turns up relative to the others. */
export interface ClutterKind {
  weight: number;
  place(ctx: DecorContext, x: number, y: number, z: number): void;
}

export interface ClutterSpec {
  /** Attempts; the density mask and clustering decide how many land. */
  count: number;
  rMin: number;
  rMax: number;
  /** 0-1 chance of keeping a spot (0 on paths, water, cliffs...). */
  density(x: number, z: number): number;
  /** Clutter gathers in drifts instead of spreading evenly; 0 disables clustering. */
  clustering?: number;
  seed?: number;
  kinds: ClutterKind[];
}

/**
 * Scatters many small props over the ground, gathered into natural drifts. This is most of
 * the ground's detail: pebbles, tufts, branches and shrubs at Taur-like density.
 */
export function scatterClutter(ctx: DecorContext, spec: ClutterSpec): void {
  const { rnd, heightAt } = ctx;
  const total = spec.kinds.reduce((sum, k) => sum + k.weight, 0);
  const clustering = spec.clustering ?? 0.6;
  const seed = spec.seed ?? 1;
  for (let i = 0; i < spec.count; i++) {
    const p = inRing(rnd, spec.rMin, spec.rMax);
    const drift = fbm(p.x * 0.09, p.z * 0.09, 2, seed);
    const keep = spec.density(p.x, p.z) * (1 - clustering + clustering * Math.min(1, Math.max(0, (drift - 0.3) * 2.5)));
    if (rnd() >= keep) continue;
    let roll = rnd() * total;
    const kind = spec.kinds.find((k) => (roll -= k.weight) < 0) ?? spec.kinds[spec.kinds.length - 1];
    kind.place(ctx, p.x, heightAt(p.x, p.z), p.z);
  }
}
