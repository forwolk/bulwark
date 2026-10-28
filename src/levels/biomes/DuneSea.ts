import * as THREE from 'three';
import { lerp, smoothstep, TAU } from '../../core/math';
import { Quicksand } from '../../world/features/Quicksand';
import { fbm } from '../../world/Noise';
import { boulder, bush, cactus, cairn, crystal, deadTree, fern } from '../props';
import type { Biome, DecorContext } from '../types';
import { angleGap, inRing, laneMask, pathMask, polar, polarNoise, terrace } from './shapes';

/** Canyon lanes through the mesa ring, in degrees. */
export const DUNE_CANYONS = [45, 135, 225, 315];
const CANYON_HALF = 7;
const ARCH = { angle: 212, radius: 31 };

interface Pit {
  x: number;
  z: number;
  radius: number;
  seed: number;
}

const PITS: Pit[] = [
  [62, 30, 4], [118, 28.5, 4.4], [178, 31, 4.6], [250, 27.5, 3.6], [322, 30, 4.4], [92, 32.5, 3.4], [8, 29, 4],
].map(([angle, r, radius], i) => ({ ...polar(angle, r), radius, seed: 100 + i }));

const STRATA = [0xdcab7b, 0xc99365, 0xe8c79a, 0xbb8058, 0xe0b98a];
const COL = {
  sand: 0xf0e6cf,
  sandWarm: 0xe4cea4,
  sandDeep: 0xd8bd8e,
  mesaTop: 0xe9d3ab,
  pitLight: 0xd2b789,
  pitDark: 0xa98b5f,
  rock: [0xc8a27a, 0xb58f68, 0xd6b58e],
  shrub: [0x9da159, 0xa9a862, 0x8c9550],
  agave: [0x7aa08a, 0x86a994, 0x6f9480],
  cactus: 0x5f8e4c,
  crystal: 0x7fe8ff,
};

const tmp = new THREE.Color();

/**
 * Pale desert flats inside a ring of sandstone mesas. Four canyons lead in, and quicksand
 * pits swallow anything knocked into them.
 */
export class DuneSea implements Biome {
  mesaRadius(theta: number): number {
    return 41.5 + (polarNoise(theta, 7, 1.8) - 0.5) * 8;
  }

  /** Normalised distance to the nearest pit edge (1 = on the rim), with a wobbly outline. */
  private pitDistance(x: number, z: number): number {
    let best = Infinity;
    for (const p of PITS) {
      const dx = x - p.x;
      const dz = z - p.z;
      const wobble = 1 + (polarNoise(Math.atan2(dx, dz), p.seed, 1.3) - 0.5) * 0.35;
      best = Math.min(best, Math.hypot(dx, dz) / (p.radius * wobble));
    }
    return best;
  }

  height(x: number, z: number): number {
    const r = Math.hypot(x, z);
    const dunes = (fbm(x * 0.04, z * 0.04, 3, 13) - 0.5) * 0.7 * smoothstep(22, 28, r);
    const mr = this.mesaRadius(Math.atan2(x, z));
    const canyon = laneMask(x, z, DUNE_CANYONS, CANYON_HALF, 3.5, 20);
    const m = smoothstep(mr, mr + 3, r) * (1 - canyon);
    const top = 10 + fbm(x * 0.03, z * 0.03, 3, 17) * 14;
    let h = dunes + terrace(m * top, 2.4, 0.78);
    const d = this.pitDistance(x, z);
    if (d < 1.1) h = Math.min(h, lerp(-1, h, smoothstep(0.5, 1.05, d)));
    return h;
  }

  isHazard(x: number, z: number): boolean {
    return this.pitDistance(x, z) < 0.8;
  }

  color(x: number, z: number, h: number, slope: number, out: THREE.Color): void {
    const d = this.pitDistance(x, z);
    if (d < 1.05) {
      out.setHex(COL.pitLight).lerp(tmp.setHex(COL.pitDark), 1 - smoothstep(0.4, 1.05, d));
      return;
    }
    if (h > 1 || slope > 0.3) {
      const band = Math.floor((h + fbm(x * 0.1, z * 0.1, 2, 3) * 1.2) / 1.2);
      out.setHex(STRATA[((band % STRATA.length) + STRATA.length) % STRATA.length]);
      if (slope < 0.2 && h > 3) out.lerp(tmp.setHex(COL.mesaTop), 0.6);
      return;
    }
    out.setHex(COL.sand).lerp(tmp.setHex(COL.sandWarm), smoothstep(0.38, 0.7, fbm(x * 0.03, z * 0.03, 3, 23)));
    // Wind-blown streaks and darker sand in the canyons and at the mesa feet.
    out.lerp(tmp.setHex(COL.sandDeep), smoothstep(0.55, 0.8, fbm(x * 0.02 + z * 0.06, z * 0.02, 2, 27)) * 0.5);
    out.lerp(tmp.setHex(COL.sandDeep), pathMask(x, z, DUNE_CANYONS, 3, 30, 61) * 0.6);
    // Darker rim where sand rolls into the pits.
    if (d < 1.5) out.lerp(tmp.setHex(COL.pitLight), (1.5 - d) / 0.45 * 0.6);
  }

  decorate(ctx: DecorContext): void {
    for (const p of PITS) {
      const pit = new Quicksand(p.x, -0.12, p.z, p.radius * 0.95, COL.pitLight, COL.pitDark);
      ctx.group.add(pit.mesh);
      ctx.animate((_dt, time) => pit.update(time + p.seed));
    }
    this.flats(ctx);
    this.mesaFeet(ctx);
    this.arch(ctx);
    this.beyond(ctx);
  }

  private open(x: number, z: number, margin: number): boolean {
    const r = Math.hypot(x, z);
    return r > 22 && r < this.mesaRadius(Math.atan2(x, z)) - margin && this.pitDistance(x, z) > 1.5;
  }

  /** Cacti, agaves, scrub and cairns scattered over the flats. */
  private flats(ctx: DecorContext): void {
    const { rnd, heightAt } = ctx;
    for (let i = 0; i < 260; i++) {
      const p = inRing(rnd, 12, 48);
      if (p.r < 22 ? p.r < 11 || rnd() < 0.6 : !this.open(p.x, p.z, 1.5)) continue;
      // Keep the inner build area light: only small scrub there.
      const inner = p.r < 22;
      const y = heightAt(p.x, p.z);
      const roll = rnd();
      if (!inner && roll < 0.16) cactus(ctx, p.x, y, p.z, 0.9 + rnd() * 0.5, COL.cactus);
      else if (roll < 0.4) fern(ctx, p.x, y, p.z, 0.9 + rnd() * 0.3, COL.agave, 8, 0.75);
      else if (roll < 0.65) bush(ctx, p.x, y, p.z, 0.8 + rnd() * 0.4, COL.shrub);
      else if (!inner && roll < 0.72) deadTree(ctx, p.x, y, p.z, 1);
      else if (!inner && roll < 0.76) cairn(ctx, p.x, y, p.z, 0.9, COL.rock);
      else boulder(ctx, p.x, y, p.z, 0.25 + rnd() * 0.5, COL.rock);
    }
    for (let i = 0; i < 4; i++) {
      const angle = 20 + i * 90 + rnd() * 40;
      const { x, z } = polar(angle, 36 + rnd() * 3);
      if (this.open(x, z, 1.5)) crystal(ctx, x, heightAt(x, z), z, 1, COL.crystal, COL.rock);
    }
  }

  /** Big sandstone boulders tumbled at the foot of the mesas. */
  private mesaFeet(ctx: DecorContext): void {
    const { rnd, heightAt } = ctx;
    for (let i = 0; i < 160; i++) {
      const theta = rnd() * TAU;
      if (DUNE_CANYONS.some((c) => angleGap((theta * 180) / Math.PI, c) < 6)) continue;
      // Rockfalls come in clusters, not an even ring.
      if (polarNoise(theta, 87, 4) < 0.52) continue;
      const r = this.mesaRadius(theta) + rnd() * 2.5;
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * r;
      boulder(ctx, x, heightAt(x, z) - 0.4, z, 1 + rnd() * 2.2, COL.rock);
    }
  }

  /** A natural sandstone arch: two stacked pillars and a span of boulders. */
  private arch({ builder: b, rnd, block, occlude }: DecorContext): void {
    const { x: ax, z: az } = polar(ARCH.angle, ARCH.radius);
    const yaw = 0.35;
    const span = 4.5;
    const tx = Math.cos(yaw);
    const tz = -Math.sin(yaw);
    for (const side of [-1, 1]) {
      const px = ax + tx * span * side;
      const pz = az + tz * span * side;
      let y = 0;
      for (let k = 0; k < 5; k++) {
        const r = 1.7 - k * 0.12;
        b.dodeca(r, STRATA[(k + (side > 0 ? 1 : 3)) % STRATA.length], { p: [px - tx * side * k * 0.25, y + r * 0.5, pz - tz * side * k * 0.25], s: [1.2, 0.75, 1], r: [0, rnd() * TAU, 0] });
        y += r * 1.15;
      }
      block(px, pz, 1.9);
      occlude(px, pz, 2.2, 0.9);
    }
    for (let k = -2; k <= 2; k++) {
      const r = 1.5 - Math.abs(k) * 0.1;
      b.dodeca(r, STRATA[(k + 5) % STRATA.length], { p: [ax + tx * k * 1.7, 9.4 + (2 - Math.abs(k)) * 0.35, az + tz * k * 1.7], s: [1.3, 0.7, 1.1], r: [0, rnd() * TAU, 0] });
    }
  }

  /** Mesa tops and the land past the canyons get sparse scrub so the horizon isn't bare. */
  private beyond(ctx: DecorContext): void {
    const { rnd, heightAt } = ctx;
    for (let i = 0; i < 300; i++) {
      const p = inRing(rnd, 50, 110);
      if (laneMask(p.x, p.z, DUNE_CANYONS, CANYON_HALF + 1, 0.1, 20) > 0.5) continue;
      const y = heightAt(p.x, p.z);
      const roll = rnd();
      if (roll < 0.35) bush(ctx, p.x, y, p.z, 1, COL.shrub);
      else if (roll < 0.5) cactus(ctx, p.x, y, p.z, 1, COL.cactus);
      else if (roll < 0.6) deadTree(ctx, p.x, y, p.z, 1.1);
      else boulder(ctx, p.x, y, p.z, 0.4 + rnd() * 1.4, COL.rock);
    }
  }
}
