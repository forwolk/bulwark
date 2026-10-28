import * as THREE from 'three';
import {
  CORE_WEAPON_ORDER, CORE_WEAPONS, WEAPON_SWAP_TIME,
  type AutocannonDef, type CoreWeaponId, type LanceDef, type ScatterDef, type SiegeDef,
} from '../config/coreWeapons';
import { PALETTE as C } from '../config/palette';
import { clamp, rand, segmentPointDistSqXZ } from '../core/math';
import type { World } from '../core/World';
import { LanceBeam } from '../vfx/LanceBeam';

const muzzle = new THREE.Vector3();
const facing = new THREE.Vector3();
const dir = new THREE.Vector3();
const target = new THREE.Vector3();
const beamEnd = new THREE.Vector3();

/**
 * The core's main gun and its interchangeable weapon modes. Handles selection hotkeys, the swap
 * animation (no firing while it runs), and each mode's firing pattern. Upgrades scale every mode.
 */
export class CoreGun {
  private mode: CoreWeaponId = 'autocannon';
  private pending: CoreWeaponId | null = null;
  private swapTimer = 0;
  private fireTimer = 0;
  /** Lance charge, 0..1. */
  private charge = 0;
  private sparkTimer = 0;
  private readonly beam = new LanceBeam(C.playerGlow);
  private readonly reticle: THREE.Mesh;
  private readonly reticleMaterial: THREE.MeshBasicMaterial;

  constructor(private readonly world: World) {
    world.scene.add(this.beam.group);
    const ring = new THREE.RingGeometry(0.9, 1, 40);
    ring.rotateX(-Math.PI / 2);
    this.reticleMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(C.playerAccent).multiplyScalar(2), transparent: true, opacity: 0.7, depthWrite: false,
    });
    this.reticle = new THREE.Mesh(ring, this.reticleMaterial);
    this.reticle.visible = false;
    world.scene.add(this.reticle);
  }

  /** Mode that is firing now (the outgoing one until a swap finishes). */
  get current(): CoreWeaponId {
    return this.mode;
  }

  /** Mode being swapped in, if any. */
  get incoming(): CoreWeaponId | null {
    return this.pending;
  }

  get swapProgress(): number {
    return this.pending ? 1 - this.swapTimer / WEAPON_SWAP_TIME : 1;
  }

  select(id: CoreWeaponId): void {
    if (id === (this.pending ?? this.mode)) return;
    // Re-selecting the current mode mid-swap cancels back to it.
    if (id === this.mode) {
      this.pending = null;
      this.world.core.setWeaponPose(this.mode, null, 1);
      this.world.events.emit('coreWeapon', { id, switching: false });
      return;
    }
    this.pending = id;
    this.swapTimer = WEAPON_SWAP_TIME;
    this.world.sfx.weaponSwap();
    this.world.events.emit('coreWeapon', { id, switching: true });
  }

  cycle(): void {
    const from = this.pending ?? this.mode;
    this.select(CORE_WEAPON_ORDER[(CORE_WEAPON_ORDER.indexOf(from) + 1) % CORE_WEAPON_ORDER.length]);
  }

  update(dt: number, firing: boolean): void {
    const { input, core } = this.world;
    for (const id of CORE_WEAPON_ORDER) if (input.wasKeyPressed(CORE_WEAPONS[id].hotkey)) this.select(id);
    if (input.wasKeyPressed('Tab')) this.cycle();

    this.fireTimer -= dt;
    this.sparkTimer -= dt;
    if (this.pending) {
      this.swapTimer -= dt;
      const t = 1 - this.swapTimer / WEAPON_SWAP_TIME;
      core.setWeaponPose(this.mode, this.pending, Math.min(1, t));
      if (this.swapTimer <= 0) {
        this.mode = this.pending;
        this.pending = null;
        core.setWeaponPose(this.mode, null, 1);
        this.fireTimer = Math.min(this.fireTimer, 0.1);
        this.world.events.emit('coreWeapon', { id: this.mode, switching: false });
      }
    }

    const def = CORE_WEAPONS[this.mode];
    const canFire = firing && !this.pending && core.alive;
    this.updateReticle(def.style === 'siege' && !this.pending && core.alive ? def : null);
    if (def.style === 'lance') {
      this.updateLance(def, dt, canFire);
      return;
    }
    this.updateLance(null, dt, false);
    if (!canFire || this.fireTimer > 0) return;
    const rate = this.world.upgrades.gunRateMultiplier;
    switch (def.style) {
      case 'autocannon':
        this.fireAutocannon(def);
        this.fireTimer = def.interval / rate;
        break;
      case 'scatter':
        this.fireScatter(def);
        this.fireTimer = def.interval / rate;
        break;
      case 'siege':
        this.fireSiege(def);
        this.fireTimer = def.interval / rate;
        break;
    }
  }

  private fireAutocannon(def: AutocannonDef): void {
    const { core, projectiles, effects, sfx, upgrades, aimPoint } = this.world;
    core.nextShot(muzzle, facing);
    // Fly toward the cursor at chest height, with a little spread.
    dir.set(aimPoint.x, aimPoint.y + 1.0, aimPoint.z).sub(muzzle);
    if (dir.lengthSq() < 4) dir.copy(facing);
    dir.normalize();
    dir.x += rand(-def.spread, def.spread);
    dir.z += rand(-def.spread, def.spread);
    dir.normalize();
    projectiles.fireBullet({
      from: muzzle, dir, speed: def.speed, range: def.range,
      damage: def.damage * upgrades.gunDamageMultiplier, splash: def.splash, layer: def.layer,
      color: C.playerGlow, size: 0.24, length: 2.2,
    });
    effects.muzzleFlash(muzzle, facing, C.playerGlow, 1.1);
    effects.shake(0.035);
    sfx.cannon(this.world.pan(muzzle.x));
  }

  /** Every barrel fires at once; pellets fan out across the cone. */
  private fireScatter(def: ScatterDef): void {
    const { core, projectiles, effects, sfx, upgrades, aimPoint } = this.world;
    const muzzles: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) {
      core.nextShot(muzzle, facing);
      muzzles.push(muzzle.clone());
      effects.muzzleFlash(muzzle, facing, C.playerAccent, 1.3);
    }
    const yaw = core.facing;
    const rise = clamp((aimPoint.y + 1 - muzzles[0].y) / 20, -0.15, 0.15);
    for (let k = 0; k < def.pellets; k++) {
      // Even spread across the cone with a little jitter, so every volley covers it.
      const a = yaw + ((k / (def.pellets - 1)) * 2 - 1) * def.cone + rand(-0.03, 0.03);
      dir.set(Math.sin(a), rise, Math.cos(a)).normalize();
      projectiles.fireBullet({
        from: muzzles[k % muzzles.length], dir, speed: def.speed * rand(0.9, 1.1), range: def.range * rand(0.85, 1),
        damage: def.damage * upgrades.gunDamageMultiplier, splash: 0, layer: def.layer,
        color: C.flak, size: 0.15, length: 1.1, push: def.push,
      });
    }
    effects.shake(0.08);
    sfx.scatter(this.world.pan(muzzles[0].x));
  }

  /** Lobbed shell to the cursor, clamped between minimum and maximum range. */
  private fireSiege(def: SiegeDef): void {
    const { core, projectiles, effects, sfx, upgrades } = this.world;
    this.siegeTarget(def, target);
    core.nextShot(muzzle, facing);
    const flight = clamp(muzzle.distanceTo(target) / 30, 0.8, 1.7);
    projectiles.fireShell(muzzle, target, flight, def.damage * upgrades.gunDamageMultiplier, def.splash, {
      blast: def.blast, push: def.push, size: 0.6,
    });
    dir.set(Math.sin(core.facing) * 0.7, 0.7, Math.cos(core.facing) * 0.7);
    effects.muzzleFlash(muzzle, dir, C.fireMid, 2.2);
    for (let i = 0; i < 5; i++) effects.smokeTrail(muzzle, 2.4);
    effects.shake(0.14);
    sfx.mortar(this.world.pan(muzzle.x));
    sfx.cannon(this.world.pan(muzzle.x));
  }

  /** Cursor ground point pulled into the siege mortar's range band. */
  private siegeTarget(def: SiegeDef, out: THREE.Vector3): THREE.Vector3 {
    const { aimPoint, core, level } = this.world;
    const dx = aimPoint.x - core.position.x;
    const dz = aimPoint.z - core.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const r = clamp(d, def.minRange, def.range);
    out.set(core.position.x + (dx / d) * r, 0, core.position.z + (dz / d) * r);
    out.y = level.heightAt(out.x, out.z);
    return out;
  }

  private updateReticle(def: SiegeDef | null): void {
    this.reticle.visible = def !== null && this.world.playing && this.world.hasAim;
    if (!this.reticle.visible || !def) return;
    this.siegeTarget(def, target);
    this.reticle.position.set(target.x, this.world.level.floorAt(target.x, target.z) + 0.2, target.z);
    this.reticle.scale.setScalar(def.splash);
    this.reticleMaterial.opacity = this.fireTimer > 0 ? 0.25 : 0.7;
  }

  /** Channels the beam while held: damage ramps with charge and hits everything along the line. */
  private updateLance(def: LanceDef | null, dt: number, firing: boolean): void {
    const { core, enemies, effects, sfx, upgrades } = this.world;
    this.charge = def && firing ? Math.min(1, this.charge + dt / def.chargeTime) : Math.max(0, this.charge - dt * 4);
    if (!def || this.charge <= 0) {
      this.beam.update(dt, muzzle, muzzle, 0);
      return;
    }
    core.muzzle(muzzle);
    const yaw = core.facing;
    beamEnd.set(muzzle.x + Math.sin(yaw) * def.range, muzzle.y, muzzle.z + Math.cos(yaw) * def.range);
    this.beam.update(dt, muzzle, beamEnd, firing ? this.charge : this.charge * 0.5);
    if (!firing) return;

    const damage = def.dps * this.charge * upgrades.gunDamageMultiplier * upgrades.gunRateMultiplier * dt;
    const showSparks = this.sparkTimer <= 0;
    if (showSparks) this.sparkTimer = 0.07;
    for (const e of enemies.all) {
      if (!e.alive) continue;
      const r = e.def.radius + def.width;
      if (segmentPointDistSqXZ(muzzle.x, muzzle.z, beamEnd.x, beamEnd.z, e.position.x, e.position.z) > r * r) continue;
      if (showSparks) effects.impact(e.aimPoint(target), C.playerGlow, 0.5 + this.charge * 0.5);
      enemies.damage(e, damage);
    }
    if (showSparks) effects.muzzleFlash(muzzle, facing.set(Math.sin(yaw), 0, Math.cos(yaw)), C.playerGlow, 0.6 + this.charge * 0.6);
    effects.shake(0.012 * this.charge);
    sfx.beam(this.world.pan(muzzle.x), this.charge);
  }

  reset(): void {
    this.mode = 'autocannon';
    this.pending = null;
    this.charge = 0;
    this.fireTimer = 0;
    this.beam.update(0, muzzle, muzzle, 0);
    this.reticle.visible = false;
    this.world.events.emit('coreWeapon', { id: this.mode, switching: false });
  }
}
