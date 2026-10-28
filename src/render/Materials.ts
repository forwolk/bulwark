import * as THREE from 'three';

/** HDR multiplier applied to glow parts so they exceed the bloom threshold. */
export const GLOW_INTENSITY = 2.6;

/** Surface finish of a model part, stored per vertex. */
export const Finish = {
  /** Painted armour: matte, with fine panel seams. */
  Paint: 0,
  /** Bare machined metal: barrels, pistons, joints. Reflects the environment. */
  Metal: 1,
  /** Wet-looking chitin and bone: glossy but not metallic. */
  Gloss: 2,
} as const;
export type Finish = (typeof Finish)[keyof typeof Finish];

/** Size of the panel-seam grid on painted armour, in model units. */
const PANEL_SIZE = 0.38;
/** How strongly bare metal reflects the environment map; painted parts get a small share. */
const ENV_INTENSITY = 0.85;

const bodyVertexHead = /* glsl */ `
attribute float finish;
varying float vFinish;
varying vec3 vObjPos;
varying vec3 vObjNormal;
`;

const bodyFragmentHead = /* glsl */ `
varying float vFinish;
varying vec3 vObjPos;
varying vec3 vObjNormal;
uniform float uEnvBase;

float panelHash(float n) {
  return fract(sin(n * 91.345) * 47453.21);
}

/** Staggered panel seams projected along the part's dominant axis; fades out when too dense to read. */
float panelSeams(vec3 p, vec3 n) {
  vec3 a = abs(n);
  vec2 q = a.x > a.y && a.x > a.z ? p.zy : (a.y > a.z ? p.xz : p.xy);
  q /= ${PANEL_SIZE.toFixed(3)};
  // Offset alternate rows so seams form a plated, brick-like pattern.
  q.x += panelHash(floor(q.y)) * 0.6;
  vec2 d = 0.5 - abs(fract(q) - 0.5);
  vec2 w = fwidth(q);
  vec2 line = 1.0 - smoothstep(vec2(0.0), w * 1.1, d);
  float density = max(w.x, w.y);
  return max(line.x, line.y) * (1.0 - smoothstep(0.08, 0.18, density));
}
`;

/**
 * Unit and structure shading: per-vertex finishes (painted plate, bare metal, gloss chitin),
 * fine panel seams on paint, environment reflections on metal and a cool rim light that keeps
 * silhouettes readable against busy ground.
 */
function upgradeBodyMaterial(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uEnvBase = { value: ENV_INTENSITY };
    shader.vertexShader = bodyVertexHead + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vFinish = finish;
  vObjPos = position;
  vObjNormal = normal;`);
    shader.fragmentShader = bodyFragmentHead + shader.fragmentShader
      // The env intensity becomes a per-fragment value, so only metal parts mirror the environment.
      .replace('#include <envmap_common_pars_fragment>', THREE.ShaderChunk.envmap_common_pars_fragment.replace('uniform float envMapIntensity;', 'float envMapIntensity;'))
      .replace('void main() {', `void main() {
  float isMetal = 1.0 - step(0.5, abs(vFinish - 1.0));
  float isGloss = step(1.5, vFinish);
  #ifdef USE_ENVMAP
  envMapIntensity = uEnvBase * mix(0.12, 1.0, isMetal);
  #endif`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  if (vFinish < 0.5) diffuseColor.rgb *= 1.0 - panelSeams(vObjPos, vObjNormal) * 0.32;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.34, isMetal);
  roughnessFactor = mix(roughnessFactor, 0.3, isGloss);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor = mix(metalnessFactor, 0.8, isMetal);
  metalnessFactor = mix(metalnessFactor, 0.05, isGloss);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  float rim = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  totalEmissiveRadiance += vec3(0.32, 0.42, 0.55) * rim * rim * rim * 0.45;`);
  };
  material.customProgramCacheKey = () => 'unit-body';
}

const body = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.72, metalness: 0.12 });
upgradeBodyMaterial(body);

/** Shared materials. Models encode colour per vertex, so a handful of materials covers everything. */
export const Materials = {
  body,
  glow: new THREE.MeshBasicMaterial({
    vertexColors: true,
    color: new THREE.Color(GLOW_INTENSITY, GLOW_INTENSITY, GLOW_INTENSITY),
  }),
  /** Saturated reds have low luminance, so hostile glows need a stronger push to bloom. */
  glowHot: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(6, 6, 6) }),
  ghostValid: new THREE.MeshBasicMaterial({ color: 0x4dffb5, transparent: true, opacity: 0.38, depthWrite: false }),
  ghostInvalid: new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.38, depthWrite: false }),
};

/** Gives every body material the environment that metal parts reflect. */
export function setBodyEnvironment(env: THREE.Texture): void {
  Materials.body.envMap = env;
}

/** Per-instance clone of the body material so individual units can flash when hit. */
export function createFlashableBodyMaterial(): THREE.MeshStandardMaterial {
  const material = Materials.body.clone();
  upgradeBodyMaterial(material);
  return material;
}
