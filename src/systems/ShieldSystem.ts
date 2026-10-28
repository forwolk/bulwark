import * as THREE from 'three';
import { CORE } from '../config/balance';
import { PALETTE as C } from '../config/palette';
import type { World } from '../core/World';
import { Shield } from '../entities/Shield';

export interface ShieldHit {
  shield: Shield;
  point: THREE.Vector3;
}

const seg = new THREE.Vector3();
const rel = new THREE.Vector3();
const from = new THREE.Vector3();
const vel = new THREE.Vector3();

/**
 * The core's energy dome and the Shield Capacitors that feed it. Enemy projectiles and beams
 * ask here whether the dome is in their way; fire that starts inside it is not blocked.
 */
export class ShieldSystem {
  readonly core = new Shield();
  private moteTimer = 0;

  constructor(private readonly world: World) {
    world.scene.add(this.core.dome.group);
  }

  /** Recomputes dome strength from the capacitors currently standing. */
  refresh(): void {
    let hp = CORE.shield.hp;
    let regen = CORE.shield.regen;
    for (const s of this.world.structures.all) {
      if (!s.alive || !s.def.shieldBoost) continue;
      hp += s.def.shieldBoost.hp;
      regen += s.def.shieldBoost.regen;
    }
    this.core.setCapacity(hp, regen);
  }

  /** Where a segment first enters the dome from outside. The dome is a hemisphere: nothing below its base counts. */
  intersect(a: THREE.Vector3, b: THREE.Vector3): ShieldHit | null {
    const s = this.core;
    if (!s.active) return null;
    seg.subVectors(b, a);
    const qa = seg.lengthSq();
    if (qa < 1e-8) return null;
    rel.subVectors(a, s.center);
    const c = rel.lengthSq() - s.radius * s.radius;
    if (c <= 0) return null; // starts inside
    const qb = 2 * rel.dot(seg);
    const disc = qb * qb - 4 * qa * c;
    if (disc < 0) return null;
    const t = (-qb - Math.sqrt(disc)) / (2 * qa);
    if (t < 0 || t > 1) return null;
    const point = a.clone().addScaledVector(seg, t);
    if (point.y < s.center.y - 0.2) return null;
    return { shield: s, point };
  }

  /** Applies a blocked hit: damage to the dome, feedback, and the collapse if it breaks. */
  absorb(hit: ShieldHit, damage: number): void {
    const { effects, sfx } = this.world;
    const pan = this.world.pan(hit.point.x);
    effects.shieldImpact(hit.point, C.playerGlow, Math.min(2, 0.6 + damage / 40));
    sfx.shieldHit(pan);
    if (hit.shield.absorb(damage, hit.point)) {
      effects.shieldBreak(hit.shield.center, hit.shield.radius, C.playerGlow);
      sfx.shieldDown(pan);
      this.world.events.emit('message', { text: 'Core shield down', tone: 'warn' });
    }
  }

  update(dt: number): void {
    const { core, effects, sfx, structures } = this.world;
    if (this.core.update(dt, core.alive)) {
      sfx.shieldUp(0);
      this.world.events.emit('message', { text: 'Core shield restored', tone: 'good' });
    }
    // Capacitors stream energy motes toward the dome while it's up.
    this.moteTimer -= dt;
    if (this.moteTimer > 0 || !this.core.active) return;
    this.moteTimer = 0.12;
    for (const s of structures.all) {
      if (!s.alive || !s.def.shieldBoost || Math.random() < 0.5) continue;
      from.set(s.position.x, 3, s.position.z);
      vel.set(-s.position.x, 2.5, -s.position.z).normalize().multiplyScalar(7);
      effects.energyMote(from, vel, C.playerGlow);
    }
  }

  repairAll(fraction: number): void {
    this.core.repair(fraction);
  }

  reset(): void {
    this.core.reset();
    this.refresh();
  }
}
