import * as THREE from 'three';

/** Deepest water the field can represent; anything deeper reads as fully deep. */
export const FIELD_MAX_DEPTH = 6;
/** How far above the surface the field still tracks dry ground, for a clean shoreline. */
export const FIELD_MAX_DRY = 1;
/** Shore distances beyond this read as open water. */
export const FIELD_MAX_SHORE = 5;

/** Something standing in the water that foam should wrap around, like a rock. */
export interface WaterObstacle {
  x: number;
  z: number;
  radius: number;
}

/**
 * Baked water data the shader reads per pixel, covering the square [-extent, extent]²:
 * R: signed depth below the surface (exact enough to draw the waterline itself)
 * G: horizontal distance to the nearest shore or obstacle, for the lapping foam bands
 */
export function bakeWaterField(
  heightAt: (x: number, z: number) => number,
  level: number,
  extent: number,
  texel: number,
  obstacles: readonly WaterObstacle[],
): THREE.DataTexture {
  const n = Math.ceil((extent * 2) / texel);
  const dry = new Uint8Array(n * n);
  const data = new Uint8Array(n * n * 4);
  const worldOf = (i: number): number => (i + 0.5) * texel - extent;

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const depth = level - heightAt(worldOf(i), worldOf(j));
      dry[k] = depth <= 0 ? 1 : 0;
      data[k * 4] = Math.round(THREE.MathUtils.clamp((depth + FIELD_MAX_DRY) / (FIELD_MAX_DEPTH + FIELD_MAX_DRY), 0, 1) * 255);
      data[k * 4 + 3] = 255;
    }
  }
  for (const o of obstacles) {
    const reach = Math.ceil(o.radius / texel);
    const ci = Math.floor((o.x + extent) / texel);
    const cj = Math.floor((o.z + extent) / texel);
    for (let j = cj - reach; j <= cj + reach; j++) {
      for (let i = ci - reach; i <= ci + reach; i++) {
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        if (Math.hypot(worldOf(i) - o.x, worldOf(j) - o.z) <= o.radius) dry[j * n + i] = 1;
      }
    }
  }

  // Two-pass chamfer distance transform: linear time, accurate to a few percent.
  const dist = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) dist[k] = dry[k] ? 0 : 1e9;
  const diagonal = Math.SQRT2;
  const relax = (k: number, i: number, j: number, di: number, dj: number, cost: number): void => {
    const ni = i + di;
    const nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= n || nj >= n) return;
    const d = dist[nj * n + ni] + cost;
    if (d < dist[k]) dist[k] = d;
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      relax(k, i, j, -1, 0, 1);
      relax(k, i, j, 0, -1, 1);
      relax(k, i, j, -1, -1, diagonal);
      relax(k, i, j, 1, -1, diagonal);
    }
  }
  for (let j = n - 1; j >= 0; j--) {
    for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i;
      relax(k, i, j, 1, 0, 1);
      relax(k, i, j, 0, 1, 1);
      relax(k, i, j, 1, 1, diagonal);
      relax(k, i, j, -1, 1, diagonal);
    }
  }
  for (let k = 0; k < n * n; k++) {
    data[k * 4 + 1] = Math.round(Math.min(1, (dist[k] * texel) / FIELD_MAX_SHORE) * 255);
  }

  const texture = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}
