import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lerp, smoothstep, TAU } from '../../core/math';
import { MistLayer } from '../../world/features/MistLayer';
import { fbm } from '../../world/Noise';
import type { Biome, DecorContext } from '../types';
import { angleGap, crystalCluster, groundRibbon, hexColumn, laneCoords, polarNoise, rock, wander } from './shapes';

/** Bridge directions in degrees (0 = bottom of the screen). Gates sit at the far end of each. */
export const BASALT_BRIDGES = [100, 205, 315];
const BRIDGE_HALF = 4.5;
const CHASM_FLOOR = -26;
const DEG = 180 / Math.PI;

const COL = {
  ashLight: 0x8e8a97,
  ashDark: 0x67636f,
  basalt: 0x2f2d36,
  basaltLight: 0x403d48,
  cap: 0x56535f,
  deep: 0x1d1828,
  deepViolet: 0x3a2462,
  plate: 0x3b3843,
  plateLight: 0x4a4752,
  crack: 0x18151e,
  crystal: 0xb36bff,
};

const tmp = new THREE.Color();

/**
 * A plateau of hexagonal basalt ringed by a chasm full of glowing violet mist.
 * Ground units can only cross on three natural column bridges.
 */
export class BasaltRift implements Biome {
  plateauRadius(theta: number): number {
    return 28.5 + (polarNoise(theta, 11, 1.6) - 0.5) * 9;
  }

  outerRadius(theta: number): number {
    return 54 + (polarNoise(theta, 23, 1.6) - 0.5) * 10;
  }

  private chasmFloor(x: number, z: number): number {
    return CHASM_FLOOR + fbm(x * 0.05, z * 0.05, 3, 5) * 6;
  }

  private outerHeight(x: number, z: number, r: number, outer: number): number {
    return 0.4 + Math.max(0, r - outer) * 0.05 + smoothstep(outer, outer + 35, r) * fbm(x * 0.02, z * 0.02, 3, 9) * 14;
  }

  /** Lateral distance to the nearest bridge whose span covers this point, or Infinity. */
  private bridgeLateral(x: number, z: number, pr: number, or: number): number {
    let best = Infinity;
    for (const a of BASALT_BRIDGES) {
      const { along, lateral } = laneCoords(x, z, a);
      if (along > pr - 4 && along < or + 4) best = Math.min(best, lateral);
    }
    return best;
  }

  height(x: number, z: number): number {
    const r = Math.hypot(x, z);
    const theta = Math.atan2(x, z);
    const pr = this.plateauRadius(theta);
    const or = this.outerRadius(theta);
    const floor = this.chasmFloor(x, z);

    let h = (fbm(x * 0.08, z * 0.08, 3, 3) - 0.5) * 0.3 * smoothstep(22, 26, r);
    h = lerp(h, floor, smoothstep(pr, pr + 4, r));
    h = lerp(h, this.outerHeight(x, z, r, or), smoothstep(or - 5, or, r));

    const lateral = this.bridgeLateral(x, z, pr, or);
    if (lateral < BRIDGE_HALF + 3) h = Math.max(h, lerp(0, floor, smoothstep(BRIDGE_HALF, BRIDGE_HALF + 2.5, lateral)));
    return h;
  }

  isHazard(x: number, z: number): boolean {
    return this.height(x, z) < -1.2;
  }

  color(x: number, z: number, h: number, slope: number, out: THREE.Color): void {
    if (h < -1.2 || slope > 0.35) {
      const depth = smoothstep(-2, CHASM_FLOOR, h);
      out.setHex(COL.basalt).lerp(tmp.setHex(COL.deep), depth * 0.85);
      out.lerp(tmp.setHex(COL.deepViolet), smoothstep(-14, -24, h) * 0.75);
      return;
    }
    const n = fbm(x * 0.09, z * 0.09, 3, 31);
    const streak = fbm(x * 0.035 + z * 0.02, z * 0.05, 2, 41);
    out.setHex(COL.ashLight).lerp(tmp.setHex(COL.ashDark), smoothstep(0.38, 0.7, n) * 0.85);
    out.lerp(tmp.setHex(COL.basaltLight), smoothstep(0.55, 0.75, streak) * 0.5);
    // Bridges and the far side of the chasm are bare rock.
    const r = Math.hypot(x, z);
    const theta = Math.atan2(x, z);
    const pr = this.plateauRadius(theta);
    const or = this.outerRadius(theta);
    if (r > or - 3) out.lerp(tmp.setHex(COL.basaltLight), 0.45);
    else if (r > pr && this.bridgeLateral(x, z, pr, or) < BRIDGE_HALF + 1) out.setHex(COL.basaltLight);
  }

  decorate(ctx: DecorContext): void {
    this.hexPavement(ctx);
    this.plateauEdge(ctx);
    this.farEdge(ctx);
    for (const a of BASALT_BRIDGES) this.bridge(ctx, a);
    this.pillarClusters(ctx);
    this.cracks(ctx);
    this.scatter(ctx);
    this.mist(ctx);
  }

  private nearBridge(thetaRad: number, radius: number, margin: number): boolean {
    const deg = thetaRad * DEG;
    return BASALT_BRIDGES.some((a) => angleGap(deg, a) < ((BRIDGE_HALF + margin) / radius) * DEG);
  }

  /** Patches of flush hexagonal plates across the plateau. */
  private hexPavement({ builder: b, rnd }: DecorContext): void {
    const R = 1.9;
    const w = Math.sqrt(3) * R;
    const rowH = 1.5 * R;
    for (let row = -26; row <= 26; row++) {
      const z = row * rowH;
      for (let col = -24; col <= 24; col++) {
        const x = col * w + (row & 1 ? w / 2 : 0);
        const r = Math.hypot(x, z);
        if (r < 8.5 || r > this.plateauRadius(Math.atan2(x, z)) - 1.4) continue;
        const patch = fbm(x * 0.07, z * 0.07, 3, 77);
        if (patch < 0.55 || rnd() < 0.25) continue;
        // Plates rise a little toward the middle of each patch, like weathered column tops.
        const top = 0.04 + rnd() * 0.08 + smoothstep(0.6, 0.75, patch) * rnd() * 0.25;
        const shade = rnd();
        b.cyl(R * 0.9, R * 0.95, 0.6, 6, shade < 0.4 ? COL.plate : shade < 0.8 ? COL.plateLight : COL.basalt, { p: [x, top - 0.3, z] });
      }
    }
  }

  /** Columns stepping down into the chasm, with the odd pillar standing proud of the rim. */
  private plateauEdge({ builder: b, rnd, block }: DecorContext): void {
    const steps = 110;
    const tops = [-0.35, -2.8, -6.5, -11];
    const spread = [0.8, 1.6, 2.6, 4];
    for (let k = 0; k < steps; k++) {
      const theta = ((k + rnd() * 0.5) / steps) * TAU;
      const pr = this.plateauRadius(theta);
      if (this.nearBridge(theta, pr, 1.5)) continue;
      const sx = Math.sin(theta);
      const sz = Math.cos(theta);
      for (let t = 0; t < tops.length; t++) {
        const r = pr + 0.7 + t * 2 + rnd() * 0.6;
        hexColumn(b, sx * r, sz * r, 1.05 + rnd() * 0.3, tops[t] - rnd() * spread[t], CHASM_FLOOR - 6, COL.basalt, COL.cap, rnd());
      }
      if (rnd() < 0.2) {
        const r = pr - 0.9;
        const x = sx * r;
        const z = sz * r;
        hexColumn(b, x, z, 1.1, 1 + rnd() * 3.5, -1, COL.basaltLight, COL.cap, rnd());
        block(x, z, 1.5);
      }
    }
  }

  /** The far wall of the chasm, stepping back up to the outer lands, with tall spires. */
  private farEdge({ builder: b, rnd }: DecorContext): void {
    const steps = 170;
    const drops = [0, 2.5, 6, 10.5];
    for (let k = 0; k < steps; k++) {
      const theta = ((k + rnd() * 0.5) / steps) * TAU;
      const or = this.outerRadius(theta);
      if (this.nearBridge(theta, or, 1.5)) continue;
      const sx = Math.sin(theta);
      const sz = Math.cos(theta);
      for (let t = 0; t < drops.length; t++) {
        const r = or - 0.7 - t * 2 - rnd() * 0.6;
        hexColumn(b, sx * r, sz * r, 1.05 + rnd() * 0.3, 0.1 - drops[t] - rnd() * (1 + t), CHASM_FLOOR - 6, COL.basalt, COL.cap, rnd());
      }
      if (rnd() < 0.18) {
        const r = or + 1 + rnd() * 3;
        hexColumn(b, sx * r, sz * r, 1.2 + rnd() * 0.5, 2 + rnd() * 7, -1, COL.basaltLight, COL.cap, rnd());
      }
    }
    // Distant column stacks on the horizon.
    for (let i = 0; i < 34; i++) {
      const theta = rnd() * TAU;
      const r = 78 + rnd() * 34;
      const cx = Math.sin(theta) * r;
      const cz = Math.cos(theta) * r;
      const base = this.height(cx, cz) - 1;
      const n = 3 + Math.floor(rnd() * 5);
      for (let c = 0; c < n; c++) {
        const a = rnd() * TAU;
        const d = rnd() * 3.5;
        hexColumn(b, cx + Math.sin(a) * d, cz + Math.cos(a) * d, 1.4 + rnd() * 0.8, base + 6 + rnd() * 24, base, COL.basalt, COL.cap, rnd());
      }
    }
  }

  /** A natural bridge of fused columns spanning the chasm. */
  private bridge({ builder: b, rnd, block }: DecorContext, angleDeg: number): void {
    const a = angleDeg / DEG;
    const ux = Math.sin(a);
    const uz = Math.cos(a);
    const px = Math.cos(a);
    const pz = -Math.sin(a);
    const at = (along: number, lateral: number): [number, number] => [ux * along + px * lateral, uz * along + pz * lateral];
    const start = this.plateauRadius(a) - 1;
    const end = this.outerRadius(a) + 1;

    // Deck: the worn tops of fused columns, uneven in height and tone.
    const R = 1.5;
    const w = Math.sqrt(3) * R;
    for (let row = 0, s = start; s <= end; row++, s += 1.5 * R) {
      for (let l = -BRIDGE_HALF; l <= BRIDGE_HALF; l += w) {
        const lateral = l + (row & 1 ? w / 2 : 0);
        if (Math.abs(lateral) > BRIDGE_HALF - 0.4 || rnd() < 0.1) continue;
        const [x, z] = at(s, lateral);
        const shade = rnd();
        b.cyl(R * 0.92, R * 0.97, 0.8, 6, shade < 0.4 ? COL.plate : shade < 0.75 ? COL.plateLight : COL.basalt, {
          p: [x, 0.04 + rnd() * 0.16 - 0.4, z], r: [0, a, 0],
        });
      }
    }
    // Edge columns and supports falling away on both sides.
    for (let s = start + 1; s <= end - 1; s += 2.1) {
      for (const side of [-1, 1]) {
        const [ex, ez] = at(s, side * (BRIDGE_HALF + 0.8));
        hexColumn(b, ex, ez, 1.05, -0.25 - rnd() * 0.8, CHASM_FLOOR - 6, COL.basalt, COL.cap, rnd());
        const [sx, sz] = at(s + 1, side * (BRIDGE_HALF + 2.7));
        hexColumn(b, sx, sz, 1.1, -2.5 - rnd() * 4, CHASM_FLOOR - 6, COL.basalt, COL.cap, rnd());
        if (rnd() < 0.14) {
          const [bx, bz] = at(s, side * (BRIDGE_HALF - 0.5));
          hexColumn(b, bx, bz, 0.9, 1 + rnd() * 1.8, -0.5, COL.basaltLight, COL.cap, rnd());
          block(bx, bz, 1.1);
        }
      }
    }
  }

  /** Clusters of standing columns on the plateau. They block movement and break up enemy lines. */
  private pillarClusters({ builder: b, rnd, block }: DecorContext): void {
    let placed = 0;
    for (let attempt = 0; attempt < 60 && placed < 7; attempt++) {
      const theta = rnd() * TAU;
      const pr = this.plateauRadius(theta);
      if (this.nearBridge(theta, 25, 9) || pr < 26) continue;
      const r = 22.5 + rnd() * Math.max(0, pr - 25);
      const cx = Math.sin(theta) * r;
      const cz = Math.cos(theta) * r;
      const n = 4 + Math.floor(rnd() * 4);
      for (let c = 0; c < n; c++) {
        const a = rnd() * TAU;
        const d = c === 0 ? 0 : 1.2 + rnd() * 1.6;
        const x = cx + Math.sin(a) * d;
        const z = cz + Math.cos(a) * d;
        const radius = 0.85 + rnd() * 0.5;
        hexColumn(b, x, z, radius, 1 + rnd() * 4.5 * (c === 0 ? 1.4 : 1), -0.5, rnd() < 0.5 ? COL.basalt : COL.basaltLight, COL.cap, rnd());
        block(x, z, radius + 0.35);
      }
      placed++;
    }
  }

  /** Violet cracks running in from the rim, pulsing slowly, with crystals where they start. */
  private cracks(ctx: DecorContext): void {
    const { builder: b, rnd, heightAt, group, animate } = ctx;
    const glowParts: THREE.BufferGeometry[] = [];
    const inside = (x: number, z: number): boolean => {
      const r = Math.hypot(x, z);
      return r < 10 || r > this.plateauRadius(Math.atan2(x, z)) - 0.5;
    };
    for (let i = 0; i < 10; i++) {
      const theta = (i / 10) * TAU + rnd() * 0.4;
      const r0 = this.plateauRadius(theta) - 1;
      const pts = wander(rnd, Math.sin(theta) * r0, Math.cos(theta) * r0, theta + Math.PI + (rnd() - 0.5) * 0.6, 12 + Math.floor(rnd() * 8), 1.4, 0.9, inside);
      if (pts.length < 3) continue;
      b.add(groundRibbon(pts, 0.8, 0.03, heightAt), COL.crack);
      glowParts.push(groundRibbon(pts, 0.2, 0.05, heightAt));
      const mid = pts[Math.floor(pts.length / 2)];
      const branch = wander(rnd, mid.x, mid.z, theta + Math.PI + (rnd() < 0.5 ? 1 : -1) * 0.9, 5 + Math.floor(rnd() * 4), 1.2, 1, inside);
      if (branch.length > 2) {
        b.add(groundRibbon(branch, 0.55, 0.03, heightAt), COL.crack);
        glowParts.push(groundRibbon(branch, 0.14, 0.05, heightAt));
      }
      const s = pts[0];
      crystalCluster(b, rnd, s.x, heightAt(s.x, s.z), s.z, 4 + Math.floor(rnd() * 3), 0.55 + rnd() * 0.3, COL.crystal, COL.basalt);
    }

    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(COL.crystal).multiplyScalar(2) });
    const glow = new THREE.Mesh(mergeGeometries(glowParts), material);
    glowParts.forEach((g) => g.dispose());
    group.add(glow);
    const base = new THREE.Color(COL.crystal);
    animate((_dt, time) => material.color.copy(base).multiplyScalar(1.7 + Math.sin(time * 1.4) * 0.6));
  }

  private scatter({ builder: b, rnd, heightAt }: DecorContext): void {
    for (let i = 0; i < 170; i++) {
      const theta = rnd() * TAU;
      const r = 19 + rnd() * 14;
      if (r > this.plateauRadius(theta) - 1) continue;
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * r;
      rock(b, rnd, x, heightAt(x, z), z, 0.22 + rnd() * 0.4, rnd() < 0.6 ? COL.basalt : COL.basaltLight);
    }
    for (let i = 0; i < 140; i++) {
      const theta = rnd() * TAU;
      const r = this.outerRadius(theta) + 2 + rnd() * 40;
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * r;
      rock(b, rnd, x, heightAt(x, z), z, 0.6 + rnd() * 1.6, rnd() < 0.6 ? COL.basalt : COL.basaltLight);
    }
    // Crystal outcrops clinging to the chasm walls.
    for (let i = 0; i < 26; i++) {
      const theta = rnd() * TAU;
      const r = this.plateauRadius(theta) + 2 + rnd() * 3;
      const x = Math.sin(theta) * r;
      const z = Math.cos(theta) * r;
      crystalCluster(b, rnd, x, -3 - rnd() * 8, z, 3 + Math.floor(rnd() * 3), 0.6 + rnd() * 0.5, COL.crystal, COL.basalt);
    }
  }

  private mist({ group, animate }: DecorContext): void {
    const deep = new MistLayer({ height: -14, size: 320, deep: 0x150f22, glow: 0x9b5cff, intensity: 1.5, opacity: 0.92, scale: 0.035 });
    const upper = new MistLayer({ height: -6.5, size: 320, deep: 0x241a35, glow: 0x7d58c9, intensity: 0.7, opacity: 0.3, scale: 0.055 });
    group.add(deep.mesh, upper.mesh);
    animate((_dt, time) => {
      deep.update(time);
      upper.update(time * 1.3);
    });
  }
}
