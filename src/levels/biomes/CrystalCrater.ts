import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, smoothstep, TAU } from '../../core/math';
import { fbm } from '../../world/Noise';
import type { Biome, DecorContext } from '../types';
import { angleGap, crystalCluster, groundRibbon, laneCoords, laneMask, polar, polarNoise, rock } from './shapes';

/** Carved ramps down the crater wall, in degrees. Gates sit on the rim above each. */
export const CRATER_RAMPS = [20, 110, 200, 290];
const RAMP_HALF = 4.5;
const TIER_HEIGHT = 3;
const TIER_SPACING = 7.5;
const TIERS = 3;
const RIM = TIER_HEIGHT * TIERS;
const DEG = Math.PI / 180;

interface Fissure {
  from: number;
  to: number;
  radius: number;
}

/** Glowing cracks across the crater floor. Hazards, placed between the ramps. */
const FISSURES: Fissure[] = [
  { from: 48, to: 90, radius: 27 },
  { from: 140, to: 174, radius: 28 },
  { from: 228, to: 270, radius: 26 },
];

const COL = {
  slate: 0x56606f,
  teal: 0x5f7473,
  moss: 0x8a6a8d,
  terrace: 0x66707e,
  risers: [0x3c4455, 0x4a5366, 0x353b4b],
  ramp: 0x7c8592,
  rampStep: 0x5f6774,
  fissure: 0x2a2338,
  fissureDeep: 0x5a2050,
  crystal: 0xff4fd8,
  crystalBase: 0x3a3450,
  stalk: 0x2f4f4c,
  bulb: 0xc8ff6a,
  obelisk: 0x2f3542,
  rock: 0x4a5262,
  rockLight: 0x6b7482,
};

const tmp = new THREE.Color();

/**
 * A terraced impact crater. Ground units must come over the rim and down four carved ramps;
 * glowing fissures on the floor swallow anything knocked into them.
 */
export class CrystalCrater implements Biome {
  floorRadius(theta: number): number {
    return 34 + (polarNoise(theta, 41, 1.7) - 0.5) * 7;
  }

  private crest(theta: number): number {
    return this.floorRadius(theta) + 1.5 + (TIERS - 1) * TIER_SPACING + 2.5;
  }

  /** Normalised distance from a fissure's centre line (0 = centre, 1 = lip), or Infinity. */
  private fissureDistance(x: number, z: number): number {
    const r = Math.hypot(x, z);
    let angle = Math.atan2(x, z) / DEG;
    if (angle < 0) angle += 360;
    let best = Infinity;
    for (const f of FISSURES) {
      if (angle < f.from || angle > f.to) continue;
      const t = (angle - f.from) / (f.to - f.from);
      const halfWidth = 1.4 * Math.sqrt(Math.sin(Math.PI * t));
      const centre = f.radius + (fbm(angle * 0.08, f.radius, 2, 61) - 0.5) * 3;
      best = Math.min(best, Math.abs(r - centre) / Math.max(0.05, halfWidth));
    }
    return best;
  }

  height(x: number, z: number): number {
    const r = Math.hypot(x, z);
    const theta = Math.atan2(x, z);
    const fr = this.floorRadius(theta);
    const rn = r + (fbm(x * 0.08, z * 0.08, 2, 43) - 0.5) * 2.5;

    let h = 0;
    for (let k = 0; k < TIERS; k++) {
      const edge = fr + 1.5 + k * TIER_SPACING;
      h += TIER_HEIGHT * smoothstep(edge - 0.6, edge + 0.6, rn);
    }
    h += (fbm(x * 0.2, z * 0.2, 2, 47) - 0.5) * 0.2 * smoothstep(fr, fr + 2, r);
    const crest = this.crest(theta);
    if (r > crest) h -= Math.min(7, (r - crest) * 0.16);

    for (const a of CRATER_RAMPS) {
      const { along, lateral } = laneCoords(x, z, a);
      const rampFloor = this.floorRadius(a * DEG);
      const rampTop = this.crest(a * DEG);
      if (along < rampFloor - 6 || along > rampTop) continue;
      const rampH = clamp((along - (rampFloor - 2)) / (rampTop - rampFloor + 2), 0, 1) * RIM;
      h = lerp(h, rampH, 1 - smoothstep(RAMP_HALF - 0.4, RAMP_HALF + 0.8, lateral));
    }

    const f = this.fissureDistance(x, z);
    if (f < 1.2) h = Math.min(h, lerp(-3.5, h, smoothstep(0.6, 1.1, f)));
    return h;
  }

  isHazard(x: number, z: number): boolean {
    return this.fissureDistance(x, z) < 0.85;
  }

  color(x: number, z: number, h: number, slope: number, out: THREE.Color): void {
    if (h < -0.8) {
      out.setHex(COL.fissure).lerp(tmp.setHex(COL.fissureDeep), smoothstep(-1, -3.2, h));
      return;
    }
    if (slope > 0.45) {
      const band = Math.floor(h + fbm(x * 0.15, z * 0.15, 2, 3) * 1.2);
      out.setHex(COL.risers[((band % 3) + 3) % 3]);
      return;
    }
    const r = Math.hypot(x, z);
    const fr = this.floorRadius(Math.atan2(x, z));
    if (r > fr - 4 && laneMask(x, z, CRATER_RAMPS, RAMP_HALF - 0.3, 0.2, 20) > 0.5) {
      // Carved steps along the ramps.
      const along = CRATER_RAMPS.reduce((best, a) => {
        const c = laneCoords(x, z, a);
        return c.lateral < best.lateral ? c : best;
      }, { along: 0, lateral: Infinity }).along;
      out.setHex(along % 2.4 < 0.45 ? COL.rampStep : COL.ramp);
      return;
    }
    out.setHex(COL.slate).lerp(tmp.setHex(COL.teal), fbm(x * 0.07, z * 0.07, 3, 51));
    if (h > 1) out.lerp(tmp.setHex(COL.terrace), 0.5);
    const moss = fbm(x * 0.11 + 4, z * 0.11, 3, 53);
    out.lerp(tmp.setHex(COL.moss), smoothstep(0.54, 0.72, moss) * 0.6);
  }

  decorate(ctx: DecorContext): void {
    this.crystals(ctx);
    this.plants(ctx);
    this.obelisks(ctx);
    this.rampMarkers(ctx);
    this.scatter(ctx);
    this.fissureGlow(ctx);
  }

  private nearRamp(angleDeg: number, margin: number): boolean {
    return CRATER_RAMPS.some((a) => angleGap(angleDeg, a) < margin);
  }

  private crystals({ builder: b, rnd, heightAt, isWalkable, block }: DecorContext): void {
    let floor = 0;
    for (let attempt = 0; attempt < 80 && floor < 7; attempt++) {
      const angle = rnd() * 360;
      if (this.nearRamp(angle, 16)) continue;
      const r = 23 + rnd() * 8;
      const { x, z } = polar(angle, r);
      if (r > this.floorRadius(angle * DEG) - 2 || this.fissureDistance(x, z) < 2.5 || !isWalkable(x, z)) continue;
      crystalCluster(b, rnd, x, heightAt(x, z), z, 6 + Math.floor(rnd() * 4), 0.9 + rnd() * 0.5, COL.crystal, COL.crystalBase);
      block(x, z, 1.8);
      floor++;
    }
    for (let i = 0; i < 26; i++) {
      const angle = rnd() * 360;
      if (this.nearRamp(angle, 10)) continue;
      const fr = this.floorRadius(angle * DEG);
      const tier = Math.floor(rnd() * TIERS);
      const { x, z } = polar(angle, fr + 1.5 + tier * TIER_SPACING + 2 + rnd() * 4);
      crystalCluster(b, rnd, x, heightAt(x, z), z, 4 + Math.floor(rnd() * 4), 0.7 + rnd() * 0.6, COL.crystal, COL.crystalBase);
    }
  }

  /** Clumps of stalks with glowing bulbs. */
  private plants({ builder: b, rnd, heightAt, isWalkable }: DecorContext): void {
    for (let i = 0; i < 38; i++) {
      const angle = rnd() * 360;
      const fr = this.floorRadius(angle * DEG);
      const r = 21 + rnd() * (fr + 14 - 21);
      const { x, z } = polar(angle, r);
      if (this.fissureDistance(x, z) < 1.5 || (r < fr && !isWalkable(x, z))) continue;
      const y = heightAt(x, z);
      const n = 3 + Math.floor(rnd() * 5);
      for (let k = 0; k < n; k++) {
        const a = rnd() * TAU;
        const d = rnd() * 0.9;
        const px = x + Math.sin(a) * d;
        const pz = z + Math.cos(a) * d;
        const h = 0.7 + rnd() * 1.3;
        const lean: [number, number, number] = [(rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5];
        b.cyl(0.05, 0.09, h, 4, COL.stalk, { p: [px, y + h / 2, pz], r: lean });
        b.ico(0.11 + rnd() * 0.08, COL.bulb, { p: [px + lean[2] * h * -0.5, y + h, pz + lean[0] * h * 0.5], glow: true });
      }
      b.cone(0.7, 0.35, 5, COL.stalk, { p: [x, y + 0.12, z] });
    }
  }

  /** Ruined obelisks along the rim, lit with runes. */
  private obelisks({ builder: b, rnd, heightAt, block }: DecorContext): void {
    for (let angle = 8; angle < 360; angle += 24 + rnd() * 10) {
      if (this.nearRamp(angle, 12)) continue;
      const { x, z } = polar(angle, this.crest(angle * DEG) - 0.5);
      const y = heightAt(x, z);
      const broken = rnd() < 0.3;
      const h = broken ? 3 + rnd() * 2 : 7 + rnd() * 4;
      const yaw = angle * DEG;
      b.cyl(0.55, 1, h, 4, COL.obelisk, { p: [x, y + h / 2 - 0.3, z], r: [(rnd() - 0.5) * 0.12, yaw + Math.PI / 4, 0] });
      b.box(0.12, h * 0.6, 0.1, rnd() < 0.5 ? COL.bulb : COL.crystal, {
        p: [x - Math.sin(yaw) * 0.62, y + h * 0.52, z - Math.cos(yaw) * 0.62], r: [0, yaw, 0], glow: true,
      });
      b.box(2.2, 0.7, 2.2, COL.rock, { p: [x, y + 0.1, z], r: [0, yaw, 0] });
      if (broken) b.cyl(0.5, 0.6, 3, 4, COL.obelisk, { p: [x + 1.8, y + 0.5, z + 0.6], r: [0.2, rnd(), Math.PI / 2] });
      block(x, z, 1.6);
    }
    // Rock spires on the outer slopes frame the crater from afar.
    for (let i = 0; i < 40; i++) {
      const theta = rnd() * TAU;
      const r = this.crest(theta) + 6 + rnd() * 45;
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * r;
      const h = 4 + rnd() * 14;
      b.cone(1.5 + rnd() * 2, h, 5, rnd() < 0.5 ? COL.rock : COL.obelisk, { p: [x, heightAt(x, z) + h / 2 - 0.5, z], r: [0, rnd() * TAU, 0] });
    }
  }

  /** Small glowing posts along both sides of each ramp, so the lanes read at a glance. */
  private rampMarkers({ builder: b, heightAt }: DecorContext): void {
    for (const a of CRATER_RAMPS) {
      const fr = this.floorRadius(a * DEG);
      const top = this.crest(a * DEG);
      const ux = Math.sin(a * DEG);
      const uz = Math.cos(a * DEG);
      for (let s = fr - 1; s <= top; s += 4) {
        for (const side of [-1, 1]) {
          const x = ux * s + uz * side * (RAMP_HALF + 0.4);
          const z = uz * s - ux * side * (RAMP_HALF + 0.4);
          const y = heightAt(ux * s, uz * s);
          b.box(0.45, 1.1, 0.45, COL.obelisk, { p: [x, y + 0.5, z], r: [0, a * DEG, 0] });
          b.box(0.32, 0.14, 0.32, COL.bulb, { p: [x, y + 1.1, z], r: [0, a * DEG, 0], glow: true });
        }
      }
    }
  }

  private scatter({ builder: b, rnd, heightAt, isWalkable, block }: DecorContext): void {
    for (let i = 0; i < 240; i++) {
      const theta = rnd() * TAU;
      const fr = this.floorRadius(theta);
      const k = Math.floor(rnd() * TIERS);
      const r = fr + 1.5 + k * TIER_SPACING + 0.6 + rnd() * 1.2;
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * r;
      if (this.nearRamp(theta / DEG, 9)) continue;
      rock(b, rnd, x, heightAt(x, z), z, 0.25 + rnd() * 0.6, rnd() < 0.6 ? COL.rock : COL.rockLight);
    }
    for (let i = 0; i < 50; i++) {
      const theta = rnd() * TAU;
      const r = 21 + rnd() * 14;
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * r;
      if (!isWalkable(x, z) || this.fissureDistance(x, z) < 2) continue;
      const size = 0.35 + rnd() * rnd() * 1.6;
      rock(b, rnd, x, heightAt(x, z), z, size, rnd() < 0.5 ? COL.rock : COL.rockLight);
      if (size > 1.1) block(x, z, size);
    }
  }

  /** Magenta light deep in the fissures, pulsing out of step with each other. */
  private fissureGlow({ rnd, heightAt, group, animate }: DecorContext): void {
    const parts: THREE.BufferGeometry[] = [];
    for (const f of FISSURES) {
      const pts: { x: number; z: number }[] = [];
      for (let angle = f.from + 1; angle <= f.to - 1; angle += 1.5) {
        const centre = f.radius + (fbm(angle * 0.08, f.radius, 2, 61) - 0.5) * 3;
        pts.push(polar(angle, centre));
      }
      parts.push(groundRibbon(pts, 1.5, 0.15, (x, z) => Math.max(-3.4, heightAt(x, z))));
    }
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(COL.crystal).multiplyScalar(2.5) });
    group.add(new THREE.Mesh(mergeGeometries(parts), material));
    parts.forEach((g) => g.dispose());
    const base = new THREE.Color(COL.crystal);
    const phase = rnd() * TAU;
    animate((_dt, time) => material.color.copy(base).multiplyScalar(2 + Math.sin(time * 1.1 + phase) * 0.7));
  }
}
