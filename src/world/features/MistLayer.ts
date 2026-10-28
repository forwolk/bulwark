import * as THREE from 'three';

const vertexShader = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uGlow;
  uniform float uOpacity;
  uniform float uScale;
  varying vec2 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { s += noise(p) * a; p *= 2.03; a *= 0.5; }
    return s;
  }

  void main() {
    vec2 p = vWorld * uScale;
    float n = fbm(p + vec2(uTime * 0.05, uTime * 0.03));
    float m = fbm(p * 1.7 - vec2(uTime * 0.04, -uTime * 0.06) + n * 1.5);
    float wisps = smoothstep(0.35, 0.85, m);
    // Posterised bands keep the mist in step with the faceted art style.
    wisps = floor(wisps * 5.0) / 5.0;
    vec3 color = mix(uDeep, uGlow, wisps);
    gl_FragColor = vec4(color, uOpacity * (0.55 + wisps * 0.45));
    #include <fog_fragment>
  }
`;

export interface MistOptions {
  height: number;
  size: number;
  deep: number;
  glow: number;
  /** HDR multiplier on the glow colour. */
  intensity: number;
  opacity: number;
  scale: number;
}

/** Animated glowing mist plane filling chasms. */
export class MistLayer {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(o: MistOptions) {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(o.deep) },
          uGlow: { value: new THREE.Color(o.glow).multiplyScalar(o.intensity) },
          uOpacity: { value: o.opacity },
          uScale: { value: o.scale },
        },
      ]),
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    const geo = new THREE.PlaneGeometry(o.size, o.size);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = o.height;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }
}
