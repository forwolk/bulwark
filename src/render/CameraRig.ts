import * as THREE from 'three';
import { clamp, damp } from '../core/math';

/** Angled top-down camera with cursor lead, wheel zoom and trauma-based screen shake. */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 700);

  private readonly pitch = THREE.MathUtils.degToRad(57);
  private readonly focus = new THREE.Vector3(0, 0, 2);
  private readonly desiredFocus = new THREE.Vector3();
  private distance = 60;
  private targetDistance = 60;
  private trauma = 0;
  private time = 0;
  private readonly raycaster = new THREE.Raycaster();
  private readonly projected = new THREE.Vector3();

  update(dt: number, pointer: THREE.Vector2, wheel: number): void {
    this.time += dt;
    this.targetDistance = clamp(this.targetDistance + wheel * 4, 40, 78);
    this.distance = damp(this.distance, this.targetDistance, 8, dt);

    // Lead the camera slightly toward the cursor so the player sees more of where they aim.
    this.desiredFocus.set(pointer.x * 6, 0, 2 - pointer.y * 5);
    this.focus.x = damp(this.focus.x, this.desiredFocus.x, 2.5, dt);
    this.focus.z = damp(this.focus.z, this.desiredFocus.z, 2.5, dt);

    const cam = this.camera;
    cam.position.set(
      this.focus.x,
      this.focus.y + Math.sin(this.pitch) * this.distance,
      this.focus.z + Math.cos(this.pitch) * this.distance,
    );
    cam.lookAt(this.focus);

    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const shake = this.trauma * this.trauma;
    if (shake > 0) {
      const t = this.time * 38;
      cam.position.x += (Math.sin(t * 1.13) + Math.sin(t * 2.71) * 0.5) * shake * 1.4;
      cam.position.y += (Math.sin(t * 1.71 + 3) + Math.sin(t * 3.1) * 0.5) * shake * 1.0;
      cam.position.z += Math.sin(t * 1.37 + 7) * shake * 1.2;
      cam.rotation.z += Math.sin(t * 0.93) * shake * 0.03;
    }
  }

  addShake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** World-space ray under the pointer. The level intersects it with its terrain. */
  pointerRay(pointer: THREE.Vector2): THREE.Ray {
    this.raycaster.setFromCamera(pointer, this.camera);
    return this.raycaster.ray;
  }

  /** Ground point the camera looks at. */
  get focusPoint(): THREE.Vector3 {
    return this.focus;
  }

  /** Projects a world position into CSS pixels. Returns false when behind the camera. */
  toScreen(world: THREE.Vector3, out: { x: number; y: number }): boolean {
    this.projected.copy(world).project(this.camera);
    out.x = (this.projected.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-this.projected.y * 0.5 + 0.5) * window.innerHeight;
    return this.projected.z < 1;
  }
}
