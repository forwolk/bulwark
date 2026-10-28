import * as THREE from 'three';
import { RENDER } from '../config/graphics';
import { PALETTE as C } from '../config/palette';
import { rand, TAU } from '../core/math';
import type { CameraRig } from '../render/CameraRig';
import { Decals } from './Decals';
import { GlowSprites } from './GlowSprites';
import { InstancedParticles } from './InstancedParticles';
import { LightFlashes } from './LightFlashes';

const hdr = (hex: number, k: number): THREE.Color => new THREE.Color(hex).multiplyScalar(k);
const BLACK = new THREE.Color(0, 0, 0);
const FIRE_CORE = hdr(C.fireCore, 4);
const FIRE_MID = hdr(C.fireMid, 3.5);
const FIRE_OUTER = hdr(C.fireOuter, 0.6);
const SMOKE = new THREE.Color(C.smoke);
const SMOKE_LIGHT = new THREE.Color(C.smokeLight);

const v = new THREE.Vector3();
const perpA = new THREE.Vector3();
const perpB = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** What effects need to know about the ground beneath them. */
export interface EffectGround {
  heightAt(x: number, z: number): number;
  readonly dust: number;
  readonly dustDark: number;
}

const FLAT_GROUND: EffectGround = { heightAt: () => 0, dust: 0x8b7d6d, dustDark: 0x6a5d52 };

export interface ExplosionOptions {
  /** Main tint of fire and sparks. Defaults to orange fire. */
  color?: number;
  debrisColor?: number;
  scorch?: boolean;
  shake?: number;
  light?: boolean;
}

/**
 * High-level effect recipes composed from low-level particle systems.
 * Gameplay code only ever calls these named effects.
 */
export class Effects {
  private readonly sparks: InstancedParticles;
  private readonly flashes: InstancedParticles;
  private readonly puffs: InstancedParticles;
  private readonly debris: InstancedParticles;
  private readonly rings: InstancedParticles;
  private readonly walls: InstancedParticles;
  private readonly glows = new GlowSprites(600);
  private readonly lights: LightFlashes;
  private readonly decals = new Decals();
  private readonly bufferSize = new THREE.Vector2();
  private ground: EffectGround = FLAT_GROUND;
  private readonly dust = new THREE.Color();
  private readonly dustDark = new THREE.Color();

  constructor(scene: THREE.Scene, private readonly cameraRig: CameraRig, private readonly webgl: THREE.WebGLRenderer) {
    const additive = (side: THREE.Side = THREE.FrontSide): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side });

    this.sparks = new InstancedParticles(new THREE.OctahedronGeometry(0.5), additive(), 3000, 'velocity');
    this.flashes = new InstancedParticles(new THREE.IcosahedronGeometry(1, 0), additive(), 600, 'tumble');
    this.puffs = new InstancedParticles(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1, metalness: 0 }),
      1200,
      'tumble',
    );
    this.debris = new InstancedParticles(
      new THREE.TetrahedronGeometry(1),
      new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8, metalness: 0.2 }),
      800,
      'tumble',
      true,
    );
    const ring = new THREE.RingGeometry(0.82, 1, 40);
    ring.rotateX(-Math.PI / 2);
    this.rings = new InstancedParticles(ring, additive(THREE.DoubleSide), 200, 'flat');
    const wall = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
    wall.translate(0, 0.5, 0);
    this.walls = new InstancedParticles(wall, additive(THREE.DoubleSide), 60, 'flat');
    this.lights = new LightFlashes(scene, RENDER.flashLights);

    for (const sys of [this.sparks, this.flashes, this.puffs, this.debris, this.rings, this.walls]) scene.add(sys.mesh);
    scene.add(this.glows.points);
    scene.add(this.decals.mesh);
  }

  setGround(ground: EffectGround): void {
    this.ground = ground;
    this.dust.setHex(ground.dust);
    this.dustDark.setHex(ground.dustDark);
  }

  /** Colour of the ground's dust, for debris and impacts. */
  get dustColor(): number {
    return this.ground.dust;
  }

  get dustDarkColor(): number {
    return this.ground.dustDark;
  }

  update(dt: number): void {
    this.sparks.update(dt);
    this.flashes.update(dt);
    this.puffs.update(dt);
    this.debris.update(dt);
    this.rings.update(dt);
    this.walls.update(dt);
    this.glows.update(dt, this.cameraRig.camera, this.webgl.getDrawingBufferSize(this.bufferSize).y);
    this.lights.update(dt);
    this.decals.update(dt);
  }

  clear(): void {
    for (const sys of [this.sparks, this.flashes, this.puffs, this.debris, this.rings, this.walls]) sys.clear();
    this.glows.clear();
    this.lights.clear();
    this.decals.clear();
  }

  shake(amount: number): void {
    this.cameraRig.addShake(amount);
  }

  /** Short directional cone of light at a gun muzzle. */
  muzzleFlash(pos: THREE.Vector3, dir: THREE.Vector3, color: number, scale = 1): void {
    const hot = hdr(color, 5);
    this.sparks.spawn({ x: pos.x, y: pos.y, z: pos.z, life: 0.06, size: 0.45 * scale, sizeEnd: 0.1, color: hdr(C.fireCore, 6), colorEnd: hot, dir, length: 1.6 * scale });
    for (let i = 0; i < 3; i++) {
      v.copy(dir).multiplyScalar(rand(6, 14)).add(perpA.set(rand(-3, 3), rand(-1, 3), rand(-3, 3)));
      this.sparks.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: v.x, vy: v.y, vz: v.z, life: rand(0.08, 0.16), size: 0.09 * scale, sizeEnd: 0, color: hot, colorEnd: BLACK, stretch: 0.03, drag: 4 });
    }
    this.glows.spawn(pos, 2.2 * scale, 1.2 * scale, hdr(color, 0.6), 0.08);
  }

  /** Small hit on armour: sparks and a pinprick flash. */
  impact(pos: THREE.Vector3, color: number, scale = 1): void {
    const hot = hdr(color, 4);
    const n = Math.round(4 * scale) + 2;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(4, 12) * Math.sqrt(scale);
      this.sparks.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * s, vy: rand(2, 9), vz: Math.sin(a) * s, life: rand(0.12, 0.3), size: 0.08, sizeEnd: 0, color: hot, colorEnd: BLACK, stretch: 0.035, gravity: 25 });
    }
    this.flashes.spawn({ x: pos.x, y: pos.y, z: pos.z, life: 0.09, size: 0.35 * scale, sizeEnd: 0.7 * scale, color: hdr(C.fireCore, 4), colorEnd: BLACK, curve: 'easeOut' });
    this.glows.spawn(pos, 1.6 * scale, 0.9 * scale, hdr(color, 0.5), 0.1);
  }

  /** Layered low-poly explosion: flash, fireballs, sparks, debris, smoke, ground ring, scorch, light. */
  explosion(pos: THREE.Vector3, size: number, opts: ExplosionOptions = {}): void {
    const s = size;
    const tint = opts.color ?? C.fireMid;
    const tintHot = hdr(tint, 3.5);
    const groundY = this.ground.heightAt(pos.x, pos.z);
    const ground = pos.y - groundY < 1.5;

    this.flashes.spawn({ x: pos.x, y: pos.y, z: pos.z, life: 0.16, size: s * 0.6, sizeEnd: s * 1.8, color: FIRE_CORE, colorEnd: BLACK, curve: 'easeOut' });

    const fireballs = Math.round(3 + s * 3);
    for (let i = 0; i < fireballs; i++) {
      this.flashes.spawn({
        x: pos.x + rand(-0.6, 0.6) * s, y: pos.y + rand(0, 0.6) * s, z: pos.z + rand(-0.6, 0.6) * s,
        vx: rand(-2, 2) * s, vy: rand(1, 4) * s, vz: rand(-2, 2) * s,
        life: rand(0.3, 0.55), size: s * rand(0.35, 0.6), sizeEnd: s * rand(0.8, 1.25), color: i === 0 ? FIRE_MID : tintHot, colorEnd: FIRE_OUTER.clone().multiplyScalar(0), drag: 3, spin: rand(-3, 3), curve: 'easeOut',
      });
    }

    const sparkCount = Math.round(8 + s * 10);
    for (let i = 0; i < sparkCount; i++) {
      const a = rand(0, TAU);
      const up = rand(0.15, 1);
      const speed = rand(8, 24) * Math.sqrt(s);
      this.sparks.spawn({
        x: pos.x, y: pos.y + 0.2, z: pos.z,
        vx: Math.cos(a) * speed * (1 - up * 0.5), vy: up * speed, vz: Math.sin(a) * speed * (1 - up * 0.5),
        life: rand(0.3, 0.8), size: 0.12 * Math.sqrt(s), sizeEnd: 0, color: FIRE_CORE, colorEnd: FIRE_OUTER, stretch: 0.045, gravity: 28, bounce: 0.35, drag: 0.6,
      });
    }

    if (opts.debrisColor !== undefined) {
      const debrisColor = new THREE.Color(opts.debrisColor);
      const debrisEnd = debrisColor.clone().multiplyScalar(0.4);
      const pieces = Math.round(3 + s * 5);
      for (let i = 0; i < pieces; i++) {
        const a = rand(0, TAU);
        const speed = rand(3, 10) * Math.sqrt(s);
        this.debris.spawn({
          x: pos.x, y: pos.y + 0.5, z: pos.z,
          vx: Math.cos(a) * speed, vy: rand(6, 15) * Math.sqrt(s), vz: Math.sin(a) * speed,
          life: rand(1.2, 2.2), size: rand(0.15, 0.4) * Math.sqrt(s), sizeEnd: 0, color: debrisColor, colorEnd: debrisEnd,
          gravity: 32, spin: rand(-12, 12), bounce: 0.35, curve: 'linear',
        });
      }
    }

    // Big blasts get more puffs rather than bigger ones: oversized faceted puffs read as rocks.
    const puffs = Math.round(3 + s * 4);
    const puffSize = Math.min(s, 2.2);
    for (let i = 0; i < puffs; i++) {
      this.puffs.spawn({
        x: pos.x + rand(-0.8, 0.8) * s, y: pos.y + rand(0.2, 1) * puffSize, z: pos.z + rand(-0.8, 0.8) * s,
        vx: rand(-1.5, 1.5) * s, vy: rand(1.5, 4) * Math.sqrt(puffSize), vz: rand(-1.5, 1.5) * s,
        life: rand(0.8, 1.6), size: rand(0.4, 0.7) * puffSize, sizeEnd: 0, color: Math.random() < 0.5 ? SMOKE : SMOKE_LIGHT, colorEnd: SMOKE,
        drag: 1.8, gravity: -1.2, spin: rand(-1.5, 1.5), curve: 'pop',
      });
    }

    if (ground) {
      this.rings.spawn({ x: pos.x, y: groundY + 0.15, z: pos.z, life: 0.4, size: s * 0.4, sizeEnd: s * 3.4, color: hdr(tint, 2.2), colorEnd: BLACK, curve: 'easeOut' });
      if (opts.scorch !== false) this.decals.add(pos, Math.min(s, 3) * 2.2, groundY);
    }
    this.glows.spawn(pos, s * 4.5, s * 2.5, hdr(tint, 0.45), 0.25);
    if (opts.light !== false) this.lights.flash(pos, tint, 30 * s, 10 + s * 8, 0.35 + s * 0.08);
    if (opts.shake) this.shake(opts.shake);
  }

  /** Expanding energy wall + rings: the core's nova pulse and boss stomps. */
  shockwave(pos: THREE.Vector3, radius: number, color: number): void {
    const life = 0.55;
    const y = this.ground.heightAt(pos.x, pos.z);
    this.walls.spawn({ x: pos.x, y, z: pos.z, life, size: 1, sizeEnd: radius, color: hdr(color, 1.2), colorEnd: BLACK, curve: 'easeOut', scaleY: 0.25 });
    this.rings.spawn({ x: pos.x, y: y + 0.2, z: pos.z, life, size: 1, sizeEnd: radius, color: hdr(color, 2.5), colorEnd: BLACK, curve: 'easeOut' });
    this.rings.spawn({ x: pos.x, y: y + 0.25, z: pos.z, life: life * 1.4, size: 0.5, sizeEnd: radius * 0.75, color: hdr(C.fireCore, 2), colorEnd: BLACK, curve: 'easeOut' });
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU;
      const speed = radius / life * rand(0.9, 1.3);
      this.sparks.spawn({ x: pos.x + Math.cos(a) * 2, y: y + 0.6, z: pos.z + Math.sin(a) * 2, vx: Math.cos(a) * speed, vy: rand(0, 3), vz: Math.sin(a) * speed, life: life, size: 0.18, sizeEnd: 0, color: hdr(color, 5), colorEnd: BLACK, stretch: 0.06, drag: 1.2 });
      this.puffs.spawn({ x: pos.x + Math.cos(a) * rand(3, radius * 0.8), y: y + 0.4, z: pos.z + Math.sin(a) * rand(3, radius * 0.8), vx: Math.cos(a) * 4, vy: rand(0.5, 2), vz: Math.sin(a) * 4, life: rand(0.8, 1.4), size: rand(0.5, 1.0), sizeEnd: 0, color: this.dust, colorEnd: this.dustDark, drag: 2, spin: 1, curve: 'pop' });
    }
    this.glows.spawn(pos.clone().setY(2), radius * 0.5, radius * 0.9, hdr(color, 0.3), 0.3);
    this.lights.flash(pos, color, 50, radius * 2, 0.6);
    this.shake(0.55);
  }

  /** Jagged branching bolt between two points. */
  lightning(from: THREE.Vector3, to: THREE.Vector3, color: number, width = 1): void {
    const hot = hdr(color, 6);
    const dist = from.distanceTo(to);
    const segments = Math.max(3, Math.ceil(dist / 0.9));
    v.subVectors(to, from).normalize();
    perpA.crossVectors(v, UP);
    if (perpA.lengthSq() < 1e-4) perpA.set(1, 0, 0);
    perpA.normalize();
    perpB.crossVectors(v, perpA).normalize();

    const prev = from.clone();
    const next = new THREE.Vector3();
    const dir = new THREE.Vector3();
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      next.lerpVectors(from, to, t);
      if (i < segments) {
        const j = Math.sin(t * Math.PI) * 0.7;
        next.addScaledVector(perpA, rand(-j, j)).addScaledVector(perpB, rand(-j, j));
      }
      dir.subVectors(next, prev);
      const len = dir.length();
      dir.multiplyScalar(1 / len);
      const mid = prev.clone().lerp(next, 0.5);
      const life = rand(0.1, 0.18);
      this.sparks.spawn({ x: mid.x, y: mid.y, z: mid.z, life, size: 0.16 * width, sizeEnd: 0.04, color: hot, colorEnd: BLACK, dir: dir.clone(), length: len * 1.1 });
      if (Math.random() < 0.25) {
        const bdir = dir.clone().addScaledVector(perpA, rand(-1, 1)).addScaledVector(perpB, rand(-1, 1)).normalize();
        this.sparks.spawn({ x: next.x + bdir.x * 0.4, y: next.y + bdir.y * 0.4, z: next.z + bdir.z * 0.4, life: life * 0.7, size: 0.08 * width, sizeEnd: 0, color: hot, colorEnd: BLACK, dir: bdir, length: rand(0.6, 1.2) });
      }
      prev.copy(next);
    }
    this.glows.spawn(to, 2.2 * width, 1.2, hdr(color, 0.7), 0.15);
    this.glows.spawn(from, 1.8 * width, 1, hdr(color, 0.6), 0.12);
    this.impact(to, color, 0.8);
  }

  /** Heavy straight rail shot: a bright beam that lingers a moment, sparks along its length. */
  railBeam(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    dir.multiplyScalar(1 / len);
    const mid = from.clone().lerp(to, 0.5);
    this.sparks.spawn({ x: mid.x, y: mid.y, z: mid.z, life: 0.22, size: 0.34, sizeEnd: 0.02, color: hdr(color, 6), colorEnd: BLACK, dir, length: len });
    this.sparks.spawn({ x: mid.x, y: mid.y, z: mid.z, life: 0.1, size: 0.12, sizeEnd: 0, color: FIRE_CORE, colorEnd: BLACK, dir, length: len });
    for (let i = 0; i < 8; i++) {
      v.copy(from).lerp(to, Math.random());
      this.sparks.spawn({ x: v.x, y: v.y, z: v.z, vx: rand(-1, 1), vy: rand(1, 3), vz: rand(-1, 1), life: rand(0.2, 0.4), size: 0.08, sizeEnd: 0, color: hdr(color, 4), colorEnd: BLACK, stretch: 0.02, drag: 2 });
    }
    this.glows.spawn(from, 2.4, 1.4, hdr(color, 0.7), 0.15);
    this.glows.spawn(to, 3, 1.6, hdr(color, 0.8), 0.2);
    this.impact(to, color, 1.4);
  }

  /** Thin instant beam (wasp lasers). */
  laser(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    dir.multiplyScalar(1 / len);
    const mid = from.clone().lerp(to, 0.5);
    this.sparks.spawn({ x: mid.x, y: mid.y, z: mid.z, life: 0.1, size: 0.12, sizeEnd: 0.02, color: hdr(color, 6), colorEnd: BLACK, dir, length: len });
    this.impact(to, color, 0.5);
  }

  smokeTrail(pos: THREE.Vector3, scale = 1): void {
    this.puffs.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: rand(-0.4, 0.4), vy: rand(0.3, 1), vz: rand(-0.4, 0.4), life: rand(0.4, 0.7), size: 0.22 * scale, sizeEnd: 0, color: SMOKE_LIGHT, colorEnd: SMOKE, spin: 2, curve: 'pop', drag: 1 });
  }

  emberTrail(pos: THREE.Vector3, color: number, scale = 1): void {
    this.flashes.spawn({ x: pos.x, y: pos.y, z: pos.z, life: 0.18, size: 0.18 * scale, sizeEnd: 0, color: hdr(color, 3), colorEnd: BLACK, spin: 4 });
  }

  /** Dust burst + ring when a structure is placed. */
  structurePlaced(pos: THREE.Vector3): void {
    this.rings.spawn({ x: pos.x, y: 0.12, z: pos.z, life: 0.45, size: 0.4, sizeEnd: 2.6, color: hdr(C.playerGlow, 3), colorEnd: BLACK, curve: 'easeOut' });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      this.puffs.spawn({ x: pos.x + Math.cos(a) * 1.1, y: 0.3, z: pos.z + Math.sin(a) * 1.1, vx: Math.cos(a) * 3, vy: rand(0.5, 1.5), vz: Math.sin(a) * 3, life: rand(0.5, 0.9), size: rand(0.3, 0.55), sizeEnd: 0, color: this.dust, colorEnd: this.dustDark, drag: 3, spin: 2, curve: 'pop' });
    }
    this.glows.spawn(pos.clone().setY(1), 3.5, 2, hdr(C.playerGlow, 0.4), 0.3);
  }

  /** Vertical burst used when the boss births skitters and when units warp in. */
  warpIn(pos: THREE.Vector3, color: number): void {
    const y = this.ground.heightAt(pos.x, pos.z);
    this.walls.spawn({ x: pos.x, y, z: pos.z, life: 0.35, size: 1.2, sizeEnd: 0.2, color: hdr(color, 3), colorEnd: BLACK, scaleY: 6 });
    this.rings.spawn({ x: pos.x, y: y + 0.15, z: pos.z, life: 0.35, size: 0.3, sizeEnd: 2.2, color: hdr(color, 3), colorEnd: BLACK, curve: 'easeOut' });
  }

  /** Healing sparkle on structures between waves. */
  repairPulse(pos: THREE.Vector3): void {
    for (let i = 0; i < 6; i++) {
      this.sparks.spawn({ x: pos.x + rand(-0.8, 0.8), y: rand(0.3, 1.5), z: pos.z + rand(-0.8, 0.8), vy: rand(2, 4), life: rand(0.5, 0.9), size: 0.12, sizeEnd: 0, color: hdr(0x5dff9d, 4), colorEnd: BLACK, stretch: 0.08 });
    }
  }

  scorch(pos: THREE.Vector3, size: number): void {
    this.decals.add(pos, size, this.ground.heightAt(pos.x, pos.z));
  }

  /** An enemy lost to a hazard: a splash ring on liquid, a puff of grit off a cliff edge. */
  hazardSplash(pos: THREE.Vector3, color: number, liquid: boolean): void {
    if (liquid) {
      this.rings.spawn({ x: pos.x, y: pos.y + 0.1, z: pos.z, life: 0.7, size: 0.4, sizeEnd: 3.2, color: hdr(color, 1.6), colorEnd: BLACK, curve: 'easeOut' });
      for (let i = 0; i < 14; i++) {
        const a = rand(0, TAU);
        const s = rand(2, 5);
        this.sparks.spawn({ x: pos.x, y: pos.y + 0.2, z: pos.z, vx: Math.cos(a) * s, vy: rand(4, 9), vz: Math.sin(a) * s, life: rand(0.4, 0.7), size: 0.12, sizeEnd: 0, color: hdr(color, 2.5), colorEnd: BLACK, stretch: 0.03, gravity: 25 });
      }
      this.glows.spawn(pos, 3, 2, hdr(color, 0.5), 0.4);
      return;
    }
    for (let i = 0; i < 6; i++) {
      this.puffs.spawn({ x: pos.x + rand(-0.6, 0.6), y: pos.y + 0.3, z: pos.z + rand(-0.6, 0.6), vx: rand(-1, 1), vy: rand(0.5, 1.5), vz: rand(-1, 1), life: rand(0.5, 0.9), size: rand(0.3, 0.5), sizeEnd: 0, color: this.dust, colorEnd: this.dustDark, drag: 2, spin: 2, curve: 'pop' });
    }
  }
}
