import * as THREE from 'three';
import type { AllyUnitDef, SquadDef } from '../config/squads';
import { angleDelta, damp, rand } from '../core/math';
import { createFlashableBodyMaterial, Materials } from '../render/Materials';
import { createAllyModel, type AllyRig } from '../render/models/AllyModels';
import type { Damageable } from './Damageable';
import type { Enemy } from './Enemy';
import type { Squad } from './Squad';

/** One member of a player squad. Behaviour lives in systems/AllyAI. */
export class Ally implements Damageable {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly isCore = false;
  readonly radius: number;
  readonly rig: AllyRig;
  readonly unit: AllyUnitDef;
  private readonly material: THREE.MeshStandardMaterial;

  hp: number;
  maxHp: number;
  yaw = 0;
  /** Turret yaw in world space (units without a turret just use the hull). */
  aimYaw = 0;
  groundY = 0;
  target: Enemy | null = null;
  retargetTimer = 0;
  cooldown = rand(0, 0.5);
  moving = false;
  /** Orbit phase for flyers circling their post. */
  orbit = rand(0, Math.PI * 2);
  private muzzleIndex = 0;
  private flash = 0;
  private animPhase = rand(0, 10);
  private recoil = 0;
  private spawnAnim = 0;
  private lastYaw = 0;

  constructor(readonly def: SquadDef, readonly squad: Squad, readonly slot: number, x: number, z: number, groundY: number) {
    this.unit = def.unit;
    this.radius = def.unit.radius;
    this.hp = this.maxHp = def.unit.hp;
    this.groundY = groundY;
    this.material = createFlashableBodyMaterial();
    this.rig = createAllyModel(def.kind, { body: this.material, glow: Materials.glow });
    this.position.set(x, groundY + def.unit.altitude, z);
    this.yaw = this.aimYaw = Math.atan2(x, z);
    this.rig.root.scale.setScalar(0.01);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  get flying(): boolean {
    return this.unit.flying;
  }

  /** Absolute height enemy shots aim at. */
  get aimHeight(): number {
    return this.position.y + this.unit.aimHeight;
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
    const m = muzzles[this.muzzleIndex++ % muzzles.length];
    this.rig.root.updateMatrixWorld(true);
    this.recoil = 1;
    return m.getWorldPosition(out);
  }

  animate(dt: number): void {
    // Warp-in: grow from nothing with a small overshoot.
    if (this.spawnAnim < 1) {
      this.spawnAnim = Math.min(1, this.spawnAnim + dt * 3);
      const t = this.spawnAnim;
      this.rig.root.scale.setScalar(t + Math.sin(t * Math.PI) * 0.2 * (1 - t));
    }

    const { rig, unit } = this;
    this.animPhase += dt * (this.moving ? unit.speed * 1.4 : 1.5);
    const p = this.animPhase;
    const hover = unit.flying ? Math.sin(p * 0.6) * 0.3 : 0;
    this.position.y = this.groundY + unit.altitude + hover;
    rig.root.position.copy(this.position);
    rig.root.rotation.y = this.yaw;

    switch (rig.motion) {
      case 'hover':
        rig.body.position.y = rig.bodyY + Math.sin(p * 2) * 0.06;
        rig.body.rotation.x = this.moving ? 0.08 : 0;
        break;
      case 'walk':
        for (let i = 0; i < rig.limbs.length; i++) {
          const phase = p + i * Math.PI;
          rig.limbs[i].rotation.x = this.moving ? Math.sin(phase) * 0.45 : 0;
          const knee = rig.joints[i];
          if (knee) knee.rotation.x = this.moving ? -Math.max(0, Math.cos(phase)) * 0.55 : 0;
        }
        rig.body.position.y = rig.bodyY + Math.abs(Math.sin(p)) * (this.moving ? 0.12 : 0.03) - this.recoil * 0.1;
        break;
      case 'fly': {
        // Bank into turns.
        const turnRate = angleDelta(this.lastYaw, this.yaw) / Math.max(dt, 1e-3);
        rig.body.rotation.z = damp(rig.body.rotation.z, THREE.MathUtils.clamp(-turnRate * 0.35, -0.7, 0.7), 6, dt);
        break;
      }
    }
    this.lastYaw = this.yaw;
    if (rig.head) rig.head.rotation.y = this.aimYaw - this.yaw;
    this.recoil = Math.max(0, this.recoil - dt * 5);

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
