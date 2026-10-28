import * as THREE from 'three';
import { lerp, smoothstep, TAU } from '../../core/math';
import { Water } from '../../world/features/Water';
import { fbm } from '../../world/Noise';
import { boulder, bush, crystal, fern, flowers, log, pine, roundTree } from '../props';
import type { Biome, DecorContext } from '../types';
import { angleGap, inRing, laneCoords, pathMask, polar, polarNoise } from './shapes';

/** Land bridges to the island, in degrees (0 = bottom of the screen). Gates sit at their far ends. */
export const ISLE_BRIDGES = [100, 205, 315];
const BRIDGE_HALF = 4.5;
const WATER_LEVEL = -0.7;
const LAKE_FLOOR = -4;
const DEG = 180 / Math.PI;

/** Little rock islands out in the lake, each crowned with a crystal. */
const ISLETS = [
  { angle: 150, r: 41, size: 3.2, crystal: 0xff5a4a },
  { angle: 250, r: 40, size: 2.6, crystal: 0x5dff8a },
  { angle: 40, r: 42, size: 3, crystal: 0xffd34a },
  { angle: 345, r: 39, size: 2.4, crystal: 0x5ad8ff },
  { angle: 75, r: 44, size: 2.2, crystal: 0x5dff8a },
].map((i) => ({ ...i, ...polar(i.angle, i.r) }));

const COL = {
  grass: 0x6f9c48,
  grassDark: 0x5b8a3d,
  grassLight: 0x8dae58,
  dirt: 0xab7c4e,
  dirtDark: 0x8f6541,
  bank: 0x76603f,
  sand: 0xb9a676,
  lakebed: 0x4f5a45,
};

const tmp = new THREE.Color();
const tmp2 = new THREE.Color();

/**
 * A green island in a still lake. Ground units cross on three grassy land bridges;
 * anything knocked into the water sinks.
 */
export class LakeIsles implements Biome {
  islandRadius(theta: number): number {
    return 28.5 + (polarNoise(theta, 11, 1.6) - 0.5) * 9;
  }

  shoreRadius(theta: number): number {
    return 54 + (polarNoise(theta, 23, 1.6) - 0.5) * 10;
  }

  private bridgeLateral(x: number, z: number, ir: number, or: number): number {
    let best = Infinity;
    for (const a of ISLE_BRIDGES) {
      const { along, lateral } = laneCoords(x, z, a);
      if (along > ir - 4 && along < or + 4) best = Math.min(best, lateral);
    }
    return best;
  }

  height(x: number, z: number): number {
    const r = Math.hypot(x, z);
    const theta = Math.atan2(x, z);
    const ir = this.islandRadius(theta);
    const or = this.shoreRadius(theta);
    const bed = LAKE_FLOOR + fbm(x * 0.05, z * 0.05, 3, 5) * 1.5;
    const land = (fbm(x * 0.06, z * 0.06, 3, 3) - 0.5) * 0.5 * smoothstep(22, 26, r);
    const hills = 0.35 + smoothstep(or + 4, or + 30, r) * fbm(x * 0.03, z * 0.03, 3, 9) * 8;

    let h = lerp(land, bed, smoothstep(ir - 0.5, ir + 2.5, r));
    h = lerp(h, hills, smoothstep(or - 3, or + 0.5, r));
    const lateral = this.bridgeLateral(x, z, ir, or);
    if (lateral < BRIDGE_HALF + 3) h = Math.max(h, lerp(0.05, bed, smoothstep(BRIDGE_HALF, BRIDGE_HALF + 2.2, lateral)));
    for (const i of ISLETS) {
      const d = Math.hypot(x - i.x, z - i.z);
      if (d < i.size * 1.6) h = Math.max(h, lerp(0.4, bed, smoothstep(i.size * 0.55, i.size * 1.4, d)));
    }
    return h;
  }

  isHazard(x: number, z: number): boolean {
    return this.height(x, z) < WATER_LEVEL - 0.25;
  }

  private paths(x: number, z: number): number {
    const clearing = 1 - smoothstep(9.5, 11.5, Math.hypot(x, z));
    return Math.max(clearing, pathMask(x, z, ISLE_BRIDGES, 1.8, 8, 71));
  }

  color(x: number, z: number, h: number, slope: number, out: THREE.Color): void {
    if (h < WATER_LEVEL + 0.25) {
      out.setHex(COL.sand).lerp(tmp.setHex(COL.lakebed), smoothstep(WATER_LEVEL + 0.2, LAKE_FLOOR + 1, h));
      return;
    }
    out.setHex(COL.grass).lerp(tmp.setHex(COL.grassDark), smoothstep(0.35, 0.65, fbm(x * 0.035, z * 0.035, 3, 13)));
    out.lerp(tmp.setHex(COL.grassLight), smoothstep(0.58, 0.72, fbm(x * 0.06 + 9, z * 0.06, 2, 17)) * 0.7);
    const dirt = this.paths(x, z);
    if (dirt > 0) out.lerp(tmp.setHex(COL.dirt).lerp(tmp2.setHex(COL.dirtDark), fbm(x * 0.2, z * 0.2, 2, 19) * 0.8), dirt);
    // Exposed earth on the banks.
    out.lerp(tmp.setHex(COL.bank), smoothstep(0.18, 0.4, slope));
  }

  decorate(ctx: DecorContext): void {
    const water = new Water({
      level: WATER_LEVEL, shallow: 0x5e8b8a, deep: 0x23394a, depthRange: 2.6, foam: 0xf4f8f6,
      sky: [0x8fb4d9, 0xe4eef4, 0x6f8f6a],
    }, ctx.heightAt);
    ctx.group.add(water.group);
    ctx.animate((_dt, time) => water.update(time));

    this.forest(ctx);
    this.island(ctx);
    this.shores(ctx);
    this.islets(ctx);
  }

  private nearBridge(thetaRad: number, radius: number, margin: number): boolean {
    const deg = thetaRad * DEG;
    return ISLE_BRIDGES.some((a) => angleGap(deg, a) < ((BRIDGE_HALF + margin) / radius) * DEG);
  }

  /** Dense pine and broadleaf woods on the far shore, with clearings and the trodden paths kept open. */
  private forest(ctx: DecorContext): void {
    const { rnd, heightAt } = ctx;
    for (let i = 0; i < 1400; i++) {
      const p = inRing(rnd, 50, 112);
      if (p.r < this.shoreRadius(p.theta) + 1.5) continue;
      if (fbm(p.x * 0.045, p.z * 0.045, 2, 29) < 0.4 || this.paths(p.x, p.z) > 0.05) continue;
      const y = heightAt(p.x, p.z);
      const s = 0.9 + rnd() * 0.7;
      if (rnd() < 0.62) pine(ctx, p.x, y, p.z, s);
      else roundTree(ctx, p.x, y, p.z, s);
      ctx.block(p.x, p.z, 0.7);
    }
    for (let i = 0; i < 260; i++) {
      const p = inRing(rnd, 55, 100);
      if (p.r < this.shoreRadius(p.theta) + 1 || this.paths(p.x, p.z) > 0.2) continue;
      const y = heightAt(p.x, p.z);
      if (rnd() < 0.6) bush(ctx, p.x, y, p.z, 1 + rnd() * 0.5);
      else fern(ctx, p.x, y, p.z, 1);
    }
    // A few big grey outcrops in the woods.
    for (let i = 0; i < 7; i++) {
      const p = inRing(rnd, 62, 95);
      if (this.paths(p.x, p.z) > 0) continue;
      const y = heightAt(p.x, p.z);
      for (let k = 0; k < 4; k++) boulder(ctx, p.x + (rnd() - 0.5) * 6, y - 0.5, p.z + (rnd() - 0.5) * 6, 2.5 + rnd() * 2.5);
    }
  }

  /** Light dressing on the island: shrubs, ferns, flowers and a few trees, all clear of the paths. */
  private island(ctx: DecorContext): void {
    const { rnd, heightAt } = ctx;
    const spot = (rMin: number, margin: number): { x: number; y: number; z: number } | null => {
      const p = inRing(rnd, rMin, 34);
      if (p.r > this.islandRadius(p.theta) - margin || this.paths(p.x, p.z) > 0.1) return null;
      return { x: p.x, y: heightAt(p.x, p.z), z: p.z };
    };
    for (let i = 0; i < 14; i++) {
      const s = spot(23, 2.5);
      if (s) {
        roundTree(ctx, s.x, s.y, s.z, 0.9 + rnd() * 0.3);
        ctx.block(s.x, s.z, 0.8);
      }
    }
    for (let i = 0; i < 150; i++) {
      const s = spot(11, 1.2);
      if (!s) continue;
      const roll = rnd();
      if (roll < 0.35) bush(ctx, s.x, s.y, s.z);
      else if (roll < 0.6) fern(ctx, s.x, s.y, s.z, 0.8);
      else flowers(ctx, s.x, s.y, s.z);
    }
    for (let i = 0; i < 40; i++) {
      const s = spot(14, 1);
      if (s) boulder(ctx, s.x, s.y, s.z, 0.2 + rnd() * 0.35);
    }
    for (let i = 0; i < 4; i++) {
      const s = spot(23, 2);
      if (s) log(ctx, s.x, s.y, s.z, 2 + rnd() * 1.5);
    }
  }

  /** Grey rocks along both shores and lining the bridges. */
  private shores(ctx: DecorContext): void {
    const { rnd } = ctx;
    // Rocks gather in clusters along the banks rather than ringing them evenly.
    const clustered = (theta: number, seed: number): boolean => polarNoise(theta, seed, 4) > 0.56;
    for (let k = 0; k < 90; k++) {
      const theta = (k / 90) * TAU + rnd() * 0.05;
      const ir = this.islandRadius(theta);
      if (this.nearBridge(theta, ir, 1) || !clustered(theta, 81) || rnd() < 0.2) continue;
      const r = ir + 0.6 + rnd() * 1.4;
      boulder(ctx, Math.sin(theta) * r, WATER_LEVEL - 0.4, Math.cos(theta) * r, 0.7 + rnd() * 1.2, undefined, false);
    }
    for (let k = 0; k < 120; k++) {
      const theta = (k / 120) * TAU + rnd() * 0.05;
      const or = this.shoreRadius(theta);
      if (this.nearBridge(theta, or, 1) || !clustered(theta, 83) || rnd() < 0.2) continue;
      const r = or - 1 - rnd() * 1.5;
      boulder(ctx, Math.sin(theta) * r, WATER_LEVEL - 0.4, Math.cos(theta) * r, 0.8 + rnd() * 1.5, undefined, false);
    }
    for (const a of ISLE_BRIDGES) {
      const ux = Math.sin(a / DEG);
      const uz = Math.cos(a / DEG);
      for (let s = this.islandRadius(a / DEG); s < this.shoreRadius(a / DEG); s += 2.5) {
        for (const side of [-1, 1]) {
          if (rnd() < 0.65) continue;
          const l = side * (BRIDGE_HALF + 0.6 + rnd());
          boulder(ctx, ux * s + uz * l, WATER_LEVEL - 0.2, uz * s - ux * l, 0.6 + rnd() * 0.9, undefined, false);
        }
      }
    }
  }

  private islets(ctx: DecorContext): void {
    const { rnd } = ctx;
    for (const i of ISLETS) {
      crystal(ctx, i.x, 0.3, i.z, 1.1, i.crystal);
      for (let k = 0; k < 4; k++) {
        const a = rnd() * TAU;
        boulder(ctx, i.x + Math.sin(a) * i.size * 0.8, -0.3, i.z + Math.cos(a) * i.size * 0.8, 0.6 + rnd() * 0.8, undefined, false);
      }
      bush(ctx, i.x + 1.2, 0.3, i.z - 0.8, 0.9);
    }
  }
}
