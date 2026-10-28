import * as THREE from 'three';

/** HDR multiplier applied to glow parts so they exceed the bloom threshold. */
export const GLOW_INTENSITY = 2.6;

/** Shared materials. Models encode colour per vertex, so a handful of materials covers everything. */
export const Materials = {
  body: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.78, metalness: 0.15 }),
  glow: new THREE.MeshBasicMaterial({
    vertexColors: true,
    color: new THREE.Color(GLOW_INTENSITY, GLOW_INTENSITY, GLOW_INTENSITY),
  }),
  /** Saturated reds have low luminance, so hostile glows need a stronger push to bloom. */
  glowHot: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(6, 6, 6) }),
  ghostValid: new THREE.MeshBasicMaterial({ color: 0x4dffb5, transparent: true, opacity: 0.38, depthWrite: false }),
  ghostInvalid: new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.38, depthWrite: false }),
};

/** Per-instance clone of the body material so individual units can flash when hit. */
export function createFlashableBodyMaterial(): THREE.MeshStandardMaterial {
  return Materials.body.clone();
}
