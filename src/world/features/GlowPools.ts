import * as THREE from 'three';

function createPoolTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export interface PoolSpec {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: number;
  intensity: number;
}

/**
 * Coloured light spilled on the ground around glowing props. A static additive decal per pool:
 * it looks like a point light but costs nothing per pixel elsewhere.
 */
export class GlowPools {
  readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.MeshBasicMaterial;

  constructor(pools: readonly PoolSpec[]) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.material = new THREE.MeshBasicMaterial({
      map: createPoolTexture(),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, Math.max(1, pools.length));
    this.mesh.count = pools.length;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    pools.forEach((p, i) => {
      m.makeScale(p.radius * 2, 1, p.radius * 2).setPosition(p.x, p.y + 0.06, p.z);
      this.mesh.setMatrixAt(i, m);
      this.mesh.setColorAt(i, c.setHex(p.color).multiplyScalar(p.intensity));
    });
    this.mesh.renderOrder = -1;
  }

  /** Slow breathing so the crystals feel alive. */
  update(time: number): void {
    this.material.opacity = 0.85 + Math.sin(time * 1.3) * 0.15;
  }
}
