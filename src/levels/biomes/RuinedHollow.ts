import * as THREE from 'three';
import { clamp, lerp, smoothstep, TAU } from '../../core/math';
import { Water } from '../../world/features/Water';
import { fbm } from '../../world/Noise';
import { scatterClutter } from '../clutter';
import { boulder, branch, bush, cairn, crystal, fern, flowers, grassTuft, menhir, paver, pebbles, pine, root, roundTree, slab } from '../props';
import type { Biome, DecorContext } from '../types';
import { crisp, edgeJitter, flecks, patches } from './ground';
import { angleGap, battlefieldRelief, inRing, laneCoords, laneMask, pathDistance, polar, polarNoise } from './shapes';

/** Dirt ramps down the terraces, in degrees. Gates sit on the rim above each. */
export const HOLLOW_RAMPS = [20, 110, 200, 290];
const RAMP_HALF = 4.5;
const TIER_HEIGHT = 3;
const TIER_SPACING = 7.5;
const TIERS = 3;
const RIM = TIER_HEIGHT * TIERS;
const RAVINE_FLOOR = -3.6;
const RAVINE_WATER = -2.5;
const DEG = Math.PI / 180;

interface Ravine {
  from: number;
  to: number;
  radius: number;
}

/** Narrow ravines across the floor with a stream at the bottom. Hazards, placed between the ramps. */
const RAVINES: Ravine[] = [
  { from: 48, to: 90, radius: 27 },
  { from: 140, to: 174, radius: 28 },
  { from: 228, to: 270, radius: 26 },
];

const COL = {
  grass: 0x76a04a,
  grassDark: 0x5e8a3c,
  grassLight: 0x93b65a,
  moss: 0x587d3c,
  stone: [0xa3a29b, 0x8f8e88, 0xb2b1aa],
  dirt: 0xa07850,
  dirtStep: 0x87623f,
  soil: 0x5a5040,
  menhir: 0xc9b58e,
  paving: [0x5d605c, 0x686b66, 0x535652],
  pink: [0xd2557a, 0xe0708f, 0xbd4a6c],
  crystal: [0xffa040, 0x7dff6a],
  rootWood: 0x6e5a3c,
};

const tmp = new THREE.Color();
const tmp2 = new THREE.Color();

/**
 * A green hollow ringed by grey stone terraces and old standing stones. Ground units must come
 * over the rim and down four dirt ramps; ravines on the floor swallow anything knocked into them.
 */
export class RuinedHollow implements Biome {
  floorRadius(theta: number): number {
    return 34 + (polarNoise(theta, 41, 1.7) - 0.5) * 7;
  }

  private tierEdge(theta: number, k: number): number {
    return this.floorRadius(theta) + 1.5 + k * TIER_SPACING;
  }

  private crest(theta: number): number {
    return this.tierEdge(theta, TIERS - 1) + 2.5;
  }

  /** Normalised distance from a ravine's centre line (0 = centre, 1 = lip), or Infinity. */
  private ravineDistance(x: number, z: number): number {
    const r = Math.hypot(x, z);
    let angle = Math.atan2(x, z) / DEG;
    if (angle < 0) angle += 360;
    let best = Infinity;
    for (const f of RAVINES) {
      if (angle < f.from || angle > f.to) continue;
      const t = (angle - f.from) / (f.to - f.from);
      const halfWidth = 1.8 * Math.sqrt(Math.sin(Math.PI * t));
      const centre = f.radius + (fbm(angle * 0.08, f.radius, 2, 61) - 0.5) * 3;
      best = Math.min(best, Math.abs(r - centre) / Math.max(0.05, halfWidth));
    }
    return best;
  }

  private rampMask(x: number, z: number): number {
    return laneMask(x, z, HOLLOW_RAMPS, RAMP_HALF - 0.3, 0.6, 20);
  }

  height(x: number, z: number): number {
    const r = Math.hypot(x, z);
    const theta = Math.atan2(x, z);
    const rn = r + (fbm(x * 0.08, z * 0.08, 2, 43) - 0.5) * 2.5;

    let h = 0;
    for (let k = 0; k < TIERS; k++) {
      const edge = this.tierEdge(theta, k);
      h += TIER_HEIGHT * smoothstep(edge - 0.6, edge + 0.6, rn);
    }
    h += battlefieldRelief(x, z, 47) * (1 - smoothstep(this.floorRadius(theta) - 1, this.floorRadius(theta) + 2, r));
    h += (fbm(x * 0.1, z * 0.1, 2, 47) - 0.5) * 0.3 * smoothstep(this.floorRadius(theta) - 8, this.floorRadius(theta), r);
    const crest = this.crest(theta);
    if (r > crest) h -= Math.min(6, (r - crest) * 0.15);

    for (const a of HOLLOW_RAMPS) {
      const { along, lateral } = laneCoords(x, z, a);
      const rampFloor = this.floorRadius(a * DEG);
      const rampTop = this.crest(a * DEG);
      if (along < rampFloor - 6 || along > rampTop) continue;
      const rampH = clamp((along - (rampFloor - 2)) / (rampTop - rampFloor + 2), 0, 1) * RIM;
      h = lerp(h, rampH, 1 - smoothstep(RAMP_HALF - 0.4, RAMP_HALF + 0.8, lateral));
    }

    const f = this.ravineDistance(x, z);
    if (f < 1.2) h = Math.min(h, lerp(RAVINE_FLOOR, h, smoothstep(0.6, 1.1, f)));
    return h;
  }

  isHazard(x: number, z: number): boolean {
    return this.ravineDistance(x, z) < 0.85;
  }

  color(x: number, z: number, h: number, slope: number, out: THREE.Color): void {
    if (h < -0.6) {
      out.setHex(COL.soil);
      return;
    }
    if (slope > 0.42) {
      const band = Math.floor(h * 0.8 + fbm(x * 0.15, z * 0.15, 2, 3) * 1.2);
      out.setHex(COL.stone[((band % 3) + 3) % 3]);
      return;
    }
    const r = Math.hypot(x, z);
    if (r > this.floorRadius(Math.atan2(x, z)) - 5 && this.rampMask(x, z) > 0) {
      const along = HOLLOW_RAMPS.reduce((best, a) => {
        const c = laneCoords(x, z, a);
        return c.lateral < best.lateral ? c : best;
      }, { along: 0, lateral: Infinity }).along;
      const step = 1 - crisp(((along % 2.6) + 2.6) % 2.6, 0.5, 0.08);
      out.setHex(COL.grass).lerp(tmp.setHex(COL.dirt).lerp(tmp2.setHex(COL.dirtStep), step), this.rampMask(x, z));
      return;
    }
    out.setHex(COL.grass);
    out.lerp(tmp.setHex(COL.grassDark), patches(x, z, 0.045, 0.45, 51));
    out.lerp(tmp.setHex(COL.moss), patches(x, z, 0.09, 0.15, 55) * 0.8);
    out.lerp(tmp.setHex(COL.grassLight), patches(x, z, 0.1, 0.2, 53) * 0.6);
    out.lerp(tmp.setHex(COL.grassLight), flecks(x, z, 0.12, 57) * 0.4);
    // Worn ground around the core and leading to each ramp, with crisp edges.
    const theta = Math.atan2(x, z);
    const jitter = edgeJitter(x, z, 0.45, 59);
    const toRamp = r < this.floorRadius(theta) - 1 ? pathDistance(x, z, HOLLOW_RAMPS, 9, 67) - 1.7 : Infinity;
    const edge = Math.min(r - 10.5, toRamp) + jitter;
    if (edge < 0.9) {
      out.lerp(tmp.setHex(COL.grassDark), crisp(-edge, -0.9) * 0.4);
      tmp.setHex(COL.dirt).lerp(tmp2.setHex(COL.dirtStep), Math.max(flecks(x, z, 0.12, 61) * 0.6, crisp(edge, -0.35)));
      out.lerp(tmp, crisp(-edge, 0));
    }
  }

  decorate(ctx: DecorContext): void {
    const water = new Water({
      level: RAVINE_WATER, shallow: 0x5b8a86, deep: 0x2a4652, depthRange: 1.2, foam: 0xf0f6f2,
      sky: [0x8fb4d9, 0xe4eef4, 0x6f8f6a],
      // The ravines curve around the core, so the streams run around it too.
      swirl: 1.6, laps: 0.35,
    }, ctx.heightAt);
    ctx.group.add(water.group);
    ctx.animate((_dt, time) => water.update(time));

    this.terraceStones(ctx);
    this.stoneCircles(ctx);
    this.floor(ctx);
    this.woods(ctx);
    this.undergrowth(ctx);
    this.rampCairns(ctx);
  }

  private nearRamp(angleDeg: number, margin: number): boolean {
    return HOLLOW_RAMPS.some((a) => angleGap(angleDeg, a) < margin);
  }

  /** Grey slabs along each terrace lip, so the walls read as stacked stone. */
  private terraceStones(ctx: DecorContext): void {
    const { rnd, heightAt } = ctx;
    for (let k = 0; k < TIERS; k++) {
      const steps = 70 + k * 12;
      for (let i = 0; i < steps; i++) {
        const theta = ((i + rnd() * 0.6) / steps) * TAU;
        if (this.nearRamp(theta / DEG, 9) || rnd() < 0.25) continue;
        const r = this.tierEdge(theta, k) + 0.4 + rnd() * 1.2;
        const x = Math.sin(theta) * r;
        const z = Math.cos(theta) * r;
        slab(ctx, x, heightAt(x, z) - 0.5, z, 1.3 + rnd() * 1.3, COL.stone, false);
      }
    }
  }

  /** Two rings of standing stones on the floor, and lone stones on the terraces. */
  private stoneCircles(ctx: DecorContext): void {
    const { rnd, heightAt, isWalkable } = ctx;
    const circles = [polar(150, 27), polar(335, 26)];
    for (const c of circles) {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rnd() * 0.2;
        const x = c.x + Math.sin(a) * 4.2;
        const z = c.z + Math.cos(a) * 4.2;
        if (!isWalkable(x, z)) continue;
        if (rnd() < 0.2) slab(ctx, x, heightAt(x, z), z, 1.4, [COL.menhir]);
        else menhir(ctx, x, heightAt(x, z), z, 0.9 + rnd() * 0.3, COL.menhir);
      }
      slab(ctx, c.x, heightAt(c.x, c.z), c.z, 1.6, COL.stone);
    }
    for (let i = 0; i < 26; i++) {
      const angle = rnd() * 360;
      if (this.nearRamp(angle, 10)) continue;
      const tier = Math.floor(rnd() * TIERS);
      const { x, z } = polar(angle, this.tierEdge(angle * DEG, tier) + 2.5 + rnd() * 4);
      menhir(ctx, x, heightAt(x, z), z, 0.8 + rnd() * 0.4, COL.menhir);
    }
  }

  /** Pink-leaved plants, ferns, roots, flowers and crystals on the hollow floor. */
  private floor(ctx: DecorContext): void {
    const { rnd, heightAt, isWalkable } = ctx;
    const onFloor = (x: number, z: number): number => {
      const r = Math.hypot(x, z);
      if (r < 11.5 || r > this.floorRadius(Math.atan2(x, z)) - 1 || !isWalkable(x, z)) return 0;
      if (this.ravineDistance(x, z) < 1.4 || this.rampMask(x, z) > 0) return 0;
      return pathDistance(x, z, HOLLOW_RAMPS, 9, 67) > 2.5 ? 1 : 0;
    };
    const pink = (c: DecorContext, x: number, y: number, z: number, s: number): void => fern(c, x, y, z, s, COL.pink, 5, 0.9);
    scatterClutter(ctx, {
      count: 800, rMin: 11, rMax: 24, seed: 71, clustering: 0.85,
      density: onFloor,
      kinds: [
        { weight: 5, place: (c, x, y, z) => grassTuft(c, x, y, z, 0.8 + rnd() * 0.5) },
        { weight: 2, place: (c, x, y, z) => pebbles(c, x, y, z, 0.8 + rnd() * 0.6, COL.stone) },
        { weight: 2, place: (c, x, y, z) => pink(c, x, y, z, 0.6 + rnd() * 0.2) },
        { weight: 1.5, place: (c, x, y, z) => fern(c, x, y, z, 0.6 + rnd() * 0.2) },
        { weight: 1, place: (c, x, y, z) => flowers(c, x, y, z) },
        { weight: 0.25, place: (c, x, y, z) => paver(c, x, y, z, 0.6 + rnd() * 0.4, COL.paving) },
      ],
    });
    scatterClutter(ctx, {
      count: 1800, rMin: 22, rMax: 42, seed: 73, clustering: 0.85,
      density: onFloor,
      kinds: [
        { weight: 4, place: (c, x, y, z) => grassTuft(c, x, y, z, 0.9 + rnd() * 0.5) },
        { weight: 3, place: (c, x, y, z) => pink(c, x, y, z, 0.8 + rnd() * 0.3) },
        { weight: 2.5, place: (c, x, y, z) => fern(c, x, y, z, 0.8 + rnd() * 0.3) },
        { weight: 2.5, place: (c, x, y, z) => bush(c, x, y, z, 0.8 + rnd() * 0.5) },
        { weight: 2, place: (c, x, y, z) => pebbles(c, x, y, z, 1 + rnd() * 0.8, COL.stone) },
        { weight: 1, place: (c, x, y, z) => flowers(c, x, y, z) },
        { weight: 1, place: (c, x, y, z) => boulder(c, x, y, z, 0.3 + rnd() * 0.4, COL.stone, false) },
        { weight: 0.6, place: (c, x, y, z) => branch(c, x, y, z, 1.2 + rnd(), COL.rootWood) },
      ],
    });
    // Patches of old dark flagstones, the remains of paved floors.
    for (let i = 0; i < 14; i++) {
      const p = inRing(rnd, 14, 32);
      if (!onFloor(p.x, p.z)) continue;
      const n = 4 + Math.floor(rnd() * 6);
      for (let k = 0; k < n; k++) {
        const x = p.x + (rnd() - 0.5) * 5;
        const z = p.z + (rnd() - 0.5) * 5;
        if (onFloor(x, z)) paver(ctx, x, heightAt(x, z), z, 0.55 + rnd() * 0.45, COL.paving);
      }
    }
    for (let i = 0; i < 9; i++) {
      const p = inRing(rnd, 23, 33);
      if (!isWalkable(p.x, p.z) || this.ravineDistance(p.x, p.z) < 2) continue;
      root(ctx, p.x, heightAt(p.x, p.z), p.z, 3 + rnd() * 3, COL.rootWood);
    }
    for (let i = 0; i < 6; i++) {
      const p = inRing(rnd, 23, 31);
      if (!isWalkable(p.x, p.z) || this.nearRamp(p.theta / DEG, 14) || this.ravineDistance(p.x, p.z) < 2.5) continue;
      slab(ctx, p.x, heightAt(p.x, p.z), p.z, 1.6 + rnd() * 1, COL.stone);
    }
    let crystals = 0;
    for (let i = 0; i < 40 && crystals < 4; i++) {
      const p = inRing(rnd, 24, 31);
      if (!isWalkable(p.x, p.z) || this.nearRamp(p.theta / DEG, 14) || this.ravineDistance(p.x, p.z) < 2.5) continue;
      crystal(ctx, p.x, heightAt(p.x, p.z), p.z, 0.9, COL.crystal[crystals % 2], COL.stone);
      crystals++;
    }
  }

  /** Woods on the terraces and beyond the rim, kept off the ramps. */
  private woods(ctx: DecorContext): void {
    const { rnd, heightAt } = ctx;
    for (let i = 0; i < 1300; i++) {
      const p = inRing(rnd, 36, 112);
      if (p.r < this.floorRadius(p.theta) + 3) continue;
      if (laneMask(p.x, p.z, HOLLOW_RAMPS, RAMP_HALF + 2, 0.1, 20) > 0.5) continue;
      if (fbm(p.x * 0.05, p.z * 0.05, 2, 29) < (p.r < this.crest(p.theta) ? 0.55 : 0.4)) continue;
      const y = heightAt(p.x, p.z);
      const s = 0.9 + rnd() * 0.6;
      if (rnd() < 0.55) pine(ctx, p.x, y, p.z, s);
      else roundTree(ctx, p.x, y, p.z, s);
      ctx.block(p.x, p.z, 0.7);
    }
  }

  /** Undergrowth on the terraces and in the woods past the rim. */
  private undergrowth(ctx: DecorContext): void {
    const { rnd, isWalkable } = ctx;
    scatterClutter(ctx, {
      count: 3000, rMin: 36, rMax: 85, seed: 79, clustering: 0.5,
      density: (x, z) => (Math.hypot(x, z) < this.floorRadius(Math.atan2(x, z)) + 2 || !isWalkable(x, z) || laneMask(x, z, HOLLOW_RAMPS, RAMP_HALF + 1, 0.1, 20) > 0.5 ? 0 : 1),
      kinds: [
        { weight: 4, place: (c, x, y, z) => bush(c, x, y, z, 1 + rnd() * 0.5) },
        { weight: 3, place: (c, x, y, z) => fern(c, x, y, z, 1 + rnd() * 0.3) },
        { weight: 2, place: (c, x, y, z) => fern(c, x, y, z, 1, COL.pink, 5, 0.9) },
        { weight: 2, place: (c, x, y, z) => grassTuft(c, x, y, z, 1.1) },
        { weight: 1.5, place: (c, x, y, z) => pebbles(c, x, y, z, 1.4, COL.stone) },
        { weight: 0.8, place: (c, x, y, z) => branch(c, x, y, z, 1.5 + rnd(), COL.rootWood) },
      ],
    });
  }

  /** Little stone cairns marking both sides of each ramp. */
  private rampCairns(ctx: DecorContext): void {
    const { heightAt } = ctx;
    for (const a of HOLLOW_RAMPS) {
      const fr = this.floorRadius(a * DEG);
      const top = this.crest(a * DEG);
      const ux = Math.sin(a * DEG);
      const uz = Math.cos(a * DEG);
      for (let s = fr; s <= top; s += 5) {
        for (const side of [-1, 1]) {
          const x = ux * s + uz * side * (RAMP_HALF + 0.6);
          const z = uz * s - ux * side * (RAMP_HALF + 0.6);
          cairn(ctx, x, heightAt(ux * s, uz * s), z, 0.7, COL.stone);
        }
      }
    }
  }
}
