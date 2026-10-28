import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();

/**
 * Continuous beam for the core's lance mode: a hot inner core inside a wider glow sheath,
 * both additive cylinders stretched between muzzle and end point.
 */
export class LanceBeam {
  readonly group = new THREE.Group();
  private readonly inner: THREE.Mesh;
  private readonly outer: THREE.Mesh;
  private readonly innerMaterial: THREE.MeshBasicMaterial;
  private readonly outerMaterial: THREE.MeshBasicMaterial;
  private time = 0;

  constructor(color: number) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    const additive = { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide };
    this.innerMaterial = new THREE.MeshBasicMaterial({ ...additive, color: new THREE.Color(0xe8fbff).multiplyScalar(3) });
    this.outerMaterial = new THREE.MeshBasicMaterial({ ...additive, color: new THREE.Color(color).multiplyScalar(1.2) });
    this.inner = new THREE.Mesh(geo, this.innerMaterial);
    this.outer = new THREE.Mesh(geo, this.outerMaterial);
    this.group.add(this.inner, this.outer);
    this.group.visible = false;
    this.group.frustumCulled = false;
  }

  /** `power` 0..1 sets thickness and brightness; 0 hides the beam. */
  update(dt: number, from: THREE.Vector3, to: THREE.Vector3, power: number): void {
    this.time += dt;
    this.group.visible = power > 0.02;
    if (!this.group.visible) return;
    dir.subVectors(to, from);
    const len = dir.length();
    dir.multiplyScalar(1 / len);
    this.group.position.copy(from).addScaledVector(dir, len / 2);
    this.group.quaternion.setFromUnitVectors(UP, dir);
    // A fast shimmer keeps the beam from looking like a static tube.
    const flicker = 0.85 + Math.sin(this.time * 55) * 0.1 + Math.sin(this.time * 31) * 0.05;
    this.inner.scale.set(0.07 + power * 0.07, len, 0.07 + power * 0.07);
    this.outer.scale.set((0.18 + power * 0.22) * flicker, len, (0.18 + power * 0.22) * flicker);
    this.innerMaterial.opacity = 0.5 + power * 0.5;
    this.outerMaterial.opacity = (0.2 + power * 0.35) * flicker;
  }
}
