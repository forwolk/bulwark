import * as THREE from 'three';

/**
 * Tiny equirectangular sky gradient used as an environment map, so mirror-like liquids reflect
 * the level's sky colours. Three.js prefilters it on first use.
 */
export function createSkyReflection(zenith: number, horizon: number, ground: number): THREE.Texture {
  const width = 64;
  const height = 32;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, css(zenith));
  g.addColorStop(0.47, css(horizon));
  g.addColorStop(0.53, css(ground));
  g.addColorStop(1, css(ground));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  // A soft sun spot gives the liquid a glint.
  const sun = ctx.createRadialGradient(width * 0.72, height * 0.36, 0, width * 0.72, height * 0.36, 6);
  sun.addColorStop(0, 'rgba(255,240,225,1)');
  sun.addColorStop(1, 'rgba(255,240,225,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
