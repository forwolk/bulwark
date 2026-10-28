import * as THREE from 'three';

const MAX_HITS = 10;
/** Seconds a hit ripple takes to spread and fade. */
const RIPPLE_LIFE = 1.1;
/** Seconds for the dome to build up from its base ring when it boots. */
const BOOT_TIME = 1.1;

const shared = /* glsl */ `
  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
      mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y),
      u.z);
  }
  float fbm3(vec3 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) { s += noise3(p) * a; p = p * 2.03 + 7.1; a *= 0.5; }
    return s / 0.875;
  }
`;

const domeVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const domeFragment = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uRim;
  uniform vec3 uLow;
  uniform float uHealth;
  uniform float uFlash;
  uniform float uTime;
  uniform float uAlpha;
  uniform float uReveal;
  uniform float uBack;
  uniform vec4 uHits[${MAX_HITS}];
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vDir;
  ${shared}

  // Hex lattice: distance to the cell edge and the cell id.
  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.732))), p.x);
  }
  vec4 hexCell(vec2 uv) {
    vec2 r = vec2(1.0, 1.732);
    vec2 h = r * 0.5;
    vec2 a = mod(uv, r) - h;
    vec2 b = mod(uv - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    return vec4(gv, uv - gv);
  }

  void main() {
    // With MSAA, edge pixels are shaded slightly outside their triangle and varyings get
    // extrapolated (badly so on edge-on triangles). Renormalise and clamp everything derived
    // from them, or terms like the base glow explode into huge HDR values.
    vec3 dir = normalize(vDir);
    float height = clamp(dir.y, 0.0, 1.0);

    // Boot: the dome builds upward from its base, with a hot seam at the growing edge.
    if (height > uReveal) discard;
    float seam = uReveal < 1.0 ? exp(-abs(height - uReveal) * 40.0) : 0.0;

    vec3 V = normalize(cameraPosition - vPosW);
    float facing = clamp(abs(dot(normalize(vNormalW), V)), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.2);

    // Flowing energy: domain-warped noise drifting up and around the dome.
    float t = uTime * 0.22;
    vec3 p = dir * 2.6;
    vec3 warp = vec3(fbm3(p + vec3(0.0, t, 0.0)), fbm3(p + vec3(5.2, -t, 1.3)), 0.0);
    float energy = fbm3(p * 1.7 + warp * 2.2 + vec3(0.0, -t * 2.0, t));
    // Ridges of the noise become thin crackling filaments.
    float ridge = clamp(1.0 - abs(energy * 2.0 - 1.0), 0.0, 1.0);
    float filaments = pow(ridge, 10.0);
    float clouds = smoothstep(0.45, 0.85, energy);

    // Hex lattice projected from above (the camera mostly looks down on the dome).
    vec4 cell = hexCell(dir.xz * 9.0);
    float edge = smoothstep(0.41, 0.49, hexDist(cell.xy));
    // A few cells twinkle at random.
    float twinkle = step(0.992, hash12(cell.zw + floor(uTime * 4.0))) * (1.0 - edge);

    // Hits: a ring racing out, a hot core, and the lattice lighting up around the impact.
    float ripple = 0.0;
    float local = 0.0;
    for (int i = 0; i < ${MAX_HITS}; i++) {
      float age = uHits[i].w;
      if (age < 0.0 || age > ${RIPPLE_LIFE.toFixed(2)}) continue;
      float ang = acos(clamp(dot(dir, uHits[i].xyz), -1.0, 1.0));
      float life = 1.0 - age / ${RIPPLE_LIFE.toFixed(2)};
      // Squared by multiplication: GLSL pow() is undefined for negative bases (NaN on Apple GPUs).
      float front = (ang - age * 2.2) / 0.07;
      ripple += exp(-front * front) * life * 0.9;
      ripple += exp(-ang * ang / 0.01) * max(0.0, 1.0 - age * 5.0) * 1.6;
      local += exp(-ang * ang / 0.12) * life;
    }

    // Glowing band where the dome meets the ground.
    float base = exp(-height * 14.0);

    // Weak shields: colour drains toward amber and the surface stutters.
    float stutter = uHealth < 0.3 ? step(0.5, hash12(vec2(floor(uTime * 18.0), 3.0))) * 0.4 : 0.0;
    vec3 tint = mix(uDeep, uRim, fresnel * 0.9 + filaments * 0.6);
    tint = mix(uLow, tint, smoothstep(0.0, 0.5, uHealth));

    float alpha = 0.035
      + fresnel * 0.5
      + clouds * 0.07
      + filaments * (0.25 + fresnel * 0.4)
      + edge * (0.06 + local * 0.9 + fresnel * 0.1)
      + twinkle * 0.35
      + base * 0.55
      + ripple
      + seam * 0.9
      + uFlash * 0.08;
    float glow = 1.0 + filaments * 1.8 + ripple * 3.0 + local * edge * 3.0 + base * 1.6 + twinkle * 2.0 + seam * 4.0 + uFlash * 0.5;
    alpha *= uAlpha * (1.0 - stutter) * (uBack > 0.5 ? 0.4 : 1.0);
    gl_FragColor = vec4(min(tint * glow, vec3(24.0)), clamp(alpha, 0.0, 1.0));
  }
`;

const ringVertex = /* glsl */ `
  varying vec2 vXY;
  void main() {
    vXY = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ringFragment = /* glsl */ `
  uniform vec3 uRim;
  uniform float uTime;
  uniform float uAlpha;
  uniform float uRadius;
  uniform float uFlash;
  varying vec2 vXY;
  void main() {
    float r = length(vXY) / uRadius;
    float d = r - 1.0;
    float band = exp(-(d * d) / (0.018 * 0.018));
    float halo = exp(-(d * d) / (0.06 * 0.06)) * 0.35;
    float a = atan(vXY.y, vXY.x);
    // Energy pulses chasing each other around the base.
    float dashes = smoothstep(0.55, 1.0, sin(a * 36.0 - uTime * 4.0)) * 0.6 + smoothstep(0.8, 1.0, sin(a * 7.0 + uTime * 1.3));
    float k = (band * (1.0 + dashes) + halo) * uAlpha;
    gl_FragColor = vec4(min(uRim * k * (2.0 + uFlash * 2.0), vec3(24.0)), 1.0);
  }
`;

/**
 * The core's energy dome. Layers: inner back faces for depth, a front shell with flowing
 * energy, crackling filaments, a hex lattice that lights up around hits, ripples, a hard rim
 * and a glowing base, plus an animated ring on the ground. Boots by building upward from the
 * base; weakens toward amber and stutters; vanishes when it collapses.
 */
export class ShieldDome {
  readonly group = new THREE.Group();
  private readonly front: THREE.ShaderMaterial;
  private readonly back: THREE.ShaderMaterial;
  private readonly ring: THREE.ShaderMaterial;
  private readonly hits: THREE.Vector4[];
  private nextHit = 0;
  private flash = 0;
  private time = Math.random() * 10;
  /** Boot progress 0..1 (builds upward), and overall visibility. */
  private reveal = 0;
  private visibility = 0;

  constructor(radius: number, deep: number, rim: number, low: number) {
    this.hits = Array.from({ length: MAX_HITS }, () => new THREE.Vector4(0, 1, 0, -1));
    const uniforms = {
      uDeep: { value: new THREE.Color(deep) },
      uRim: { value: new THREE.Color(rim) },
      uLow: { value: new THREE.Color(low) },
      uHealth: { value: 1 },
      uFlash: { value: 0 },
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uReveal: { value: 0 },
      uBack: { value: 0 },
      uHits: { value: this.hits },
    };
    const make = (side: THREE.Side, back: number): THREE.ShaderMaterial => new THREE.ShaderMaterial({
      vertexShader: domeVertex,
      fragmentShader: domeFragment,
      // Front and back share every uniform except which side they draw.
      uniforms: { ...uniforms, uBack: { value: back } },
      transparent: true,
      depthWrite: false,
      side,
    });
    this.back = make(THREE.BackSide, 1);
    this.front = make(THREE.FrontSide, 0);

    const geo = new THREE.SphereGeometry(radius, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    const backMesh = new THREE.Mesh(geo, this.back);
    const frontMesh = new THREE.Mesh(geo, this.front);
    backMesh.renderOrder = 2;
    frontMesh.renderOrder = 3;

    this.ring = new THREE.ShaderMaterial({
      vertexShader: ringVertex,
      fragmentShader: ringFragment,
      uniforms: {
        uRim: { value: new THREE.Color(rim) },
        uTime: { value: 0 },
        uAlpha: { value: 0 },
        uRadius: { value: radius },
        uFlash: { value: 0 },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const ringGeo = new THREE.RingGeometry(radius * 0.85, radius * 1.15, 128, 1);
    const ringMesh = new THREE.Mesh(ringGeo, this.ring);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.08;
    ringMesh.renderOrder = 1;

    this.group.add(ringMesh, backMesh, frontMesh);
  }

  /** `dir` is the unit direction from the dome centre to the impact. */
  hit(dir: THREE.Vector3, strength: number): void {
    this.hits[this.nextHit].set(dir.x, dir.y, dir.z, 0);
    this.nextHit = (this.nextHit + 1) % MAX_HITS;
    // Flash is capped so a barrage doesn't white out everything under the dome.
    this.flash = Math.min(0.6, this.flash + 0.06 + strength * 1.5);
  }

  /** Restart the boot animation (dome rebuilding from its base). */
  boot(): void {
    this.reveal = 0;
  }

  update(dt: number, health: number, up: boolean): void {
    this.time += dt;
    for (const h of this.hits) if (h.w >= 0) h.w += dt;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.visibility = up ? Math.min(1, this.visibility + dt * 4) : Math.max(0, this.visibility - dt * 3);
    if (up) this.reveal = Math.min(1.05, this.reveal + dt / BOOT_TIME);
    this.group.visible = this.visibility > 0.001;

    for (const m of [this.front, this.back]) {
      const u = m.uniforms;
      u.uTime.value = this.time;
      u.uHealth.value = health;
      u.uFlash.value = this.flash;
      u.uAlpha.value = this.visibility;
      // Reveal runs slightly below the base first, so the ring lights before the dome rises.
      u.uReveal.value = this.reveal * 1.1 - 0.05;
    }
    const r = this.ring.uniforms;
    r.uTime.value = this.time;
    r.uAlpha.value = this.visibility;
    r.uFlash.value = this.flash;
  }
}
