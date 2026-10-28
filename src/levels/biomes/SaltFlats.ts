import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lerp, smoothstep, TAU } from '../../core/math';
import { createSkyReflection } from '../../world/features/skyReflection';
import { fbm, valueNoise } from '../../world/Noise';
import type { Biome, DecorContext } from '../types';
import { angleGap, laneMask, polar, polarNoise, rock, terrace } from './shapes';

/** Canyon lanes through the mesa ring, in degrees. */
const ARCH = { angle: 212, radius: 31 };
export const SALT_CANYONS = [45, 135, 225, 315];
const CANYON_HALF = 7;

interface Pool {
  x: number;
  z: number;
  radius: number;
  seed: number;
}

const POOLS: Pool[] = [
  [62, 30, 4], [118, 28.5, 4.4], [178, 31, 4.6], [250, 27.5, 3.6], [322, 30, 4.4], [92, 32.5, 3.4], [8, 29, 4],
].map(([angle, r, radius], i) => ({ ...polar(angle, r), radius, seed: 100 + i }));

const STRATA = [0xc68b80, 0xdcbca2, 0xa98db3, 0xe3cdb8, 0xb97a78];
const COL = {
  salt: 0xd2cadf,
  saltDim: 0xb9b0c9,
  seam: 0x9a8fae,
  stain: 0x8a80b6,
  basin: 0x2a2350,
  cap: 0xdccbc4,
  plate: [0xdcd5e6, 0xe6e0ee, 0xd2cade, 0xe0d6e4],
  boulder: 0xd6c0ae,
  boulderDark: 0xb49c92,
  arch: 0x8d8496,
  archDark: 0x6c6475,
  glyph: 0xd7a8ff,
  crust: 0xf1ecf6,
  pink: 0xf0c6d6,
  pinkCrust: 0xe8cdd6,
  blueCrust: 0xc9cce6,
  poolRim: 0x5b4fc4,
  poolDeep: 0x120c3a,
};

const tmp = new THREE.Color();
const plateColor = new THREE.Color();

/**
 * Blinding salt flats inside a ring of striped mesas. Four canyons lead in, and brine sinkholes
 * swallow anything knocked into them.
 */
export class SaltFlats implements Biome {
  mesaRadius(theta: number): number {
    return 41.5 + (polarNoise(theta, 7, 1.8) - 0.5) * 8;
  }

  /** Normalised distance to the nearest pool edge (1 = on the rim) with a wobbly outline. */
  private poolDistance(x: number, z: number): number {
    let best = Infinity;
    for (const p of POOLS) {
      const dx = x - p.x;
      const dz = z - p.z;
      const wobble = 1 + (polarNoise(Math.atan2(dx, dz), p.seed, 1.3) - 0.5) * 0.4;
      best = Math.min(best, Math.hypot(dx, dz) / (p.radius * wobble));
    }
    return best;
  }

  height(x: number, z: number): number {
    const r = Math.hypot(x, z);
    const base = (fbm(x * 0.05, z * 0.05, 3, 13) - 0.5) * 0.25 * smoothstep(22, 30, r);
    const canyon = laneMask(x, z, SALT_CANYONS, CANYON_HALF, 3.5, 20);
    const m = smoothstep(this.mesaRadius(Math.atan2(x, z)), this.mesaRadius(Math.atan2(x, z)) + 3, r) * (1 - canyon);
    const top = 12 + fbm(x * 0.03, z * 0.03, 3, 17) * 16;
    let h = base + terrace(m * top, 2.2, 0.75);
    const d = this.poolDistance(x, z);
    if (d < 1.15) h = Math.min(h, lerp(-1.7, h, smoothstep(0.82, 1.05, d)));
    return h;
  }

  isHazard(x: number, z: number): boolean {
    return this.poolDistance(x, z) < 0.93;
  }

  color(x: number, z: number, h: number, slope: number, out: THREE.Color): void {
    const d = this.poolDistance(x, z);
    if (d < 1) {
      out.setHex(COL.basin);
      return;
    }
    if (h > 1.2 || slope > 0.3) {
      const band = Math.floor((h + fbm(x * 0.1, z * 0.1, 2, 3) * 1.4) / 1.1);
      out.setHex(STRATA[((band % STRATA.length) + STRATA.length) % STRATA.length]);
      if (slope < 0.2 && h > 3) out.lerp(tmp.setHex(COL.cap), 0.55);
      return;
    }
    out.setHex(COL.seam).lerp(tmp.setHex(COL.saltDim), fbm(x * 0.2, z * 0.2, 2, 5));
    if (d < 1.6) out.lerp(tmp.setHex(COL.stain), (1.6 - d) / 0.6 * 0.7);
  }

  decorate(ctx: DecorContext): void {
    this.saltPlates(ctx);
    this.pools(ctx);
    this.arch(ctx, ARCH.angle, ARCH.radius);
    this.monoliths(ctx);
    this.scatter(ctx);
  }

  /** Cracked salt crust: jittered hexagonal plates with gaps that read as seams. */
  private saltPlates({ builder: b, rnd, heightAt }: DecorContext): void {
    const R = 3;
    const w = Math.sqrt(3) * R;
    const rowH = 1.5 * R;
    const corner = (cx: number, cz: number, k: number): [number, number] => {
      const a = (Math.PI / 180) * (30 + 60 * k);
      const x = cx + Math.cos(a) * R;
      const z = cz + Math.sin(a) * R;
      // Shared corners get the same jitter from both plates, so seams stay even.
      const kx = Math.round(x * 10) / 10;
      const kz = Math.round(z * 10) / 10;
      return [x + (valueNoise(kx * 3.1, kz * 3.1, 91) - 0.5) * 2.2, z + (valueNoise(kx * 3.1, kz * 3.1, 92) - 0.5) * 2.2];
    };

    for (let row = -20; row <= 20; row++) {
      for (let col = -16; col <= 16; col++) {
        const cx = (col + (row & 1 ? 0.5 : 0)) * w;
        const cz = row * rowH;
        const r = Math.hypot(cx, cz);
        if (r < 8.2 || r > 70) continue;
        const inCanyon = laneMask(cx, cz, SALT_CANYONS, CANYON_HALF - 1, 0.1, 20) > 0.5;
        if (heightAt(cx, cz) > 0.35 || (r > this.mesaRadius(Math.atan2(cx, cz)) - 1.5 && !inCanyon)) continue;
        if (this.poolDistance(cx, cz) < 1.5 || rnd() < 0.08) continue;

        const pts = [0, 1, 2, 3, 4, 5].map((k) => corner(cx, cz, k));
        const mx = pts.reduce((s, p) => s + p[0], 0) / 6;
        const mz = pts.reduce((s, p) => s + p[1], 0) / 6;
        const shrink = 0.9;
        const top = heightAt(mx, mz) + 0.07 + rnd() * 0.04;
        const bottom = top - 0.3;
        const ring = pts.map(([x, z]) => [mx + (x - mx) * shrink, mz + (z - mz) * shrink] as [number, number]);
        const pos: number[] = [];
        for (let k = 0; k < 6; k++) {
          const [x0, z0] = ring[k];
          const [x1, z1] = ring[(k + 1) % 6];
          pos.push(mx, top, mz, x1, top, z1, x0, top, z0);
          pos.push(x0, top, z0, x1, top, z1, x0, bottom, z0);
          pos.push(x1, top, z1, x1, bottom, z1, x0, bottom, z0);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.computeVertexNormals();
        // Large, soft tint drifts across the crust so it doesn't read as one flat colour.
        const tint = fbm(mx * 0.035, mz * 0.035, 2, 19);
        plateColor.setHex(COL.plate[Math.floor(rnd() * COL.plate.length)]).lerp(tmp.setHex(tint > 0.5 ? COL.pinkCrust : COL.blueCrust), Math.abs(tint - 0.5) * 1.3);
        b.add(geo, plateColor);
      }
    }
  }

  /** Mirror-still brine reflecting the sky, ringed with salt crust. */
  private pools({ builder: b, rnd, group, animate }: DecorContext): void {
    const discs: THREE.BufferGeometry[] = [];
    for (const p of POOLS) {
      const segments = 28;
      const pos: number[] = [];
      const colors: number[] = [];
      const deep = new THREE.Color(COL.poolDeep);
      const rim = new THREE.Color(COL.poolRim);
      const edge = (k: number): [number, number] => {
        const a = (k / segments) * TAU;
        const wobble = 1 + (polarNoise(a, p.seed, 1.3) - 0.5) * 0.4;
        const r = p.radius * wobble * 0.97;
        return [p.x + Math.sin(a) * r, p.z + Math.cos(a) * r];
      };
      for (let k = 0; k < segments; k++) {
        const [x0, z0] = edge(k);
        const [x1, z1] = edge(k + 1);
        pos.push(p.x, -0.3, p.z, x0, -0.3, z0, x1, -0.3, z1);
        colors.push(deep.r, deep.g, deep.b, rim.r, rim.g, rim.b, rim.r, rim.g, rim.b);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
      discs.push(geo);

      // Salt crust crystals around the rim.
      for (let k = 0; k < segments; k += 1 + Math.floor(rnd() * 2)) {
        const [x, z] = edge(k + rnd());
        const s = 0.2 + rnd() * 0.35;
        b.box(s, s * (1 + rnd() * 1.5), s, rnd() < 0.7 ? COL.crust : COL.pink, {
          p: [x, 0.05, z],
          r: [(rnd() - 0.5) * 0.8, rnd() * TAU, (rnd() - 0.5) * 0.8],
        });
      }
    }
    const sky = createSkyReflection(0x6d5fb8, 0xf2c8d4, 0xb7a6c8);
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.85,
      roughness: 0.08,
      envMap: sky,
      envMapIntensity: 1.4,
      emissive: 0x0c0826,
    });
    const mesh = new THREE.Mesh(mergeGeometries(discs), material);
    discs.forEach((g) => g.dispose());
    mesh.receiveShadow = true;
    group.add(mesh);
    // Slowly turning the reflection makes the surface feel alive without any geometry work.
    animate((_dt, time) => {
      material.envMapRotation.y = time * 0.04;
    });
  }

  /** Colossal ring of carved stone half-sunk in the salt. */
  private arch({ builder: b, rnd, block }: DecorContext, angleDeg: number, radius: number): void {
    const { x: ax, z: az } = polar(angleDeg, radius);
    const yaw = 0.35;
    const R = 8.5;
    const cy = 5;
    const blocks = 18;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    for (let k = 0; k < blocks; k++) {
      const phi = (k / blocks) * TAU;
      const lx = Math.cos(phi) * R;
      const y = cy + Math.sin(phi) * R;
      if (y < -1.5) continue;
      // A gap near the top: the ring is broken.
      if (k === 4 || k === 5) continue;
      const x = ax + lx * cos;
      const z = az - lx * sin;
      b.box(3.1, 2.2, 2.6, k % 3 === 0 ? COL.archDark : COL.arch, { p: [x, y, z], r: [0, yaw, phi + Math.PI / 2] });
      b.box(1.6, 0.18, 0.12, COL.glyph, { p: [x + sin * 1.33, y, z + cos * 1.33], r: [0, yaw, phi + Math.PI / 2], glow: true });
    }
    // Fallen blocks from the broken crown.
    for (let placed = 0, attempt = 0; placed < 4 && attempt < 20; attempt++) {
      const a = rnd() * TAU;
      const d = 4 + rnd() * 5;
      const fx = ax + Math.sin(a) * d;
      const fz = az + Math.cos(a) * d;
      if (Math.hypot(fx, fz) < 26) continue;
      b.box(3, 2.2, 2.6, COL.arch, { p: [fx, 0.7, fz], r: [rnd() * 0.5, rnd() * TAU, rnd() * 0.5] });
      block(fx, fz, 1.8);
      placed++;
    }
    const legX = Math.sqrt(R * R - cy * cy);
    for (const side of [-1, 1]) block(ax + side * legX * cos, az - side * legX * sin, 2.2);
  }

  /** Weathered standing stones with faint glyphs. */
  private monoliths({ builder: b, rnd, block }: DecorContext): void {
    let placed = 0;
    for (let attempt = 0; attempt < 80 && placed < 8; attempt++) {
      const angle = rnd() * 360;
      if (SALT_CANYONS.some((c) => angleGap(angle, c) < 10) || angleGap(angle, ARCH.angle) < 22) continue;
      const r = 24 + rnd() * 12;
      const { x, z } = polar(angle, r);
      if (r > this.mesaRadius(angle * (Math.PI / 180)) - 3 || this.poolDistance(x, z) < 1.8) continue;
      const h = 5 + rnd() * 6;
      const yaw = rnd() * TAU;
      const tilt = (rnd() - 0.5) * 0.18;
      b.box(1.7, h, 1, COL.archDark, { p: [x, h / 2 - 0.4, z], r: [tilt, yaw, tilt * 0.5] });
      b.box(0.14, h * 0.55, 0.06, COL.glyph, {
        p: [x + Math.sin(yaw) * 0.52, h * 0.5, z + Math.cos(yaw) * 0.52], r: [tilt, yaw, tilt * 0.5], glow: true,
      });
      b.box(2.3, 0.6, 1.6, COL.arch, { p: [x, 0.1, z], r: [0, yaw, 0] });
      block(x, z, 1.5);
      placed++;
    }
  }

  private scatter({ builder: b, rnd, heightAt, block }: DecorContext): void {
    for (let i = 0; i < 70; i++) {
      const theta = rnd() * TAU;
      const r = 23 + rnd() * 22;
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * r;
      if (r > this.mesaRadius(theta) - 2 || this.poolDistance(x, z) < 1.4) continue;
      const size = 0.4 + rnd() * rnd() * 1.6;
      rock(b, rnd, x, heightAt(x, z), z, size, rnd() < 0.6 ? COL.boulder : COL.boulderDark);
      if (size > 1.2) block(x, z, size);
    }
    // Rubble at the feet of the mesas.
    for (let i = 0; i < 160; i++) {
      const theta = rnd() * TAU;
      const r = this.mesaRadius(theta) + 0.5 + rnd() * 3;
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * r;
      rock(b, rnd, x, heightAt(x, z), z, 0.4 + rnd() * 1.1, STRATA[Math.floor(rnd() * STRATA.length)]);
    }
    // Pink salt crystal clusters.
    for (let i = 0; i < 22; i++) {
      const theta = rnd() * TAU;
      const r = 20 + rnd() * 26;
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * r;
      if (heightAt(x, z) > 0.3 || this.poolDistance(x, z) < 1.2) continue;
      const n = 3 + Math.floor(rnd() * 5);
      for (let k = 0; k < n; k++) {
        const s = 0.3 + rnd() * 0.5;
        b.box(s, s * (1.2 + rnd()), s, rnd() < 0.5 ? COL.pink : COL.crust, {
          p: [x + (rnd() - 0.5) * 1.6, s * 0.4, z + (rnd() - 0.5) * 1.6],
          r: [(rnd() - 0.5) * 0.9, rnd() * TAU, (rnd() - 0.5) * 0.9],
        });
      }
    }
  }
}
