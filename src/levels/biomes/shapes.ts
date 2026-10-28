import * as THREE from 'three';
import { smoothstep, TAU } from '../../core/math';
import type { ModelBuilder } from '../../render/ModelBuilder';
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

/** Hexagonal prism standing on the ground, with a lighter cap: the basic unit of basalt formations. */
export function hexColumn(
  b: ModelBuilder,
  x: number, z: number, radius: number, top: number, bottom: number,
  side: number, cap: number, yaw = 0,
): void {
  const h = top - bottom;
  b.cyl(radius, radius * 1.04, h, 6, side, { p: [x, bottom + h / 2, z], r: [0, yaw, 0] });
  b.cyl(radius * 0.97, radius * 0.97, 0.12, 6, cap, { p: [x, top + 0.02, z], r: [0, yaw, 0] });
}

/** Low-poly rock: squashed dodecahedron or icosahedron with random orientation. */
export function rock(
  b: ModelBuilder,
  rnd: () => number, x: number, y: number, z: number, size: number, color: number,
): void {
  const opts = {
    p: [x, y + size * 0.15, z] as [number, number, number],
    r: [rnd() * TAU, rnd() * TAU, rnd() * TAU] as [number, number, number],
    s: [0.8 + rnd() * 0.6, 0.5 + rnd() * 0.5, 0.8 + rnd() * 0.6] as [number, number, number],
  };
  if (rnd() < 0.5) b.dodeca(size, color, opts);
  else b.ico(size, color, opts);
}

/** Cluster of tall crystal shards; every `glowEvery`-th shard glows. */
export function crystalCluster(
  b: ModelBuilder,
  rnd: () => number, x: number, y: number, z: number,
  count: number, size: number, color: number, base: number, glowEvery = 2,
): void {
  b.dodeca(size * 1.1, base, { p: [x, y, z], s: [1.3, 0.55, 1.3], r: [0, rnd() * TAU, 0] });
  for (let k = 0; k < count; k++) {
    const s = size * (0.5 + rnd() * 0.7);
    const a = rnd() * TAU;
    const d = rnd() * size * 0.9;
    b.octa(s, color, {
      p: [x + Math.sin(a) * d, y + s * 1.3, z + Math.cos(a) * d],
      r: [(rnd() - 0.5) * 0.9, rnd() * TAU, (rnd() - 0.5) * 0.9],
      s: [0.42, 2 + rnd() * 1.6, 0.42],
      glow: k % glowEvery === 0,
    });
  }
}

/**
 * Flat strip following a polyline across the terrain, e.g. glowing cracks.
 * Returns a non-indexed geometry ready for ModelBuilder.add.
 */
export function groundRibbon(
  points: readonly { x: number; z: number }[], width: number, lift: number,
  heightAt: (x: number, z: number) => number,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const left = (i: number, side: number): [number, number, number] => {
    const p = points[i];
    const a = points[Math.max(0, i - 1)];
    const c = points[Math.min(points.length - 1, i + 1)];
    let dx = c.x - a.x;
    let dz = c.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // Taper the ends to a point.
    const taper = i === 0 || i === points.length - 1 ? 0.15 : 1;
    const w = (width / 2) * taper * side;
    const x = p.x - dz * w;
    const z = p.z + dx * w;
    return [x, heightAt(x, z) + lift, z];
  };
  for (let i = 0; i < points.length - 1; i++) {
    const a = left(i, 1);
    const b = left(i, -1);
    const c = left(i + 1, 1);
    const d = left(i + 1, -1);
    // Counter-clockwise seen from above, so the strip faces up.
    pos.push(...a, ...c, ...b, ...c, ...d, ...b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Random walk that wanders but keeps a general heading. Used for cracks and fissures. */
export function wander(
  rnd: () => number, x: number, z: number, heading: number, steps: number, stepLength: number, jitter: number,
  stop?: (x: number, z: number) => boolean,
): { x: number; z: number }[] {
  const pts = [{ x, z }];
  let h = heading;
  for (let i = 0; i < steps; i++) {
    h += (rnd() - 0.5) * jitter;
    x += Math.sin(h) * stepLength;
    z += Math.cos(h) * stepLength;
    if (stop?.(x, z)) break;
    pts.push({ x, z });
  }
  return pts;
}
