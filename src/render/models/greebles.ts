import { Finish } from '../Materials';
import type { ModelBuilder } from '../ModelBuilder';

// Small mechanical and organic details shared by the unit models. They carry most of the
// "close-up" detail: pistons, bolts, vents, cables, lights and glowing blisters.

export type V3 = [number, number, number];

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Hydraulic piston: a dark housing and a polished rod sliding out of it. */
export function piston(b: ModelBuilder, from: V3, to: V3, r: number, housing: number, rod: number): void {
  const mid = lerp3(from, to, 0.55);
  b.strut(from, mid, r, r, 6, housing);
  b.strut(lerp3(from, to, 0.5), to, r * 0.55, r * 0.55, 6, rod, false, Finish.Metal);
  b.ico(r * 1.1, housing, { p: to });
}

/** A row of rivet heads along an axis, on a face whose outward normal is `facing`. */
export function bolts(b: ModelBuilder, start: V3, end: V3, count: number, r: number, color: number, facing: 'x' | 'y' | 'z' = 'y'): void {
  const rot: V3 = facing === 'y' ? [0, 0, 0] : facing === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
  for (let i = 0; i < count; i++) {
    const p = lerp3(start, end, count === 1 ? 0.5 : i / (count - 1));
    b.cyl(r, r, r * 0.8, 6, color, { p, r: rot, finish: Finish.Metal });
  }
}

/** Louvred vent: a recessed dark frame with slats, optionally glowing between them. */
export function vent(b: ModelBuilder, at: V3, w: number, h: number, slats: number, frame: number, glowColor?: number, yaw = 0): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  b.box(w, h, 0.05, frame, { p: at, r: [0, yaw, 0] });
  if (glowColor !== undefined) b.box(w * 0.85, h * 0.8, 0.02, glowColor, { p: [at[0] + s * 0.02, at[1], at[2] + c * 0.02], r: [0, yaw, 0], glow: true });
  for (let i = 0; i < slats; i++) {
    const y = at[1] - h / 2 + (h * (i + 0.5)) / slats;
    b.box(w * 0.92, (h / slats) * 0.42, 0.06, frame, { p: [at[0] + s * 0.04, y, at[2] + c * 0.04], r: [0.5, yaw, 0], finish: Finish.Metal });
  }
}

/** Flexible cable or hose through a list of points. */
export function cable(b: ModelBuilder, points: V3[], r: number, color: number): void {
  for (let i = 0; i < points.length - 1; i++) {
    b.strut(points[i], points[i + 1], r, r, 5, color);
    if (i > 0) b.ico(r * 1.05, color, { p: points[i] });
  }
}

/** Small light in a dark housing. */
export function lamp(b: ModelBuilder, at: V3, r: number, housing: number, color: number, facing: 'x' | 'y' | 'z' = 'z'): void {
  const rot: V3 = facing === 'y' ? [0, 0, 0] : facing === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
  b.cyl(r * 1.4, r * 1.4, r * 0.8, 6, housing, { p: at, r: rot });
  const off: V3 = facing === 'x' ? [r * 0.45, 0, 0] : facing === 'y' ? [0, r * 0.45, 0] : [0, 0, r * 0.45];
  b.cyl(r, r, r * 0.3, 6, color, { p: [at[0] + off[0], at[1] + off[1], at[2] + off[2]], r: rot, glow: true });
}

/** Barrel with a polished bore, cooling rings and a slotted muzzle brake. Runs along +Z from `at`. */
export function barrel(b: ModelBuilder, at: V3, length: number, r: number, dark: number, rings = 3): void {
  const end: V3 = [at[0], at[1], at[2] + length];
  b.strut(at, end, r, r * 0.92, 8, dark, false, Finish.Metal);
  for (let i = 0; i < rings; i++) {
    const z = at[2] + length * (0.15 + i * 0.12);
    b.cyl(r * 1.35, r * 1.35, length * 0.05, 8, dark, { p: [at[0], at[1], z], r: [Math.PI / 2, 0, 0] });
  }
  b.cyl(r * 1.45, r * 1.45, length * 0.12, 8, dark, { p: [at[0], at[1], end[2] - length * 0.05], r: [Math.PI / 2, 0, 0], finish: Finish.Metal });
  for (const sx of [-1, 1]) b.box(0.02, r * 1.6, length * 0.06, 0x111418, { p: [at[0] + sx * r * 1.46, at[1], end[2] - length * 0.05] });
}

/** Glowing blisters on organic hide, scattered deterministically around a centre. */
export function pustules(b: ModelBuilder, centre: V3, spread: V3, count: number, r: number, color: number, seed = 1): void {
  let a = seed * 9301 + 49297;
  const rnd = (): number => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
  for (let i = 0; i < count; i++) {
    const p: V3 = [centre[0] + (rnd() - 0.5) * spread[0], centre[1] + (rnd() - 0.5) * spread[1], centre[2] + (rnd() - 0.5) * spread[2]];
    b.ico(r * (0.7 + rnd() * 0.6), color, { p, s: [1, 0.75, 1], glow: true });
  }
}

/** Row of backward-raked spines along a line. */
export function spines(b: ModelBuilder, from: V3, to: V3, count: number, length: number, width: number, color: number, rake: V3 = [0, 1, -0.7]): void {
  const len = Math.hypot(...rake) || 1;
  for (let i = 0; i < count; i++) {
    const p = lerp3(from, to, count === 1 ? 0.5 : i / (count - 1));
    const l = length * (1 - i * 0.12);
    b.strut(p, [p[0] + (rake[0] / len) * l, p[1] + (rake[1] / len) * l, p[2] + (rake[2] / len) * l], width, 0.01, 4, color);
  }
}
