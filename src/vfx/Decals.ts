import * as THREE from 'three';
import { TAU } from '../core/math';

function createScorchTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  // Jagged low-poly splat: a polygon with random spikes, then a soft radial core.
  ctx.fillStyle = 'rgba(150,150,150,1)';
  ctx.beginPath();
  const spikes = 14;
  for (let i = 0; i <= spikes; i++) {
    const a = (i / spikes) * TAU;
    const r = size * (0.28 + Math.random() * 0.2);
    ctx.lineTo(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r);
  }
  ctx.fill();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.32);
  g.addColorStop(0, 'rgba(235,235,235,1)');
  g.addColorStop(1, 'rgba(235,235,235,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/**
 * Ground scorch marks. Subtractive blending darkens the ground by (1 - texel * colour),
 * so fading the instance colour to black fades the mark out.
 */
export class Decals {
  readonly mesh: THREE.InstancedMesh;
  private readonly ages: Float32Array;
  private next = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private readonly lifetime = 30;

  constructor(private readonly max = 90) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: createScorchTexture(),
      blending: THREE.SubtractiveBlending,
      transparent: true,
      depthWrite: false,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    this.ages = new Float32Array(max).fill(this.lifetime);
    this.mesh.setColorAt(0, this.color.setRGB(0, 0, 0));
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, this.matrix.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, this.color);
    }
  }

  add(pos: THREE.Vector3, size: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.ages[i] = 0;
    const rot = new THREE.Matrix4().makeRotationY(Math.random() * TAU);
    this.matrix.makeScale(size, 1, size).premultiply(rot).setPosition(pos.x, 0.09, pos.z);
    this.mesh.setMatrixAt(i, this.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.ages.fill(this.lifetime);
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.ages[i] >= this.lifetime) {
        this.mesh.setColorAt(i, this.color.setRGB(0, 0, 0));
        continue;
      }
      this.ages[i] += dt;
      const t = this.ages[i] / this.lifetime;
      const strength = 0.55 * (1 - t * t);
      this.mesh.setColorAt(i, this.color.setRGB(strength, strength * 0.95, strength * 0.9));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
