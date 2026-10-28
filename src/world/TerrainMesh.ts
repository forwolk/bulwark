import * as THREE from 'three';
import type { Biome } from '../levels/types';
import { bakeGroundTexture } from './GroundTexture';

const SIZE = 240;
const SEGMENTS = 192;
/** Ground colour texels across the map: about 4 per unit, 5x finer than the mesh. */
const TEXTURE_RESOLUTION = 1024;
/** Curvature shading: hollows darken, crests brighten. */
const CURVATURE_STRENGTH = 0.55;

/**
 * Smooth-shaded heightfield. Ground colour comes from a baked texture that reads as clean, crisp
 * colour zones (grass, dirt, sand); the vertex colours only carry broad curvature shading.
 * The faceted low-poly look comes from the props standing on it.
 */
export function createTerrainMesh(biome: Biome, occlusion: (x: number, z: number) => number): THREE.Mesh {
  const step = SIZE / SEGMENTS;
  const half = SIZE / 2;
  const n = SEGMENTS + 1;

  const positions = new Float32Array(n * n * 3);
  const uvs = new Float32Array(n * n * 2);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * step - half;
      const z = j * step - half;
      positions.set([x, biome.height(x, z), z], (j * n + i) * 3);
      uvs.set([i / SEGMENTS, j / SEGMENTS], (j * n + i) * 2);
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < SEGMENTS; j++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      // Alternate the diagonal so slopes don't show a directional grain.
      if ((i + j) % 2 === 0) indices.push(a, c, b, b, c, d);
      else indices.push(a, c, d, a, d, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const normals = geo.attributes.normal as THREE.BufferAttribute;
  const heightOf = (i: number, j: number): number => positions[(Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))) * 3 + 1];
  const colors = new Float32Array(n * n * 3);
  for (let k = 0; k < n * n; k++) {
    // Laplacian over a two-cell radius: positive in hollows, negative on crests.
    const i = k % n;
    const j = (k - i) / n;
    const laplacian = (heightOf(i + 2, j) + heightOf(i - 2, j) + heightOf(i, j + 2) + heightOf(i, j - 2) - 4 * heightOf(i, j)) / (4 * step * step);
    colors.fill(1 - Math.max(-0.12, Math.min(0.22, laplacian * CURVATURE_STRENGTH * 4)), k * 3, k * 3 + 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();

  // Bilinear lookups into the mesh grid, so the texture lines up with the geometry it covers.
  const sample = (values: (i: number, j: number) => number, x: number, z: number): number => {
    const fx = Math.min(SEGMENTS - 1e-4, Math.max(0, (x + half) / step));
    const fz = Math.min(SEGMENTS - 1e-4, Math.max(0, (z + half) / step));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const a = values(i, j) + (values(i + 1, j) - values(i, j)) * tx;
    const b = values(i, j + 1) + (values(i + 1, j + 1) - values(i, j + 1)) * tx;
    return a + (b - a) * tz;
  };
  const slopeOf = (i: number, j: number): number => 1 - normals.getY(j * n + i);
  const map = bakeGroundTexture(biome, {
    height: (x, z) => sample(heightOf, x, z),
    slope: (x, z) => sample(slopeOf, x, z),
  }, occlusion, SIZE, TEXTURE_RESOLUTION);

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.95, metalness: 0 }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}
