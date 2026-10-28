import * as THREE from 'three';
import type { Biome } from '../levels/types';

const SIZE = 240;
const SEGMENTS = 192;
/** How much a fully occluded spot darkens. */
const OCCLUSION_DEPTH = 0.42;

/**
 * Smooth-shaded heightfield with per-vertex colour. Ground reads as clean colour zones (grass, dirt,
 * sand); the faceted low-poly look comes from the props standing on it.
 */
export function createTerrainMesh(biome: Biome, occlusion: (x: number, z: number) => number): THREE.Mesh {
  const step = SIZE / SEGMENTS;
  const half = SIZE / 2;
  const n = SEGMENTS + 1;

  const positions = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * step - half;
      const z = j * step - half;
      positions.set([x, biome.height(x, z), z], (j * n + i) * 3);
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
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const normals = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(n * n * 3);
  const color = new THREE.Color();
  for (let k = 0; k < n * n; k++) {
    const x = positions[k * 3];
    const y = positions[k * 3 + 1];
    const z = positions[k * 3 + 2];
    biome.color(x, z, y, 1 - normals.getY(k), color);
    color.multiplyScalar(1 - occlusion(x, z) * OCCLUSION_DEPTH);
    colors.set([color.r, color.g, color.b], k * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}
