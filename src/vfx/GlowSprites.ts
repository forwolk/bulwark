import * as THREE from 'three';

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.2);
    gl_FragColor = vec4(vColor * a, 1.0);
  }
`;

/** Soft additive halos (explosion glow, muzzle bloom). Complements the hard-edged low-poly particles. */
export class GlowSprites {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly sizes: Float32Array;
  private readonly state: Float32Array; // per sprite: vx, vy, vz, age, life, s0, s1, r, g, b
  private count = 0;

  constructor(private readonly max: number) {
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    this.sizes = new Float32Array(max);
    this.state = new Float32Array(max * 10);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uScale: { value: 1 } },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  spawn(pos: THREE.Vector3, size: number, sizeEnd: number, color: THREE.Color, life: number, vel?: THREE.Vector3): void {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.positions.set([pos.x, pos.y, pos.z], i * 3);
    this.state.set([vel?.x ?? 0, vel?.y ?? 0, vel?.z ?? 0, 0, life, size, sizeEnd, color.r, color.g, color.b], i * 10);
  }

  clear(): void {
    this.count = 0;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, drawingBufferHeight: number): void {
    this.material.uniforms.uScale.value = drawingBufferHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const s = this.state;
    let i = 0;
    while (i < this.count) {
      const o = i * 10;
      s[o + 3] += dt;
      const t = s[o + 3] / s[o + 4];
      if (t >= 1) {
        const last = --this.count;
        if (i !== last) {
          s.copyWithin(o, last * 10, last * 10 + 10);
          this.positions.copyWithin(i * 3, last * 3, last * 3 + 3);
        }
        continue;
      }
      this.positions[i * 3] += s[o] * dt;
      this.positions[i * 3 + 1] += s[o + 1] * dt;
      this.positions[i * 3 + 2] += s[o + 2] * dt;
      const fade = (1 - t) * (1 - t);
      this.colors[i * 3] = s[o + 7] * fade;
      this.colors[i * 3 + 1] = s[o + 8] * fade;
      this.colors[i * 3 + 2] = s[o + 9] * fade;
      this.sizes[i] = s[o + 5] + (s[o + 6] - s[o + 5]) * t;
      i++;
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, this.count);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }
}
