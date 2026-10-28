import * as THREE from 'three';
import { TAU } from '../core/math';
import type { DecorContext } from './types';

// Horizontal parts use r: [0, yaw - π/2, π/2]: Euler XYZ applies Z first (lay the cylinder along X),
// then Y swings it to point along (sin yaw, cos yaw), the game's angle convention.

/** Default nature palette. Biomes pass their own colours where the mood differs. */
export const NATURE = {
  trunk: 0x6b4a33,
  pine: [0x2f5f3c, 0x386b42, 0x2b5636],
  canopy: [0x5f8f3e, 0x6c9c45, 0x55853a],
  bush: [0x8fae4a, 0x9fba55, 0x7da244],
  leaf: [0x4f8a4a, 0x5f9a50, 0x467e42],
  rock: [0xa6a6a0, 0x93938d, 0xb8b7b0],
  flower: [0xe8697d, 0xf0a04b, 0x7fb8e8, 0xf2d35b, 0xc77ae0],
  log: 0x6e4c34,
  logEnd: 0xc09a68,
};

type Ctx = Pick<DecorContext, 'builder' | 'rnd' | 'occlude' | 'block' | 'glowPool'>;

const tmp = new THREE.Color();

function pick<T>(rnd: () => number, list: readonly T[]): T {
  return list[Math.floor(rnd() * list.length)];
}

/** Colour scaled in brightness, for per-part variation. */
function shade(hex: number, k: number): number {
  return tmp.setHex(hex).multiplyScalar(k).getHex();
}

/** Adds a leaf-like part pointing outward from (x, y, z) at `yaw`, tilted `tilt` from vertical. */
function blade(c: Ctx, x: number, y: number, z: number, length: number, width: number, yaw: number, tilt: number, color: number, flat = 0.35): void {
  const geo = new THREE.ConeGeometry(width, length, 3);
  geo.translate(0, length / 2, 0);
  geo.scale(1, 1, flat);
  geo.rotateX(tilt);
  geo.rotateY(yaw);
  geo.translate(x, y, z);
  c.builder.add(geo, color);
}

export function pine(c: Ctx, x: number, y: number, z: number, s = 1, colors = NATURE.pine): void {
  const { builder: b, rnd } = c;
  const col = pick(rnd, colors);
  const yaw = rnd() * TAU;
  b.cyl(0.13 * s, 0.2 * s, 1.1 * s, 5, NATURE.trunk, { p: [x, y + 0.55 * s, z] });
  for (let i = 0; i < 3; i++) {
    const r = (1.45 - i * 0.36) * s;
    const h = (1.6 - i * 0.18) * s;
    b.cone(r, h, 7, shade(col, 1 + i * 0.07), { p: [x, y + (1.0 + i * 0.95) * s + h / 2, z], r: [0, yaw + i * 0.7, 0] });
  }
  c.occlude(x, z, 1.4 * s, 0.75);
}

export function roundTree(c: Ctx, x: number, y: number, z: number, s = 1, colors = NATURE.canopy): void {
  const { builder: b, rnd } = c;
  const col = pick(rnd, colors);
  b.cyl(0.14 * s, 0.24 * s, 2 * s, 5, NATURE.trunk, { p: [x, y + 1 * s, z], r: [(rnd() - 0.5) * 0.15, 0, (rnd() - 0.5) * 0.15] });
  const blobs = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < blobs; i++) {
    const r = (1.05 + rnd() * 0.45) * s;
    const a = rnd() * TAU;
    const d = i === 0 ? 0 : 0.6 * s;
    b.ico(r, shade(col, 0.92 + rnd() * 0.16), {
      p: [x + Math.sin(a) * d, y + (2.4 + rnd() * 0.5) * s, z + Math.cos(a) * d],
      r: [rnd() * TAU, rnd() * TAU, 0],
    });
  }
  c.occlude(x, z, 1.6 * s, 0.7);
}

export function bush(c: Ctx, x: number, y: number, z: number, s = 1, colors = NATURE.bush): void {
  const { builder: b, rnd } = c;
  const n = 1 + Math.floor(rnd() * 3);
  const col = pick(rnd, colors);
  for (let i = 0; i < n; i++) {
    const r = (0.35 + rnd() * 0.3) * s;
    const a = rnd() * TAU;
    const d = i === 0 ? 0 : 0.45 * s;
    b.ico(r, shade(col, 0.9 + rnd() * 0.2), { p: [x + Math.sin(a) * d, y + r * 0.6, z + Math.cos(a) * d], s: [1, 0.8, 1], r: [rnd() * TAU, rnd() * TAU, 0] });
  }
  c.occlude(x, z, 0.7 * s, 0.5);
}

/** Star of long leaves: ferns, agaves, desert succulents. */
export function fern(c: Ctx, x: number, y: number, z: number, s = 1, colors = NATURE.leaf, leaves = 6, tilt = 1.0): void {
  const { rnd } = c;
  const col = pick(rnd, colors);
  const yaw0 = rnd() * TAU;
  for (let i = 0; i < leaves; i++) {
    blade(c, x, y, z, (0.9 + rnd() * 0.4) * s, 0.2 * s, yaw0 + (i / leaves) * TAU, tilt + (rnd() - 0.5) * 0.3, shade(col, 0.9 + rnd() * 0.2));
  }
  c.occlude(x, z, 0.8 * s, 0.4);
}

export function flowers(c: Ctx, x: number, y: number, z: number, colors = NATURE.flower): void {
  const { builder: b, rnd } = c;
  const col = pick(rnd, colors);
  const n = 2 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const px = x + (rnd() - 0.5) * 1.2;
    const pz = z + (rnd() - 0.5) * 1.2;
    const h = 0.25 + rnd() * 0.25;
    b.cyl(0.025, 0.03, h, 3, 0x4f7f3a, { p: [px, y + h / 2, pz] });
    b.octa(0.14, col, { p: [px, y + h, pz], s: [1, 0.45, 1], r: [0, rnd() * TAU, 0] });
  }
}

export function boulder(c: Ctx, x: number, y: number, z: number, size: number, colors = NATURE.rock, blocks = true): void {
  const { builder: b, rnd } = c;
  const opts = {
    p: [x, y + size * 0.25, z] as [number, number, number],
    r: [rnd() * 0.6, rnd() * TAU, rnd() * 0.6] as [number, number, number],
    s: [1 + rnd() * 0.5, 0.6 + rnd() * 0.35, 1 + rnd() * 0.4] as [number, number, number],
  };
  if (rnd() < 0.5) b.dodeca(size, pick(rnd, colors), opts);
  else b.ico(size, pick(rnd, colors), opts);
  c.occlude(x, z, size * 1.1, 0.8);
  if (blocks && size > 0.9) c.block(x, z, size * 0.95);
}

/** Broad flat stone, like a fallen paving slab or a ledge. */
export function slab(c: Ctx, x: number, y: number, z: number, size: number, colors = NATURE.rock, blocks = true): void {
  const { builder: b, rnd } = c;
  const h = size * (0.25 + rnd() * 0.25);
  b.cyl(size * 0.92, size, h, 5 + Math.floor(rnd() * 3), pick(rnd, colors), {
    p: [x, y + h * 0.35, z],
    r: [(rnd() - 0.5) * 0.25, rnd() * TAU, (rnd() - 0.5) * 0.25],
    s: [1, 1, 0.55 + rnd() * 0.4],
  });
  c.occlude(x, z, size * 1.1, 0.7);
  if (blocks && size > 1.1) c.block(x, z, size * 0.8);
}

/** Weathered standing stone. */
export function menhir(c: Ctx, x: number, y: number, z: number, s = 1, color = 0xc8b48c): void {
  const { builder: b, rnd } = c;
  const h = (2.6 + rnd() * 2) * s;
  const tilt: [number, number, number] = [(rnd() - 0.5) * 0.18, rnd() * TAU, (rnd() - 0.5) * 0.18];
  b.cyl(0.5 * s, 0.75 * s, h, 5, shade(color, 0.92 + rnd() * 0.12), { p: [x, y + h / 2 - 0.2, z], r: tilt, s: [1, 1, 0.7] });
  b.dodeca(0.45 * s, shade(color, 0.85), { p: [x, y + h - 0.15, z], s: [1.1, 0.6, 0.8], r: tilt });
  c.occlude(x, z, 1.1 * s, 0.8);
  c.block(x, z, 0.8 * s);
}

export function log(c: Ctx, x: number, y: number, z: number, length: number): void {
  const { builder: b, rnd } = c;
  const yaw = rnd() * TAU;
  const r = 0.22 + rnd() * 0.1;
  b.cyl(r, r * 1.05, length, 6, NATURE.log, { p: [x, y + r, z], r: [0, yaw, Math.PI / 2] });
  const ex = Math.cos(yaw) * (length / 2 + 0.01);
  const ez = -Math.sin(yaw) * (length / 2 + 0.01);
  for (const side of [-1, 1]) b.cyl(r * 0.85, r * 0.85, 0.04, 6, NATURE.logEnd, { p: [x + ex * side, y + r, z + ez * side], r: [0, yaw, Math.PI / 2] });
  c.occlude(x, z, length * 0.5, 0.5);
}

export function cactus(c: Ctx, x: number, y: number, z: number, s = 1, color = 0x5d8a48): void {
  const { builder: b, rnd } = c;
  const h = (2.4 + rnd() * 1.6) * s;
  b.cyl(0.32 * s, 0.38 * s, h, 7, color, { p: [x, y + h / 2, z] });
  b.ico(0.33 * s, shade(color, 1.05), { p: [x, y + h, z], s: [1, 0.7, 1] });
  const arms = Math.floor(rnd() * 3);
  for (let i = 0; i < arms; i++) {
    const yaw = rnd() * TAU + i * Math.PI;
    const at = h * (0.35 + rnd() * 0.25);
    const out = 0.65 * s;
    const ax = x + Math.sin(yaw) * out;
    const az = z + Math.cos(yaw) * out;
    b.cyl(0.2 * s, 0.2 * s, out, 6, color, { p: [(x + ax) / 2, y + at, (z + az) / 2], r: [0, yaw - Math.PI / 2, Math.PI / 2] });
    const up = (0.8 + rnd() * 0.8) * s;
    b.cyl(0.21 * s, 0.22 * s, up, 6, color, { p: [ax, y + at + up / 2, az] });
    b.ico(0.21 * s, shade(color, 1.05), { p: [ax, y + at + up, az], s: [1, 0.7, 1] });
  }
  c.occlude(x, z, 0.9 * s, 0.6);
  c.block(x, z, 0.55 * s);
}

export function deadTree(c: Ctx, x: number, y: number, z: number, s = 1, color = 0x8a7560): void {
  const { builder: b, rnd } = c;
  const h = (1.8 + rnd() * 1.2) * s;
  b.cyl(0.08 * s, 0.16 * s, h, 5, color, { p: [x, y + h / 2, z] });
  const branches = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < branches; i++) {
    const len = (0.6 + rnd() * 0.8) * s;
    const geo = new THREE.CylinderGeometry(0.03 * s, 0.06 * s, len, 4);
    geo.translate(0, len / 2, 0);
    geo.rotateX(0.5 + rnd() * 0.6);
    geo.rotateY(rnd() * TAU);
    geo.translate(x, y + h * (0.45 + rnd() * 0.5), z);
    b.add(geo, color);
  }
  c.occlude(x, z, 0.8 * s, 0.4);
}

/** Stack of balanced stones. */
export function cairn(c: Ctx, x: number, y: number, z: number, s = 1, colors = NATURE.rock): void {
  const { builder: b, rnd } = c;
  let top = y;
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const r = (0.55 - i * 0.07) * s;
    b.dodeca(r, pick(rnd, colors), { p: [x + (rnd() - 0.5) * 0.15, top + r * 0.45, z + (rnd() - 0.5) * 0.15], s: [1, 0.55, 1], r: [0, rnd() * TAU, 0] });
    top += r * 0.85;
  }
  c.occlude(x, z, 0.8 * s, 0.6);
  c.block(x, z, 0.6 * s);
}

/** Twisting exposed root or fallen branch lying on the ground. */
export function root(c: Ctx, x: number, y: number, z: number, length: number, color = 0x6e5a3c): void {
  const { builder: b, rnd } = c;
  let px = x;
  let pz = z;
  let heading = rnd() * TAU;
  const segments = 4;
  for (let i = 0; i < segments; i++) {
    const len = length / segments;
    heading += (rnd() - 0.5) * 0.9;
    const nx = px + Math.sin(heading) * len;
    const nz = pz + Math.cos(heading) * len;
    const r = 0.22 * (1 - i / segments) + 0.06;
    b.cyl(r * 0.8, r, len * 1.1, 5, color, { p: [(px + nx) / 2, y + r * 0.6 + 0.15 * Math.sin(i), (pz + nz) / 2], r: [0, heading - Math.PI / 2, Math.PI / 2] });
    px = nx;
    pz = nz;
  }
}

/** Big glowing crystal with smaller shards, spilling coloured light on the ground. */
export function crystal(c: Ctx, x: number, y: number, z: number, s: number, color: number, rock = NATURE.rock): void {
  const { builder: b, rnd } = c;
  const lean: [number, number, number] = [(rnd() - 0.5) * 0.3, rnd() * TAU, (rnd() - 0.5) * 0.3];
  const h = (1.8 + rnd() * 0.8) * s;
  b.cyl(0.42 * s, 0.42 * s, h, 6, color, { p: [x, y + h / 2, z], r: lean, glow: true });
  b.cone(0.42 * s, 0.7 * s, 6, color, { p: [x, y + h + 0.3 * s, z], r: lean, glow: true });
  for (let i = 0; i < 2; i++) {
    const a = rnd() * TAU;
    const sh = 0.6 * s;
    b.octa(0.3 * s, color, { p: [x + Math.sin(a) * 0.7 * s, y + sh * 0.5, z + Math.cos(a) * 0.7 * s], s: [0.6, 1.8, 0.6], r: [rnd() - 0.5, a, rnd() - 0.5], glow: true });
  }
  b.dodeca(0.7 * s, pick(rnd, rock), { p: [x, y + 0.1, z], s: [1.3, 0.5, 1.3] });
  c.glowPool(x, z, 4.5 * s, color, 0.55);
  c.occlude(x, z, 0.9 * s, 0.5);
  c.block(x, z, 0.9 * s);
}
