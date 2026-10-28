import * as THREE from 'three';
import type { MoteLayer } from '../levels/types';

const vertexShader = /* glsl */ `
  attribute float aPhase;
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;
  uniform float uSway;
  uniform vec3 uDrift;
  uniform vec3 uCenter;
  uniform vec3 uBox;
  uniform vec2 uHeight;
  varying float vFade;

  void main() {
    // Positions wrap inside a box that follows the camera, so a few hundred motes fill any view.
    vec3 p = position + uDrift * uTime;
    p.x += sin(uTime * 0.7 + aPhase * 6.28) * uSway;
    p.z += cos(uTime * 0.5 + aPhase * 4.1) * uSway;
    p.xz = mod(p.xz - uCenter.xz + uBox.xz * 0.5, uBox.xz) - uBox.xz * 0.5 + uCenter.xz;
    p.y = uHeight.x + mod(p.y - uHeight.x, uHeight.y - uHeight.x);

    // Fade at the edges of the box and of the height band so wrapping never pops.
    vec2 edge = abs(p.xz - uCenter.xz) / (uBox.xz * 0.5);
    float band = (p.y - uHeight.x) / (uHeight.y - uHeight.x);
    vFade = (1.0 - smoothstep(0.75, 1.0, max(edge.x, edge.y))) * smoothstep(0.0, 0.15, band) * (1.0 - smoothstep(0.8, 1.0, band));
    vFade *= 0.6 + 0.4 * sin(uTime * 2.0 + aPhase * 30.0);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 1.6) * vFade;
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

const BOX = new THREE.Vector3(130, 0, 100);

/** Drifting embers, dust or spores. All motion happens in the vertex shader. */
export class AmbientMotes {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(layer: MoteLayer, seed: () => number) {
    const positions = new Float32Array(layer.count * 3);
    const phases = new Float32Array(layer.count);
    for (let i = 0; i < layer.count; i++) {
      positions[i * 3] = (seed() - 0.5) * BOX.x;
      positions[i * 3 + 1] = layer.height[0] + seed() * (layer.height[1] - layer.height[0]);
      positions[i * 3 + 2] = (seed() - 0.5) * BOX.z;
      phases[i] = seed();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: layer.size },
        uScale: { value: 1 },
        uSway: { value: layer.sway },
        uDrift: { value: new THREE.Vector3(...layer.drift) },
        uCenter: { value: new THREE.Vector3() },
        uBox: { value: BOX },
        uHeight: { value: new THREE.Vector2(...layer.height) },
        uColor: { value: new THREE.Color(layer.color).multiplyScalar(layer.intensity) },
      },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  update(time: number, camera: THREE.PerspectiveCamera, center: THREE.Vector3, bufferHeight: number): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uCenter.value.copy(center);
    u.uScale.value = bufferHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
}
