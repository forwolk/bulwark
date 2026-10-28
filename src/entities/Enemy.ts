import * as THREE from 'three';
import type { EnemyDef } from '../config/enemies';
import { angleDelta, clamp, damp, rand } from '../core/math';
import { createFlashableBodyMaterial, Materials } from '../render/Materials';
import { createEnemyModel, type EnemyRig } from '../render/models/EnemyModels';
import type { Damageable } from './Damageable';

let nextId = 1;
const tmp = new THREE.Vector3();

export class Enemy {
  readonly id = nextId++;
  readonly rig: EnemyRig;
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly knockback = new THREE.Vector3();
  private readonly material: THREE.MeshStandardMaterial;

  hp: number;
  yaw = 0;
  alive = true;
  moving = false;
  target: Damageable | null = null;
  retargetTimer = 0;
  /** True when the unit can walk straight at its target; otherwise it follows the level's flow field. */
  directPath = false;
  attackTimer: number;
  spawnTimer: number;
  stun = 0;
  /** Height of the surface under the unit (terrain for walkers, smoothed for flyers). */
  groundY: number;
  /** Lost to a hazard: no longer a target, just playing out its fall. */
  falling = false;
  private fallTime = 0;
  private fallSpeed = 0;
  private flash = 0;
  private animPhase = rand(0, 10);
  private hoverPhase = rand(0, 10);
  private lastYaw = 0;

  constructor(readonly def: EnemyDef, x: number, z: number, groundY: number) {
    this.hp = def.hp;
    this.groundY = groundY;
    this.material = createFlashableBodyMaterial();
    this.rig = createEnemyModel(def.kind, { body: this.material, glow: Materials.glowHot });
    this.position.set(x, groundY + def.altitude, z);
    this.yaw = Math.atan2(-x, -z);
    this.attackTimer = rand(0.2, def.attack.interval);
    this.spawnTimer = def.spawner?.interval ?? 0;
    this.syncTransform();
  }

  get flying(): boolean {
    return this.def.flying;
  }

  /** World-space point projectiles and beams should aim for. */
  aimPoint(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.position.x, this.flying ? this.position.y : this.position.y + this.def.radius * 0.9, this.position.z);
  }

  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    this.rig.root.updateMatrixWorld(true);
    return this.rig.muzzle.getWorldPosition(out);
  }

  /** Applies armour and returns the damage actually dealt. */
  takeDamage(amount: number): number {
    const dealt = Math.max(amount * 0.25, amount - this.def.armor);
    this.hp -= dealt;
    this.flash = 1;
    return dealt;
  }

  private syncTransform(): void {
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this.yaw;
  }

  animate(dt: number): void {
    this.hoverPhase += dt;
    if (this.falling) {
      this.syncTransform();
      return;
    }
    this.position.y = this.groundY + this.def.altitude + (this.flying ? Math.sin(this.hoverPhase * 2.2) * 0.35 : 0);
    this.syncTransform();

    const speedFactor = this.moving ? this.def.speed / 2 : 0.4;
    this.animPhase += dt * speedFactor * 4;
    const p = this.animPhase;
    const limbs = this.rig.limbs;

    switch (this.rig.limbMode) {
      case 'swing':
        for (let i = 0; i < limbs.length; i++) {
          const phase = p + i * Math.PI;
          limbs[i].rotation.x = this.moving ? Math.sin(phase) * 0.45 : 0;
          // Knees fold while the leg swings forward, straighten as it plants.
          const knee = this.rig.joints[i];
          if (knee) knee.rotation.x = this.moving ? -Math.max(0, Math.cos(phase)) * 0.6 : 0;
        }
        this.rig.body.position.y = this.rig.bodyY + Math.abs(Math.sin(p)) * (this.moving ? 0.15 : 0.04);
        break;
      case 'scuttle':
        for (let i = 0; i < limbs.length; i++) {
          const phase = p * 1.6 + i * Math.PI;
          limbs[i].rotation.y = this.moving ? Math.sin(phase) * 0.25 : 0;
          // Each tripod lifts as it swings forward.
          limbs[i].position.y = this.moving ? Math.max(0, Math.cos(phase)) * 0.12 : 0;
        }
        this.rig.body.position.y = Math.abs(Math.sin(p * 1.6)) * (this.moving ? 0.08 : 0.02);
        break;
      case 'flap':
        for (let i = 0; i < limbs.length; i++) {
          const side = i === 0 ? -1 : 1;
          limbs[i].rotation.z = side * Math.sin(this.hoverPhase * 38) * 0.5;
        }
        this.rig.body.rotation.z = -this.velocity.x * 0.03;
        break;
      case 'glide': {
        // Slow wing beats, and the whole airframe banks into its turns.
        for (let i = 0; i < limbs.length; i++) {
          const side = i === 0 ? -1 : 1;
          limbs[i].rotation.z = side * (0.06 + Math.sin(this.hoverPhase * 2.4) * 0.08);
        }
        const turnRate = angleDelta(this.lastYaw, this.yaw) / Math.max(dt, 1e-3);
        this.rig.root.rotation.z = damp(this.rig.root.rotation.z, clamp(-turnRate * 0.45, -0.6, 0.6), 4, dt);
        break;
      }
    }

    this.lastYaw = this.yaw;
    // Knockback tilt sells the impact of the nova pulse.
    tmp.copy(this.knockback);
    this.rig.root.rotation.x = Math.min(0.5, tmp.length() * 0.03);

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 9);
      this.material.emissive.setRGB(this.flash * 2.5, this.flash * 2.2, this.flash * 2);
    }
  }

  /**
   * Plays the fall into a chasm (or slow sink into liquid), tumbling as it goes.
   * Returns true once the unit is out of sight.
   */
  updateFall(dt: number, liquid: boolean): boolean {
    this.fallTime += dt;
    this.fallSpeed += (liquid ? 2.5 : 32) * dt;
    this.position.y -= this.fallSpeed * dt;
    this.position.addScaledVector(this.knockback, dt * 0.5);
    this.syncTransform();
    this.rig.root.rotation.x = Math.min(1.3, this.fallTime * (liquid ? 0.8 : 3));
    this.rig.root.rotation.z = this.fallTime * (liquid ? 0.3 : 1.7);
    return this.fallTime > (liquid ? 1.6 : 1.3);
  }

  startFall(): void {
    this.falling = true;
    this.alive = false;
    this.fallTime = 0;
    this.fallSpeed = 0;
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.rig.root);
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.rig.root);
    this.material.dispose();
  }
}
