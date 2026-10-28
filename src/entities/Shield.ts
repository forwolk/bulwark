import * as THREE from 'three';
import { CORE } from '../config/balance';
import { PALETTE as C } from '../config/palette';
import { ShieldDome } from '../vfx/ShieldDome';

const dir = new THREE.Vector3();

/** The energy dome over the core: absorbs enemy fire, recharges, collapses and reboots. */
export class Shield {
  readonly center = new THREE.Vector3();
  readonly radius = CORE.shield.radius;
  readonly dome: ShieldDome;
  maxHp: number = CORE.shield.hp;
  hp: number = CORE.shield.hp;
  regen: number = CORE.shield.regen;
  up = true;
  private powered = true;
  private sinceHit = 99;
  private rebootTimer = 0;

  constructor() {
    this.dome = new ShieldDome(this.radius, 0x1258e8, 0x4cd2ff, C.playerAccent);
    this.dome.group.position.copy(this.center);
  }

  get active(): boolean {
    return this.up && this.powered;
  }

  /** Capacitors raise the ceiling; a new capacitor's strength is added straight away. */
  setCapacity(maxHp: number, regen: number): void {
    if (maxHp > this.maxHp && this.up) this.hp += maxHp - this.maxHp;
    this.maxHp = maxHp;
    this.hp = Math.min(this.hp, maxHp);
    this.regen = regen;
  }

  /** Takes a hit at `point` on the surface. Returns true if this hit broke the shield. */
  absorb(damage: number, point: THREE.Vector3): boolean {
    this.hp -= damage;
    this.sinceHit = 0;
    dir.subVectors(point, this.center).normalize();
    this.dome.hit(dir, damage / this.maxHp);
    if (this.hp > 0) return false;
    this.hp = 0;
    this.up = false;
    this.rebootTimer = CORE.shield.rebootTime;
    return true;
  }

  /** `powered` is false once the core is gone. Returns true on the frame the shield reboots. */
  update(dt: number, powered: boolean): boolean {
    this.powered = powered;
    let rebooted = false;
    if (!this.up) {
      this.rebootTimer -= dt;
      if (this.rebootTimer <= 0 && powered) {
        this.up = true;
        this.hp = this.maxHp * 0.3;
        this.dome.boot();
        rebooted = true;
      }
    } else {
      this.sinceHit += dt;
      if (this.sinceHit >= CORE.shield.regenDelay) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    }
    this.dome.update(dt, this.hp / this.maxHp, this.active);
    return rebooted;
  }

  repair(fraction: number): void {
    if (this.up) this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - this.hp) * fraction);
  }

  /** Fresh run: full base-strength shield, rebuilt from the ground up. */
  reset(): void {
    this.maxHp = this.hp = CORE.shield.hp;
    this.regen = CORE.shield.regen;
    this.up = true;
    this.sinceHit = 99;
    this.dome.boot();
  }
}
