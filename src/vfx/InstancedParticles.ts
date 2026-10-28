import * as THREE from 'three';

/**
 * - velocity: +Z axis follows velocity (or an explicit direction) and stretches with speed. Sparks, tracers, bolts.
 * - tumble: random spinning orientation. Debris, smoke puffs, fireballs.
 * - flat: geometry kept as authored. Ground rings, shock walls.
 */
export type Orientation = 'velocity' | 'tumble' | 'flat';

/** linear: size→sizeEnd. easeOut: fast growth that settles. pop: 0→size quickly, then →sizeEnd. */
export type SizeCurve = 'linear' | 'easeOut' | 'pop';

export interface ParticleParams {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  size: number;
  sizeEnd?: number;
  /** Colours may exceed 1.0 for HDR glow. */
  color: THREE.Color;
  colorEnd?: THREE.Color;
  gravity?: number;
  drag?: number;
  spin?: number;
  /** velocity mode: extra length per unit of speed. */
  stretch?: number;
  /** Fraction of vertical speed kept when hitting the ground. 0 = no ground collision. */
  bounce?: number;
  curve?: SizeCurve;
  /** Vertical scale multiplier (flat/tumble modes). */
  scaleY?: number;
  /** velocity mode: fixed direction + length instead of following velocity (lightning segments). */
  dir?: THREE.Vector3;
  length?: number;
}

const CURVES: Record<SizeCurve, number> = { linear: 0, easeOut: 1, pop: 2 };
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpColor = new THREE.Color();
const BLACK = new THREE.Color(0, 0, 0);

/**
 * Pooled particle system rendered as a single InstancedMesh.
 * State is stored as struct-of-arrays to avoid per-particle allocations.
 */
export class InstancedParticles {
  readonly mesh: THREE.InstancedMesh;
  private count = 0;

  private readonly f: Record<string, Float32Array>;
  private readonly curve: Uint8Array;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    private readonly max: number,
    private readonly orientation: Orientation,
    castShadow = false,
  ) {
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, BLACK);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const fields = ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'age', 'life', 's0', 's1', 'r0', 'g0', 'b0', 'r1', 'g1', 'b1',
      'grav', 'drag', 'spin', 'rx', 'ry', 'rz', 'stretch', 'bounce', 'sy', 'dx', 'dy', 'dz', 'len'];
    this.f = Object.fromEntries(fields.map((k) => [k, new Float32Array(max)]));
    this.curve = new Uint8Array(max);
  }

  get activeCount(): number {
    return this.count;
  }

  spawn(p: ParticleParams): void {
    if (this.count >= this.max) return;
    const i = this.count++;
    const f = this.f;
    f.px[i] = p.x; f.py[i] = p.y; f.pz[i] = p.z;
    f.vx[i] = p.vx ?? 0; f.vy[i] = p.vy ?? 0; f.vz[i] = p.vz ?? 0;
    f.age[i] = 0;
    f.life[i] = p.life;
    f.s0[i] = p.size;
    f.s1[i] = p.sizeEnd ?? p.size;
    f.r0[i] = p.color.r; f.g0[i] = p.color.g; f.b0[i] = p.color.b;
    const end = p.colorEnd ?? p.color;
    f.r1[i] = end.r; f.g1[i] = end.g; f.b1[i] = end.b;
    f.grav[i] = p.gravity ?? 0;
    f.drag[i] = p.drag ?? 0;
    f.spin[i] = p.spin ?? 0;
    f.rx[i] = Math.random() * Math.PI * 2;
    f.ry[i] = Math.random() * Math.PI * 2;
    f.rz[i] = Math.random() * Math.PI * 2;
    f.stretch[i] = p.stretch ?? 0;
    f.bounce[i] = p.bounce ?? 0;
    f.sy[i] = p.scaleY ?? 1;
    f.len[i] = p.length ?? 0;
    if (p.dir) {
      f.dx[i] = p.dir.x; f.dy[i] = p.dir.y; f.dz[i] = p.dir.z;
    }
    this.curve[i] = CURVES[p.curve ?? 'linear'];
  }

  private remove(i: number): void {
    const last = --this.count;
    if (i === last) return;
    for (const arr of Object.values(this.f)) arr[i] = arr[last];
    this.curve[i] = this.curve[last];
  }

  clear(): void {
    this.count = 0;
    this.mesh.count = 0;
  }

  update(dt: number): void {
    const f = this.f;
    let i = 0;
    while (i < this.count) {
      f.age[i] += dt;
      if (f.age[i] >= f.life[i]) {
        this.remove(i);
        continue;
      }
      const t = f.age[i] / f.life[i];

      f.vy[i] -= f.grav[i] * dt;
      if (f.drag[i] > 0) {
        const k = Math.exp(-f.drag[i] * dt);
        f.vx[i] *= k; f.vy[i] *= k; f.vz[i] *= k;
      }
      f.px[i] += f.vx[i] * dt;
      f.py[i] += f.vy[i] * dt;
      f.pz[i] += f.vz[i] * dt;

      if (f.bounce[i] > 0 && f.py[i] < 0.08 && f.vy[i] < 0) {
        f.py[i] = 0.08;
        f.vy[i] = -f.vy[i] * f.bounce[i];
        f.vx[i] *= 0.6;
        f.vz[i] *= 0.6;
        f.spin[i] *= 0.5;
      }

      let size: number;
      switch (this.curve[i]) {
        case 1:
          size = f.s0[i] + (f.s1[i] - f.s0[i]) * (1 - (1 - t) ** 3);
          break;
        case 2:
          size = t < 0.15 ? f.s0[i] * (t / 0.15) : f.s0[i] + (f.s1[i] - f.s0[i]) * ((t - 0.15) / 0.85) ** 2;
          break;
        default:
          size = f.s0[i] + (f.s1[i] - f.s0[i]) * t;
      }

      tmpPos.set(f.px[i], f.py[i], f.pz[i]);
      if (this.orientation === 'velocity') {
        let length: number;
        if (f.len[i] > 0) {
          tmpDir.set(f.dx[i], f.dy[i], f.dz[i]);
          length = f.len[i];
        } else {
          tmpDir.set(f.vx[i], f.vy[i], f.vz[i]);
          const speed = tmpDir.length();
          length = size + speed * f.stretch[i];
          if (speed > 1e-4) tmpDir.multiplyScalar(1 / speed);
          else tmpDir.set(0, 1, 0);
        }
        tmpQuat.setFromUnitVectors(AXIS_Z, tmpDir);
        tmpScale.set(size, size, length);
      } else if (this.orientation === 'tumble') {
        f.rx[i] += f.spin[i] * dt;
        f.ry[i] += f.spin[i] * dt * 0.7;
        tmpQuat.setFromEuler(tmpEuler.set(f.rx[i], f.ry[i], f.rz[i]));
        tmpScale.set(size, size * f.sy[i], size);
      } else {
        tmpQuat.identity();
        tmpScale.set(size, size * f.sy[i], size);
      }
      this.mesh.setMatrixAt(i, tmpMatrix.compose(tmpPos, tmpQuat, tmpScale));
      tmpColor.setRGB(
        f.r0[i] + (f.r1[i] - f.r0[i]) * t,
        f.g0[i] + (f.g1[i] - f.g0[i]) * t,
        f.b0[i] + (f.b1[i] - f.b0[i]) * t,
      );
      this.mesh.setColorAt(i, tmpColor);
      i++;
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
