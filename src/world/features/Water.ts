import * as THREE from 'three';
import { createSkyReflection } from './skyReflection';

export interface WaterOptions {
  /** Height of the water surface. */
  level: number;
  shallow: number;
  deep: number;
  /** Depth over which shallow fades to deep. */
  depthRange: number;
  foam: number;
  sky: [number, number, number];
}

const EXTENT = 110;
const SURFACE_STEP = 1;
const FOAM_STEP = 1;

/**
 * Still lake water: surface tinted by depth, with white foam lines traced along the shore.
 * Covers every part of the map where the terrain dips below the water level.
 */
export class Water {
  readonly group = new THREE.Group();
  private readonly surface: THREE.MeshStandardMaterial;
  private readonly foamInner: THREE.MeshBasicMaterial;
  private readonly foamOuter: THREE.MeshBasicMaterial;

  constructor(private readonly o: WaterOptions, heightAt: (x: number, z: number) => number) {
    this.surface = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.22,
      metalness: 0.1,
      envMap: createSkyReflection(...o.sky),
      envMapIntensity: 0.55,
    });
    this.group.add(new THREE.Mesh(this.buildSurface(heightAt), this.surface));

    // Contour strips come out with either winding, so foam is two-sided.
    const foam = { color: o.foam, transparent: true, depthWrite: false, side: THREE.DoubleSide };
    this.foamInner = new THREE.MeshBasicMaterial(foam);
    this.foamOuter = new THREE.MeshBasicMaterial(foam);
    const inner = this.buildContour(heightAt, o.level + 0.02, 0.5);
    const outer = this.buildContour(heightAt, o.level - 0.35, 0.32);
    if (inner) this.group.add(new THREE.Mesh(inner, this.foamInner));
    if (outer) this.group.add(new THREE.Mesh(outer, this.foamOuter));
  }

  private buildSurface(heightAt: (x: number, z: number) => number): THREE.BufferGeometry {
    const { level, depthRange } = this.o;
    const shallow = new THREE.Color(this.o.shallow);
    const deep = new THREE.Color(this.o.deep);
    const c = new THREE.Color();
    const pos: number[] = [];
    const col: number[] = [];
    // Depth from a small neighbourhood average, so steep banks still give a soft tint gradient.
    const depthAt = (x: number, z: number): number => {
      let sum = 0;
      for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) sum += Math.max(0, level - heightAt(x + dx, z + dz));
      return sum / 5;
    };
    const vertex = (x: number, z: number): void => {
      const depth = depthAt(x, z);
      c.copy(shallow).lerp(deep, Math.min(1, depth / depthRange));
      pos.push(x, level, z);
      col.push(c.r, c.g, c.b);
    };
    for (let z = -EXTENT; z < EXTENT; z += SURFACE_STEP) {
      for (let x = -EXTENT; x < EXTENT; x += SURFACE_STEP) {
        const s = SURFACE_STEP;
        // Only quads that actually touch water.
        const wet = [heightAt(x, z), heightAt(x + s, z), heightAt(x, z + s), heightAt(x + s, z + s)].some((h) => h < level + 0.1);
        if (!wet) continue;
        vertex(x, z); vertex(x, z + s); vertex(x + s, z);
        vertex(x + s, z); vertex(x, z + s); vertex(x + s, z + s);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
    return geo;
  }

  /** Marching squares along height == `iso`, each segment drawn as a flat strip of `width`. */
  private buildContour(heightAt: (x: number, z: number) => number, iso: number, width: number): THREE.BufferGeometry | null {
    const pos: number[] = [];
    const y = this.o.level + 0.03;
    const s = FOAM_STEP;
    const cross = (ax: number, az: number, ha: number, bx: number, bz: number, hb: number): [number, number] => {
      const t = (iso - ha) / (hb - ha);
      return [ax + (bx - ax) * t, az + (bz - az) * t];
    };
    const strip = (p: [number, number], q: [number, number]): void => {
      let nx = -(q[1] - p[1]);
      let nz = q[0] - p[0];
      const len = Math.hypot(nx, nz) || 1;
      nx = (nx / len) * width * 0.5;
      nz = (nz / len) * width * 0.5;
      // Slight overlap along the segment hides seams between neighbours.
      const ex = ((q[0] - p[0]) / len) * 0.12;
      const ez = ((q[1] - p[1]) / len) * 0.12;
      const a = [p[0] - ex + nx, y, p[1] - ez + nz];
      const b = [p[0] - ex - nx, y, p[1] - ez - nz];
      const c = [q[0] + ex + nx, y, q[1] + ez + nz];
      const d = [q[0] + ex - nx, y, q[1] + ez - nz];
      pos.push(...a, ...b, ...c, ...c, ...b, ...d);
    };

    for (let z = -EXTENT; z < EXTENT; z += s) {
      for (let x = -EXTENT; x < EXTENT; x += s) {
        const h00 = heightAt(x, z);
        const h10 = heightAt(x + s, z);
        const h01 = heightAt(x, z + s);
        const h11 = heightAt(x + s, z + s);
        const pts: [number, number][] = [];
        if ((h00 > iso) !== (h10 > iso)) pts.push(cross(x, z, h00, x + s, z, h10));
        if ((h10 > iso) !== (h11 > iso)) pts.push(cross(x + s, z, h10, x + s, z + s, h11));
        if ((h11 > iso) !== (h01 > iso)) pts.push(cross(x + s, z + s, h11, x, z + s, h01));
        if ((h01 > iso) !== (h00 > iso)) pts.push(cross(x, z + s, h01, x, z, h00));
        if (pts.length >= 2) strip(pts[0], pts[1]);
        if (pts.length === 4) strip(pts[2], pts[3]);
      }
    }
    if (pos.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return geo;
  }

  update(time: number): void {
    // Foam laps: the outer line breathes out of step with the shore line.
    this.foamInner.opacity = 0.85 + Math.sin(time * 1.1) * 0.1;
    this.foamOuter.opacity = 0.3 + Math.sin(time * 1.1 - 1.4) * 0.22;
    this.surface.envMapRotation.y = time * 0.02;
  }
}
