import * as THREE from 'three';
import type { StructureDef } from '../config/structures';
import { rand } from '../core/math';
import { createFlashableBodyMaterial } from '../render/Materials';
import { createStructureModel, type StructureRig } from '../render/models/StructureModels';
import type { Damageable } from './Damageable';
import type { Enemy } from './Enemy';

/** A player-built turret or wall. Weapon behaviour lives in systems/TurretWeapons. */
export class Structure implements Damageable {
  readonly position = new THREE.Vector3();
  readonly radius: number;
  readonly isCore = false;

  readonly rig: StructureRig;
  private readonly material: THREE.MeshStandardMaterial;

  hp: number;
  maxHp: number;
  yaw = rand(0, Math.PI * 2);
  cooldown = 0;
  retargetTimer = 0;
  target: Enemy | null = null;
  muzzleIndex = 0;
  recoil = 0;
  spin = 0;
  spinSpeed = 0;
  private flash = 0;
  private buildAnim = 0;

  constructor(readonly def: StructureDef, x: number, z: number, y = 0) {
    this.radius = def.radius;
    this.hp = this.maxHp = def.hp;
    this.position.set(x, y, z);
    this.material = createFlashableBodyMaterial();
    this.rig = createStructureModel(def.kind, { body: this.material });
    this.rig.root.position.copy(this.position);
    this.rig.root.scale.setScalar(0.01);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  /** Absolute height enemy shots aim at. */
  get aimHeight(): number {
    return this.position.y + 1.2;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.flash = 1;
  }

  repair(fraction: number): void {
    this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - this.hp) * fraction);
  }

  nextMuzzle(out: THREE.Vector3): THREE.Vector3 {
    const muzzles = this.rig.muzzles;
    const m = muzzles[this.muzzleIndex % muzzles.length];
    this.muzzleIndex++;
    this.rig.root.updateMatrixWorld(true);
    return m.getWorldPosition(out);
  }

  animate(dt: number): void {
    // Pop-in when placed: overshoot then settle.
    if (this.buildAnim < 1) {
      this.buildAnim = Math.min(1, this.buildAnim + dt * 3.5);
      const t = this.buildAnim;
      const s = 1 + Math.sin(t * Math.PI) * 0.25 * (1 - t);
      this.rig.root.scale.set(s, t * s, s);
    }

    if (this.rig.head) this.rig.head.rotation.y = this.yaw;
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.spin += this.spinSpeed * dt;
    this.spinSpeed = Math.max(0, this.spinSpeed - dt * 30);

    const barrel = this.rig.barrel;
    if (barrel) {
      switch (this.def.kind) {
        case 'repeater':
          barrel.rotation.z = this.spin;
          barrel.position.z = 0.55 - this.recoil * 0.08;
          break;
        case 'flak':
          barrel.position.z = 0.25 - this.recoil * 0.3;
          break;
        case 'mortar':
          barrel.scale.y = 1 - this.recoil * 0.2;
          break;
        case 'arc':
          barrel.rotation.y += dt * (1 + this.recoil * 12);
          barrel.scale.setScalar(1 + this.recoil * 0.15);
          break;
      }
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 8);
      this.material.emissive.setRGB(this.flash * 1.8, this.flash * 0.4, this.flash * 0.2);
    }
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.rig.root);
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.rig.root);
    this.material.dispose();
  }
}
