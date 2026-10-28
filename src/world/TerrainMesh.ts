import * as THREE from 'three';
import type { Biome } from '../levels/types';
import { mulberry32 } from './Noise';

const SIZE = 240;
const SEGMENTS = 192;

/**
 * Flat-shaded heightfield. Every triangle gets its own vertices so it can carry a single face colour,
 * which is what gives low-poly terrain its faceted look.
 */
export function createTerrainMesh(biome: Biome): THREE.Mesh {
  const step = SIZE / SEGMENTS;
  const half = SIZE / 2;
  const n = SEGMENTS + 1;
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) heights[j * n + i] = biome.height(i * step - half, j * step - half);
  }

  const triCount = SEGMENTS * SEGMENTS * 2;
  const positions = new Float32Array(triCount * 9);
  const normals = new Float32Array(triCount * 9);
  const colors = new Float32Array(triCount * 9);
  const rnd = mulberry32(4242);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const color = new THREE.Color();
  let t = 0;

  const emit = (ia: number, ja: number, ib: number, jb: number, ic: number, jc: number): void => {
    a.set(ia * step - half, heights[ja * n + ia], ja * step - half);
    b.set(ib * step - half, heights[jb * n + ib], jb * step - half);
    c.set(ic * step - half, heights[jc * n + ic], jc * step - half);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    const normal = ab.cross(ac).normalize();
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    biome.color(cx, cz, cy, 1 - normal.y, color);
    // Subtle per-face jitter sells the faceted look.
    color.multiplyScalar(0.92 + rnd() * 0.14);

    const o = t * 9;
    positions.set([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], o);
    for (let v = 0; v < 3; v++) {
      normals[o + v * 3] = normal.x;
      normals[o + v * 3 + 1] = normal.y;
      normals[o + v * 3 + 2] = normal.z;
      colors[o + v * 3] = color.r;
      colors[o + v * 3 + 1] = color.g;
      colors[o + v * 3 + 2] = color.b;
    }
    t++;
  };

  for (let j = 0; j < SEGMENTS; j++) {
    for (let i = 0; i < SEGMENTS; i++) {
      // Alternate the diagonal so the triangle pattern doesn't form visible stripes.
      if ((i + j) % 2 === 0) {
        emit(i, j, i, j + 1, i + 1, j);
        emit(i + 1, j, i, j + 1, i + 1, j + 1);
      } else {
        emit(i, j, i, j + 1, i + 1, j + 1);
        emit(i, j, i + 1, j + 1, i + 1, j);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
  mesh.receiveShadow = true;
  // Mesas and crater walls throw shadows onto the battlefield.
  mesh.castShadow = true;
  return mesh;
}
