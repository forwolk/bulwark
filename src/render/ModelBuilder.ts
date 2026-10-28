import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Materials } from './Materials';

type Vec3Tuple = [number, number, number];

export interface PartOptions {
  /** Position. */
  p?: Vec3Tuple;
  /** Euler rotation in radians. */
  r?: Vec3Tuple;
  /** Non-uniform scale. Keep components positive so face winding stays correct. */
  s?: Vec3Tuple;
  /** Renders with the unlit, bloom-driving glow material. */
  glow?: boolean;
}

export interface BuiltGeometry {
  body: THREE.BufferGeometry | null;
  glow: THREE.BufferGeometry | null;
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();

/**
 * Assembles low-poly models from primitives. Every primitive is baked (transform + vertex colour)
 * and merged into at most two geometries: lit body and unlit glow. One draw call each.
 */
export class ModelBuilder {
  private readonly bodyParts: THREE.BufferGeometry[] = [];
  private readonly glowParts: THREE.BufferGeometry[] = [];

  add(source: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PartOptions = {}): this {
    const geo = source.index ? source.toNonIndexed() : source;
    if (geo !== source) source.dispose();
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    }

    tmpEuler.set(...(o.r ?? [0, 0, 0]));
    tmpQuat.setFromEuler(tmpEuler);
    tmpPos.set(...(o.p ?? [0, 0, 0]));
    tmpScale.set(...(o.s ?? [1, 1, 1]));
    geo.applyMatrix4(tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));

    tmpColor.set(color);
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    (o.glow ? this.glowParts : this.bodyParts).push(geo);
    return this;
  }

  box(w: number, h: number, d: number, color: THREE.ColorRepresentation, o?: PartOptions): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, o);
  }

  cyl(rTop: number, rBottom: number, h: number, segments: number, color: THREE.ColorRepresentation, o?: PartOptions): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBottom, h, segments), color, o);
  }

  cone(r: number, h: number, segments: number, color: THREE.ColorRepresentation, o?: PartOptions): this {
    return this.add(new THREE.ConeGeometry(r, h, segments), color, o);
  }

  ico(r: number, color: THREE.ColorRepresentation, o?: PartOptions, detail = 0): this {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, o);
  }

  octa(r: number, color: THREE.ColorRepresentation, o?: PartOptions): this {
    return this.add(new THREE.OctahedronGeometry(r), color, o);
  }

  dodeca(r: number, color: THREE.ColorRepresentation, o?: PartOptions): this {
    return this.add(new THREE.DodecahedronGeometry(r), color, o);
  }

  tetra(r: number, color: THREE.ColorRepresentation, o?: PartOptions): this {
    return this.add(new THREE.TetrahedronGeometry(r), color, o);
  }

  torus(r: number, tube: number, color: THREE.ColorRepresentation, o?: PartOptions, segments = 10): this {
    return this.add(new THREE.TorusGeometry(r, tube, 4, segments), color, o);
  }

  build(): BuiltGeometry {
    const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null => {
      if (parts.length === 0) return null;
      const merged = mergeGeometries(parts, false);
      parts.forEach((p) => p.dispose());
      merged.computeBoundingSphere();
      return merged;
    };
    return { body: merge(this.bodyParts), glow: merge(this.glowParts) };
  }
}

export interface PartMaterials {
  body?: THREE.Material;
  glow?: THREE.Material;
}

const partCache = new Map<string, BuiltGeometry>();

/**
 * Returns a Group for a named part, building and caching its geometry on first use.
 * Instances share geometry; materials can be overridden (per-unit hit flash, build ghosts).
 */
export function buildPart(key: string, build: (b: ModelBuilder) => void, materials: PartMaterials = {}): THREE.Group {
  let built = partCache.get(key);
  if (!built) {
    const builder = new ModelBuilder();
    build(builder);
    built = builder.build();
    partCache.set(key, built);
  }
  const group = new THREE.Group();
  if (built.body) {
    const mesh = new THREE.Mesh(built.body, materials.body ?? Materials.body);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (built.glow) {
    group.add(new THREE.Mesh(built.glow, materials.glow ?? Materials.glow));
  }
  return group;
}
