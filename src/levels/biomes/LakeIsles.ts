import * as THREE from 'three';
import { lerp, smoothstep, TAU } from '../../core/math';
import { Water, type WaterObstacle } from '../../world/features/Water';
import { fbm } from '../../world/Noise';
import { scatterClutter } from '../clutter';
import { boulder, branch, bush, crystal, fern, flowers, grassTuft, log, pebbles, pine, roundTree, stump } from '../props';
import type { Biome, DecorContext } from '../types';
import { crisp, edgeJitter, flecks, patches } from './ground';
import { angleGap, battlefieldRelief, inRing, laneCoords, pathDistance, pathMask, polar, polarNoise } from './shapes';

/** Land bridges to the island, in degrees (0 = bottom of the screen). Gates sit at their far ends. */
export const ISLE_BRIDGES = [100, 205, 315];
const BRIDGE_HALF = 4.5;
const WATER_LEVEL = -0.7;
const LAKE_FLOOR = -4;
const DEG = 180 / Math.PI;
/** Dirt paths in the ground colour: half width, and the radius of the core's clearing. */
const PATH_HALF = 1.9;
const CLEARING = 10.5;

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
  grassDark: 0x587f3a,
  grassDeep: 0x4c7238,
  grassLight: 0x8dae58,
  grassTrodden: 0x7f9348,
  dirt: 0xab7c4e,
  dirtLight: 0xb98b5a,
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
  private readonly rocks: WaterObstacle[] = [];

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
    const lateral = this.bridgeLateral(x, z, ir, or);
    // Ground eases flat where it meets a bridge, so the decks join cleanly.
    const nearBridge = 1 - smoothstep(BRIDGE_HALF, BRIDGE_HALF + 6, lateral);
    // Trodden paths sit slightly sunken, so their edges form soft banks that catch the light.
    const trodden = pathMask(x, z, ISLE_BRIDGES, 1.8, 11, 71) * smoothstep(10, 14, r);
    const land = battlefieldRelief(x, z, 3, 1.3) * (1 - smoothstep(ir - 8, ir - 2, r) * nearBridge) - trodden * 0.35;
    // The far shore rises as a short cliff bank, then into wooded hills.
    const bank = 2.2 * smoothstep(or - 0.5, or + 1.8, r) * (1 - nearBridge);
    const hills = 0.35 + bank + smoothstep(or + 3, or + 28, r) * (fbm(x * 0.03, z * 0.03, 3, 9) * 13 + fbm(x * 0.09, z * 0.09, 2, 11) * 2);

    let h = lerp(land, bed, smoothstep(ir - 0.5, ir + 2.5, r));
    h = lerp(h, hills, smoothstep(or - 3, or + 0.5, r));
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
    // Meadow: a mid green with crisp darker and lighter patches, and the odd fleck of colour.
    out.setHex(COL.grass);
    out.lerp(tmp.setHex(COL.grassDark), patches(x, z, 0.04, 0.45, 13));
    out.lerp(tmp.setHex(COL.grassDeep), patches(x, z, 0.08, 0.18, 15) * 0.7);
    out.lerp(tmp.setHex(COL.grassLight), patches(x, z, 0.1, 0.22, 17) * 0.6);
    out.lerp(tmp.setHex(COL.grassLight), flecks(x, z, 0.12, 19) * 0.5);

    // Dirt paths and the core's clearing, with clean wobbly edges and a trampled verge.
    const jitter = edgeJitter(x, z, 0.45, 5);
    const r = Math.hypot(x, z);
    const edge = Math.min(pathDistance(x, z, ISLE_BRIDGES, 8, 71) - PATH_HALF, r - CLEARING) + jitter;
    if (edge < 0.9) {
      out.lerp(tmp.setHex(COL.grassTrodden), crisp(-edge, -0.9) * 0.6);
      tmp.setHex(COL.dirt).lerp(tmp2.setHex(COL.dirtLight), patches(x, z, 0.12, 0.35, 21));
      tmp.lerp(tmp2.setHex(COL.dirtDark), Math.max(flecks(x, z, 0.1, 23) * 0.6, crisp(edge, -0.35)));
      out.lerp(tmp, crisp(-edge, 0));
    }
    // Exposed earth on the banks, and a strip of beach at the waterline.
    out.lerp(tmp.setHex(COL.bank), crisp(slope + jitter * 0.05, 0.26, 0.03));
    const theta = Math.atan2(x, z);
    if (r > this.islandRadius(theta) - 4 || r > this.shoreRadius(theta) - 4) out.lerp(tmp.setHex(COL.sand), crisp(WATER_LEVEL + 0.55 - jitter * 0.3, h));
  }

  decorate(ctx: DecorContext): void {
    this.forest(ctx);
    this.island(ctx);
    this.shores(ctx);
    this.islets(ctx);

    // After the rocks, so foam can wrap around the ones standing in the water.
    const water = new Water({
      level: WATER_LEVEL, shallow: 0x5e8b8a, deep: 0x2a4458, depthRange: 2.6, foam: 0xf4f8f6,
      sky: [0x8fb4d9, 0xe4eef4, 0x6f8f6a], obstacles: this.rocks,
    }, ctx.heightAt);
    ctx.group.add(water.group);
    ctx.animate((_dt, time) => water.update(time));
  }

  /** A boulder at the water's edge, remembered so the water can foam around it. */
  private waterRock(ctx: DecorContext, x: number, y: number, z: number, size: number): void {
    boulder(ctx, x, y, z, size, undefined, false);
    this.rocks.push({ x, z, radius: size });
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
    scatterClutter(ctx, {
      count: 2600, rMin: 48, rMax: 90, seed: 47, clustering: 0.5,
      density: (x, z) => (Math.hypot(x, z) < this.shoreRadius(Math.atan2(x, z)) + 1 || this.paths(x, z) > 0.2 ? 0 : 1),
      kinds: [
        { weight: 4, place: (c, x, y, z) => bush(c, x, y, z, 1 + rnd() * 0.6) },
        { weight: 3, place: (c, x, y, z) => fern(c, x, y, z, 1 + rnd() * 0.3) },
        { weight: 2, place: (c, x, y, z) => grassTuft(c, x, y, z, 1.1) },
        { weight: 2, place: (c, x, y, z) => pebbles(c, x, y, z, 1.4) },
        { weight: 1, place: (c, x, y, z) => log(c, x, y, z, 2 + rnd() * 2) },
        { weight: 0.8, place: (c, x, y, z) => stump(c, x, y, z, 1.2) },
        { weight: 0.8, place: (c, x, y, z) => boulder(c, x, y, z, 0.5 + rnd() * 0.7, undefined, false) },
        { weight: 0.8, place: (c, x, y, z) => flowers(c, x, y, z) },
      ],
    });
    // A few big grey outcrops in the woods.
    for (let i = 0; i < 7; i++) {
      const p = inRing(rnd, 62, 95);
      if (this.paths(p.x, p.z) > 0) continue;
      const y = heightAt(p.x, p.z);
      for (let k = 0; k < 4; k++) boulder(ctx, p.x + (rnd() - 0.5) * 6, y - 0.5, p.z + (rnd() - 0.5) * 6, 2.5 + rnd() * 2.5);
    }
  }

  /** Off the paths, inside the island's shoreline. */
  private islandGround(x: number, z: number, margin: number): number {
    const r = Math.hypot(x, z);
    if (r < CLEARING + 1 || r > this.islandRadius(Math.atan2(x, z)) - margin) return 0;
    return pathDistance(x, z, ISLE_BRIDGES, 8, 71) > PATH_HALF + 0.7 ? 1 : 0;
  }

  /** Trees round the island's rim, and dense small clutter over the meadow. */
  private island(ctx: DecorContext): void {
    const { rnd, heightAt } = ctx;
    for (let i = 0; i < 70; i++) {
      const p = inRing(rnd, 22, 34);
      if (!this.islandGround(p.x, p.z, 2.5) || fbm(p.x * 0.08, p.z * 0.08, 2, 31) < 0.5) continue;
      const y = heightAt(p.x, p.z);
      if (rnd() < 0.6) pine(ctx, p.x, y, p.z, 0.8 + rnd() * 0.4);
      else roundTree(ctx, p.x, y, p.z, 0.85 + rnd() * 0.3);
      ctx.block(p.x, p.z, 0.8);
    }
    // The build area keeps to low clutter that a structure's base covers.
    scatterClutter(ctx, {
      count: 750, rMin: 11, rMax: 24, seed: 41, clustering: 0.85,
      density: (x, z) => this.islandGround(x, z, 1),
      kinds: [
        { weight: 2, place: (c, x, y, z) => pebbles(c, x, y, z, 0.8 + rnd() * 0.6) },
        { weight: 5, place: (c, x, y, z) => grassTuft(c, x, y, z, 0.8 + rnd() * 0.5) },
        { weight: 1, place: (c, x, y, z) => flowers(c, x, y, z) },
        { weight: 2, place: (c, x, y, z) => fern(c, x, y, z, 0.6 + rnd() * 0.2) },
        { weight: 2, place: (c, x, y, z) => bush(c, x, y, z, 0.7 + rnd() * 0.3) },
        { weight: 0.6, place: (c, x, y, z) => branch(c, x, y, z, 1 + rnd() * 0.8) },
      ],
    });
    scatterClutter(ctx, {
      count: 1300, rMin: 22, rMax: 36, seed: 43, clustering: 0.85,
      density: (x, z) => this.islandGround(x, z, 1),
      kinds: [
        { weight: 1.5, place: (c, x, y, z) => pebbles(c, x, y, z, 1 + rnd() * 0.8) },
        { weight: 3, place: (c, x, y, z) => grassTuft(c, x, y, z, 0.9 + rnd() * 0.5) },
        { weight: 3, place: (c, x, y, z) => bush(c, x, y, z, 0.9 + rnd() * 0.6) },
        { weight: 2.5, place: (c, x, y, z) => fern(c, x, y, z, 0.8 + rnd() * 0.3) },
        { weight: 0.8, place: (c, x, y, z) => flowers(c, x, y, z) },
        { weight: 1, place: (c, x, y, z) => boulder(c, x, y, z, 0.3 + rnd() * 0.45, undefined, false) },
        { weight: 0.8, place: (c, x, y, z) => branch(c, x, y, z, 1.2 + rnd()) },
        { weight: 0.4, place: (c, x, y, z) => log(c, x, y, z, 2 + rnd() * 1.5) },
        { weight: 0.3, place: (c, x, y, z) => stump(c, x, y, z) },
      ],
    });
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
      this.waterRock(ctx, Math.sin(theta) * r, WATER_LEVEL - 0.4, Math.cos(theta) * r, 0.7 + rnd() * 1.2);
    }
    for (let k = 0; k < 120; k++) {
      const theta = (k / 120) * TAU + rnd() * 0.05;
      const or = this.shoreRadius(theta);
      if (this.nearBridge(theta, or, 1) || !clustered(theta, 83) || rnd() < 0.2) continue;
      const r = or - 1 - rnd() * 1.5;
      this.waterRock(ctx, Math.sin(theta) * r, WATER_LEVEL - 0.4, Math.cos(theta) * r, 0.8 + rnd() * 1.5);
    }
    for (const a of ISLE_BRIDGES) {
      const ux = Math.sin(a / DEG);
      const uz = Math.cos(a / DEG);
      for (let s = this.islandRadius(a / DEG); s < this.shoreRadius(a / DEG); s += 2.5) {
        for (const side of [-1, 1]) {
          if (rnd() < 0.65) continue;
          const l = side * (BRIDGE_HALF + 0.6 + rnd());
          this.waterRock(ctx, ux * s + uz * l, WATER_LEVEL - 0.2, uz * s - ux * l, 0.6 + rnd() * 0.9);
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
        this.waterRock(ctx, i.x + Math.sin(a) * i.size * 0.8, -0.3, i.z + Math.cos(a) * i.size * 0.8, 0.6 + rnd() * 0.8);
      }
      bush(ctx, i.x + 1.2, 0.3, i.z - 0.8, 0.9);
    }
  }
}
