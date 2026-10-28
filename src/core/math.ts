export const TAU = Math.PI * 2;

export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const rand = (min: number, max: number): number => min + Math.random() * (max - min);
export const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));
export const randSign = (): number => (Math.random() < 0.5 ? -1 : 1);
export const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** Frame-rate independent exponential smoothing. */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function rotateTowards(current: number, target: number, maxStep: number): number {
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

/** Yaw that points a model's +Z axis from (fromX, fromZ) toward (toX, toZ). */
export const yawTo = (fromX: number, fromZ: number, toX: number, toZ: number): number =>
  Math.atan2(toX - fromX, toZ - fromZ);

export interface XZ {
  x: number;
  z: number;
}

export const distXZ = (a: XZ, b: XZ): number => Math.hypot(a.x - b.x, a.z - b.z);
export const distSqXZ = (a: XZ, b: XZ): number => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Closest distance (squared) on the XZ plane from point p to segment a-b.
 * Used for swept projectile hits so fast bullets never tunnel through enemies.
 */
export function segmentPointDistSqXZ(ax: number, az: number, bx: number, bz: number, px: number, pz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  let t = lenSq > 0 ? ((px - ax) * abx + (pz - az) * abz) / lenSq : 0;
  t = clamp(t, 0, 1);
  const cx = ax + abx * t - px;
  const cz = az + abz * t - pz;
  return cx * cx + cz * cz;
}
