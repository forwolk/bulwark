import * as THREE from 'three';
import { bakeWaterField, FIELD_MAX_DEPTH, FIELD_MAX_DRY, FIELD_MAX_SHORE, type WaterObstacle } from './WaterField';

export type { WaterObstacle } from './WaterField';

export interface WaterOptions {
  /** Height of the water surface. */
  level: number;
  shallow: number;
  deep: number;
  /** Depth over which shallow fades to deep. */
  depthRange: number;
  foam: number;
  sky: [number, number, number];
  /** Rocks and posts standing in the water; foam wraps around them. */
  obstacles?: readonly WaterObstacle[];
  /** Straight surface drift in units/s. Foam and ripples slide along it. */
  flow?: [number, number];
  /** Current circling the map centre in units/s, for streams that follow a ring. */
  swirl?: number;
  /** Strength of the foam bands lapping at the shore, 0-1. */
  laps?: number;
}

const EXTENT = 110;
const SURFACE_STEP = 1;
/** Water field resolution in world units per texel. */
const FIELD_TEXEL = 0.5;

const vertexHead = /* glsl */ `
varying vec3 vWaterPos;
`;

const fragmentHead = /* glsl */ `
uniform sampler2D uField;
uniform float uExtent;
uniform float uTime;
uniform vec2 uFlow;
uniform float uSwirl;
uniform float uLaps;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform float uDepthRange;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
varying vec3 vWaterPos;

float wHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float wNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
}

/** Where a surface point has drifted from, so foam and ripples ride the current. */
vec2 wDrift(vec2 p) {
  vec2 q = p - uFlow * uTime;
  float a = uSwirl * uTime / max(length(p), 1.0);
  return mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
}

/** Hard edge at 'edge', anti-aliased over one pixel's worth of 'v'. */
float wCrisp(float v, float edge) {
  float aa = max(fwidth(v), 1e-4);
  return smoothstep(edge - aa, edge + aa, v);
}

/** Small swell: a few crossing waves, returned as the surface slope (d/dx, d/dz). */
vec2 wSlope(vec2 p, float t) {
  // One shared noise lookup warps every wave, so the crests wander without repeating.
  float warp = wNoise(p * 0.15) * 3.0;
  vec2 s = vec2(0.0);
  vec3 waves[4];
  waves[0] = vec3(0.8, 0.6, 0.55);
  waves[1] = vec3(-0.5, 0.86, 0.9);
  waves[2] = vec3(0.98, -0.2, 1.4);
  waves[3] = vec3(-0.3, -0.95, 2.1);
  for (int i = 0; i < 4; i++) {
    vec2 d = waves[i].xy;
    float k = waves[i].z;
    float phase = dot(d, p) * k + t * (1.1 + k * 0.6) + warp * (1.0 + float(i) * 0.37);
    s += d * cos(phase) / (1.0 + k);
  }
  return s;
}
`;

/** Computes everything the later chunks need from the water field, once per fragment. */
const fragmentSetup = /* glsl */ `
  vec2 wp = vWaterPos.xz;
  vec2 flowed = wDrift(wp);
  vec4 field = texture2D(uField, (wp + uExtent) / (2.0 * uExtent));
  float depth = field.r * ${(FIELD_MAX_DEPTH + FIELD_MAX_DRY).toFixed(2)} - ${FIELD_MAX_DRY.toFixed(2)};
  float shore = field.g * ${FIELD_MAX_SHORE.toFixed(2)};
  float breakUp = wNoise(flowed * 0.9);

  // The waterline itself: a solid rim of foam where the surface meets the ground.
  float rim = 1.0 - wCrisp(depth + (breakUp - 0.5) * 0.12, 0.09);
  // Lapping bands that roll in toward the shore and fade out in open water, broken into dashes.
  float phase = shore * 0.65 + uTime * 0.32 + wNoise(flowed * 0.25) * 1.3;
  float band = fract(phase);
  float lap = wCrisp(band, 0.02) * (1.0 - wCrisp(band, 0.17));
  lap *= (1.0 - smoothstep(0.4, 2.1, shore)) * wCrisp(wNoise(flowed * 0.55 + 3.0), 0.38);
  float foam = clamp(max(rim, lap * uLaps), 0.0, 1.0);

  // Shallows: lighter, see-through water over a sunlit shelf; deep water darkens and turns opaque.
  float deepness = smoothstep(0.0, uDepthRange, depth);
  vec3 water = mix(uShallow, uDeep, deepness);
  water = mix(water, uShallow * 1.18, (1.0 - wCrisp(depth + (breakUp - 0.5) * 0.15, 0.45)) * 0.5);
  float waterAlpha = mix(0.42, 0.94, smoothstep(0.0, uDepthRange * 0.7, depth));
`;

/**
 * Stylised lake water. A baked field of depth and shore distance drives everything per pixel:
 * see-through shallows over the lakebed, darker deep water, a crisp waterline with foam bands
 * lapping at the shore and around rocks, and a gently rippling surface catching sun and sky.
 */
export class Water {
  readonly group = new THREE.Group();
  private readonly uniforms = { uTime: { value: 0 } };

  constructor(o: WaterOptions, heightAt: (x: number, z: number) => number) {
    const field = bakeWaterField(heightAt, o.level, EXTENT, FIELD_TEXEL, o.obstacles ?? []);
    // Phong rather than PBR: water covers a lot of screen, and an analytic sky reflection
    // looks the same in this style for a fraction of the cost of environment-map lookups.
    const material = new THREE.MeshPhongMaterial({
      color: o.shallow,
      specular: 0xb8c8d4,
      shininess: 90,
      transparent: true,
    });
    const shared = {
      uField: { value: field },
      uExtent: { value: EXTENT },
      uTime: this.uniforms.uTime,
      uFlow: { value: new THREE.Vector2(...(o.flow ?? [0, 0])) },
      uSwirl: { value: o.swirl ?? 0 },
      uLaps: { value: o.laps ?? 0.75 },
      uShallow: { value: new THREE.Color(o.shallow) },
      uDeep: { value: new THREE.Color(o.deep) },
      uFoam: { value: new THREE.Color(o.foam) },
      uDepthRange: { value: o.depthRange },
      uSkyZenith: { value: new THREE.Color(o.sky[0]) },
      uSkyHorizon: { value: new THREE.Color(o.sky[1]) },
    };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared);
      shader.vertexShader = vertexHead + shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n  vWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
      shader.fragmentShader = fragmentHead + shader.fragmentShader
        .replace('void main() {', `void main() {\n${fragmentSetup}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb = mix(water, uFoam, foam);
  diffuseColor.a = max(waterAlpha, foam);`)
        .replace('#include <specularmap_fragment>', `#include <specularmap_fragment>
  specularStrength *= 1.0 - foam;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  vec2 slope = wSlope(flowed, uTime) * 0.09 * (1.0 - foam);
  vec3 worldNormal = normalize(vec3(-slope.x, 1.0, -slope.y));
  normal = normalize((viewMatrix * vec4(worldNormal, 0.0)).xyz);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += uFoam * foam * 0.18;`)
        .replace('#include <opaque_fragment>', `
  // Sky reflection with Fresnel: little from above, more toward the horizon.
  vec3 toSurface = normalize(vWaterPos - cameraPosition);
  vec3 reflected = reflect(toSurface, worldNormal);
  vec3 sky = mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.7, reflected.y));
  float fresnel = 0.05 + 0.95 * pow(1.0 - max(dot(-toSurface, worldNormal), 0.0), 5.0);
  outgoingLight = mix(outgoingLight, sky, clamp(fresnel, 0.0, 0.85) * 0.75 * (1.0 - foam));
  #include <opaque_fragment>`);
    };
    // Every water body shares one program; the uniforms differ per instance.
    material.customProgramCacheKey = () => 'stylised-water';

    const mesh = new THREE.Mesh(this.buildSurface(o.level, heightAt), material);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  /** Flat quads over every part of the map where the ground dips below the surface. */
  private buildSurface(level: number, heightAt: (x: number, z: number) => number): THREE.BufferGeometry {
    const pos: number[] = [];
    const s = SURFACE_STEP;
    for (let z = -EXTENT; z < EXTENT; z += s) {
      for (let x = -EXTENT; x < EXTENT; x += s) {
        const wet = [heightAt(x, z), heightAt(x + s, z), heightAt(x, z + s), heightAt(x + s, z + s)].some((h) => h < level + 0.1);
        if (!wet) continue;
        pos.push(x, level, z, x, level, z + s, x + s, level, z, x + s, level, z, x, level, z + s, x + s, level, z + s);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
    return geo;
  }

  update(time: number): void {
    this.uniforms.uTime.value = time;
  }
}
