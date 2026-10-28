import { smoothstep, TAU } from '../../core/math';
import { fbm } from '../../world/Noise';

const DEG = Math.PI / 180;

/** Seamless noise around a circle (period 2π), roughly in [0, 1]. Used to wobble ring-shaped features. */
export function polarNoise(theta: number, seed: number, frequency = 2): number {
  return fbm(Math.cos(theta) * frequency + 10, Math.sin(theta) * frequency + 10, 3, seed);
}

/** Position on a ring for an angle in degrees (0 = +Z, bottom of the screen). */
export function polar(angleDeg: number, radius: number): { x: number; z: number } {
  return { x: Math.sin(angleDeg * DEG) * radius, z: Math.cos(angleDeg * DEG) * radius };
}

/** Distance along and across a radial lane pointing out from the centre at `angleDeg`. */
export function laneCoords(x: number, z: number, angleDeg: number): { along: number; lateral: number } {
  const a = angleDeg * DEG;
  return { along: x * Math.sin(a) + z * Math.cos(a), lateral: Math.abs(x * Math.cos(a) - z * Math.sin(a)) };
}

/** 1 inside the nearest radial lane, 0 outside, with a soft edge of `edge` units. */
export function laneMask(x: number, z: number, anglesDeg: readonly number[], halfWidth: number, edge: number, minAlong = 0): number {
  let best = 0;
  for (const a of anglesDeg) {
    const { along, lateral } = laneCoords(x, z, a);
    if (along < minAlong) continue;
    best = Math.max(best, 1 - smoothstep(halfWidth, halfWidth + edge, lateral));
  }
  return best;
}

/** Smallest absolute difference between two angles in degrees. */
export function angleGap(aDeg: number, bDeg: number): number {
  const d = (((aDeg - bDeg) % 360) + 540) % 360 - 180;
  return Math.abs(d);
}

/** Stepped profile: flat ledges joined by steep risers. `sharpness` near 1 gives cliffs. */
export function terrace(h: number, step: number, sharpness = 0.8): number {
  const t = h / step;
  const base = Math.floor(t);
  return (base + smoothstep(sharpness, 1, t - base)) * step;
}

/** Uniformly distributed random point in a ring around the centre. */
export function inRing(rnd: () => number, rMin: number, rMax: number): { x: number; z: number; theta: number; r: number } {
  const theta = rnd() * TAU;
  const r = Math.sqrt(rMin * rMin + rnd() * (rMax * rMax - rMin * rMin));
  return { x: Math.sin(theta) * r, z: Math.cos(theta) * r, theta, r };
}

/** Signed distance across a radial lane (positive to the lane's right). */
export function laneSide(x: number, z: number, angleDeg: number): number {
  const a = (angleDeg * Math.PI) / 180;
  return x * Math.cos(a) - z * Math.sin(a);
}

/**
 * 1 on a winding path that follows a radial lane out from `start`, 0 off it.
 * The centre line meanders with noise so paths look trodden rather than ruled.
 */
export function pathMask(x: number, z: number, anglesDeg: readonly number[], halfWidth: number, start: number, seed: number): number {
  let best = 0;
  for (const a of anglesDeg) {
    const { along } = laneCoords(x, z, a);
    if (along < start) continue;
    const wobble = (fbm(along * 0.07, a, 2, seed) - 0.5) * 5;
    const side = Math.abs(laneSide(x, z, a) - wobble);
    best = Math.max(best, (1 - smoothstep(halfWidth, halfWidth + 1.2, side)) * smoothstep(start, start + 2, along));
  }
  return best;
}
