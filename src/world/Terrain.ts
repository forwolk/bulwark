import * as THREE from 'three';
import { PALETTE as C } from '../config/palette';
import { smoothstep } from '../core/math';
import { fbm } from './Noise';

/** Height of the terrain. The battlefield (r < 46) stays near y = 0; ridges rise beyond it. */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const detail = fbm(x * 0.06, z * 0.06, 4, 3);
  let h = (detail - 0.5) * 0.5 - 0.12;
  const ridge = smoothstep(46, 95, r);
  h += ridge * (4 + fbm(x * 0.025, z * 0.025, 4, 9) * 22);
  // Gentle dunes in the mid band.
  h += smoothstep(30, 55, r) * Math.max(0, fbm(x * 0.03 + 7, z * 0.03, 3, 5) - 0.45) * 5;
  return h;
}

/** Builds a flat-shaded heightfield with per-face colours based on slope and height. */
export function createTerrain(): THREE.Mesh {
  const size = 320;
  const segments = 140;
  const indexed = new THREE.PlaneGeometry(size, size, segments, segments);
  indexed.rotateX(-Math.PI / 2);
  const geo = indexed.toNonIndexed();
  indexed.dispose();

  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  const normals = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(C.sand);
  const sandDark = new THREE.Color(C.sandDark);
  const rock = new THREE.Color(C.rock);
  const rockLight = new THREE.Color(C.rockLight);
  const face = new THREE.Color();

  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const slope = 1 - normals.getY(i);
    const n = fbm(cx * 0.15, cz * 0.15, 2, 21);

    face.copy(sand).lerp(sandDark, n * 0.9);
    if (slope > 0.12 || cy > 3) face.copy(rock).lerp(rockLight, Math.min(1, cy / 18) * 0.7 + n * 0.3);
    // Subtle per-face jitter sells the faceted look.
    const jitter = 0.9 + Math.random() * 0.16;
    face.multiplyScalar(jitter);

    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = face.r;
      colors[(i + k) * 3 + 1] = face.g;
      colors[(i + k) * 3 + 2] = face.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
  mesh.receiveShadow = true;
  return mesh;
}
