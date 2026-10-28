import * as THREE from 'three';
import type { Biome } from '../levels/types';

/** How much a fully occluded spot darkens. */
const OCCLUSION_DEPTH = 0.42;
/** Coarse lattice spacing in texels for the adaptive bake. */
const BLOCK = 4;
/** A block is interpolated when its centre is within this of the corners' blend (0-255 per channel)... */
const CENTRE_ERROR = 4;
/** ...and its corners differ by no more than this, so a sharp edge can't slip between samples. */
const MAX_SPREAD = 40;

/** Bilinear view of the terrain mesh's own grid, so the bake matches the geometry exactly. */
export interface GroundField {
  height(x: number, z: number): number;
  /** 0 on flat ground, 1 on a vertical wall. */
  slope(x: number, z: number): number;
}

/**
 * Bakes the biome's ground colours into a texture several times finer than the terrain mesh,
 * so path edges, grass patches and sand ripples stay crisp instead of smearing between vertices.
 * Covers the square [-size/2, size/2]² in world XZ; row 0 is the -Z edge.
 */
export function bakeGroundTexture(
  biome: Biome,
  field: GroundField,
  occlusion: (x: number, z: number) => number,
  size: number,
  resolution: number,
): THREE.DataTexture {
  const data = new Uint8Array(resolution * resolution * 4);
  const color = new THREE.Color();
  const half = size / 2;
  const texel = size / resolution;
  const evaluate = (i: number, j: number, k: number): void => {
    const x = (i + 0.5) * texel - half;
    const z = (j + 0.5) * texel - half;
    biome.color(x, z, field.height(x, z), field.slope(x, z), color);
    color.multiplyScalar(1 - occlusion(x, z) * OCCLUSION_DEPTH).convertLinearToSRGB();
    data[k] = Math.min(255, color.r * 255 + 0.5);
    data[k + 1] = Math.min(255, color.g * 255 + 0.5);
    data[k + 2] = Math.min(255, color.b * 255 + 0.5);
    data[k + 3] = 255;
  };

  // Most of the ground is smooth colour, so sample a coarse lattice first and only evaluate every
  // texel of a block whose corners disagree. That keeps edges exact at a fraction of the cost.
  const index = (i: number, j: number): number => (Math.min(j, resolution - 1) * resolution + Math.min(i, resolution - 1)) * 4;
  for (let j = 0; j <= resolution; j += BLOCK) {
    for (let i = 0; i <= resolution; i += BLOCK) evaluate(Math.min(i, resolution - 1), Math.min(j, resolution - 1), index(i, j));
  }
  for (let bj = 0; bj < resolution; bj += BLOCK) {
    for (let bi = 0; bi < resolution; bi += BLOCK) {
      const c00 = index(bi, bj);
      const c10 = index(bi + BLOCK, bj);
      const c01 = index(bi, bj + BLOCK);
      const c11 = index(bi + BLOCK, bj + BLOCK);
      // Smooth gradients interpolate well however steep, so test the centre against the blend.
      const mid = BLOCK / 2;
      const centre = index(bi + mid, bj + mid);
      if (bi + mid < resolution && bj + mid < resolution) evaluate(bi + mid, bj + mid, centre);
      let exact = false;
      for (let c = 0; c < 3; c++) {
        const lo = Math.min(data[c00 + c], data[c10 + c], data[c01 + c], data[c11 + c]);
        const hi = Math.max(data[c00 + c], data[c10 + c], data[c01 + c], data[c11 + c]);
        const blend = (data[c00 + c] + data[c10 + c] + data[c01 + c] + data[c11 + c]) / 4;
        if (hi - lo > MAX_SPREAD || Math.abs(data[centre + c] - blend) > CENTRE_ERROR) exact = true;
      }
      for (let j = bj; j < bj + BLOCK; j++) {
        for (let i = bi; i < bi + BLOCK; i++) {
          if ((i === bi && j === bj) || (exact && i === bi + mid && j === bj + mid) || i >= resolution || j >= resolution) continue;
          const k = (j * resolution + i) * 4;
          if (exact) {
            evaluate(i, j, k);
            continue;
          }
          const tx = (i - bi) / BLOCK;
          const tz = (j - bj) / BLOCK;
          for (let c = 0; c < 3; c++) {
            const a = data[c00 + c] + (data[c10 + c] - data[c00 + c]) * tx;
            const b = data[c01 + c] + (data[c11 + c] - data[c01 + c]) * tx;
            data[k + c] = a + (b - a) * tz + 0.5;
          }
          data[k + 3] = 255;
        }
      }
    }
  }
  const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  // The camera looks across the ground at a slant; anisotropy keeps distant detail from blurring.
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
