import * as THREE from 'three';
import { CORE } from '../config/balance';
import { PALETTE as C } from '../config/palette';
import { rand, rotateTowards, yawTo } from '../core/math';
import { createCoreModel, type CoreRig } from '../render/models/CoreModel';
import type { Effects } from '../vfx/Effects';
import type { Damageable } from './Damageable';

const RECOIL_DISTANCE = 0.7;

/** The player's fortress cannon. Aiming and visuals live here; firing decisions live in PlayerWeapons. */
export class Core implements Damageable {
  readonly position = new THREE.Vector3();
  readonly radius = CORE.radius;
  readonly isCore = true;
  readonly aimHeight = 2.2;
  hp: number = CORE.maxHp;
  maxHp: number = CORE.maxHp;

  readonly rig: CoreRig;
  private yaw = 0;
  private readonly recoil = [0, 0];
  private barrelIndex = 0;
  private time = 0;
  private smokeTimer = 0;
  private readonly glowLight: THREE.PointLight;

  constructor(scene: THREE.Scene) {
    this.rig = createCoreModel();
    scene.add(this.rig.root);
    this.glowLight = new THREE.PointLight(C.playerGlow, 10, 16, 1.6);
    this.glowLight.position.set(0, 6, -0.5);
    scene.add(this.glowLight);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  get facing(): number {
    return this.yaw;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  reset(maxHp: number): void {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.yaw = 0;
    this.rig.root.visible = true;
    this.glowLight.visible = true;
  }

  setDestroyed(): void {
    this.rig.root.visible = false;
    this.glowLight.visible = false;
  }

  aimAt(point: THREE.Vector3, dt: number): void {
    const target = yawTo(this.position.x, this.position.z, point.x, point.z);
    this.yaw = rotateTowards(this.yaw, target, CORE.turnSpeed * dt);
  }

  /** Picks the next barrel, kicks its recoil and writes the muzzle position and facing. */
  nextShot(outPos: THREE.Vector3, outDir: THREE.Vector3): void {
    const i = this.barrelIndex;
    this.barrelIndex = (this.barrelIndex + 1) % this.rig.barrels.length;
    this.recoil[i] = 1;
    this.rig.root.updateMatrixWorld(true);
    this.rig.muzzles[i].getWorldPosition(outPos);
    outDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  podPosition(index: number, out: THREE.Vector3): THREE.Vector3 {
    this.rig.root.updateMatrixWorld(true);
    return this.rig.pods[index % this.rig.pods.length].getWorldPosition(out);
  }

  update(dt: number, effects: Effects): void {
    this.time += dt;
    this.rig.head.rotation.y = this.yaw;
    for (let i = 0; i < this.rig.barrels.length; i++) {
      this.recoil[i] = Math.max(0, this.recoil[i] - dt * 7);
      this.rig.barrels[i].position.z = 1.3 - this.recoil[i] * this.recoil[i] * RECOIL_DISTANCE;
    }
    this.rig.orb.position.y = 3.3 + Math.sin(this.time * 2) * 0.12;
    this.rig.orb.rotation.y += dt * 1.5;
    this.rig.ring.position.y = this.rig.orb.position.y;
    this.rig.ring.rotation.x = Math.sin(this.time * 0.9) * 0.6;
    this.rig.ring.rotation.z += dt * 2;
    this.glowLight.intensity = 9 + Math.sin(this.time * 6) * 1.5;

    // Damaged core smokes and sparks, more as integrity drops.
    const damage = 1 - this.hp / this.maxHp;
    if (this.alive && damage > 0.35) {
      this.smokeTimer -= dt * damage * 6;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 1;
        const p = new THREE.Vector3(rand(-2.5, 2.5), rand(1.5, 3), rand(-2.5, 2.5));
        effects.smokeTrail(p, 2.5);
        if (damage > 0.65 && Math.random() < 0.4) effects.impact(p, C.fireMid, 0.6);
      }
    }
  }
}
