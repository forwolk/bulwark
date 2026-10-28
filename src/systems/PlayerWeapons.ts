import * as THREE from 'three';
import { CORE } from '../config/balance';
import { CoreGun } from './CoreGun';
import { PALETTE as C } from '../config/palette';
import { rand } from '../core/math';
import type { World } from '../core/World';
import type { Enemy } from '../entities/Enemy';

const pod = new THREE.Vector3();

/** The core's main gun (LMB, switchable modes), swarm missiles (RMB) and nova pulse (Space). */
export class PlayerWeapons {
  readonly gun: CoreGun;
  missileCooldown = 0;
  novaCooldown = 0;

  constructor(private readonly world: World) {
    this.gun = new CoreGun(world);
  }

  get missileReady(): number {
    return 1 - this.missileCooldown / this.world.upgrades.missileCooldown;
  }

  get novaReady(): number {
    return 1 - this.novaCooldown / CORE.nova.cooldown;
  }

  update(dt: number): void {
    const { input, core, build } = this.world;
    if (!core.alive) return;
    if (this.world.hasAim) core.aimAt(this.world.aimPoint, dt);

    this.missileCooldown = Math.max(0, this.missileCooldown - dt);
    this.novaCooldown = Math.max(0, this.novaCooldown - dt);

    const building = build.selected !== null;
    this.gun.update(dt, input.isButtonDown(0) && !build.blocksFire);
    if (input.wasButtonPressed(2) && !building) this.launchMissiles();
    if (input.wasKeyPressed('Space')) this.novaPulse();
  }

  private launchMissiles(): void {
    const { enemies, effects, sfx, timers, upgrades, core, aimPoint, projectiles } = this.world;
    if (this.missileCooldown > 0) {
      sfx.deny();
      return;
    }
    // Prefer enemies near the cursor, otherwise whatever is closest to the core.
    let targets: Enemy[] = enemies.inRadius(aimPoint.x, aimPoint.z, 12, 'both', []);
    if (targets.length === 0) targets = enemies.inRadius(0, 0, 48, 'both', []);
    if (targets.length === 0) {
      sfx.deny();
      this.world.events.emit('message', { text: 'No targets for missiles', tone: 'info' });
      return;
    }
    targets.sort((a, b) => a.position.distanceToSquared(aimPoint) - b.position.distanceToSquared(aimPoint));

    this.missileCooldown = upgrades.missileCooldown;
    const count = upgrades.missileCount;
    for (let i = 0; i < count; i++) {
      timers.after(i * 0.07, () => {
        const target = targets[i % targets.length];
        if (!core.alive) return;
        core.podPosition(i, pod);
        const side = i % 2 === 0 ? -1 : 1;
        const launch = new THREE.Vector3(Math.sin(core.facing) * 0.5, 1, Math.cos(core.facing) * 0.5);
        launch.x += Math.cos(core.facing) * side * rand(0.4, 1.1);
        launch.z -= Math.sin(core.facing) * side * rand(0.4, 1.1);
        launch.normalize();
        projectiles.fireMissile(pod, target, CORE.missiles.damage, CORE.missiles.splash, launch);
        effects.muzzleFlash(pod, launch, C.playerGlow, 0.7);
        effects.smokeTrail(pod, 2);
        sfx.missile(this.world.pan(pod.x));
      });
    }
  }

  private novaPulse(): void {
    const { enemies, effects, sfx, core } = this.world;
    if (this.novaCooldown > 0) {
      sfx.deny();
      return;
    }
    this.novaCooldown = CORE.nova.cooldown;
    const { radius, damage, knockback, stun } = CORE.nova;
    effects.shockwave(core.position, radius, C.playerGlow);
    sfx.nova();
    for (const e of enemies.inRadius(core.position.x, core.position.z, radius, 'both', [])) {
      const d = Math.hypot(e.position.x - core.position.x, e.position.z - core.position.z);
      const falloff = 1 - Math.min(1, d / radius) * 0.5;
      enemies.push(e, core.position.x, core.position.z, knockback * falloff);
      e.stun = Math.max(e.stun, stun);
      enemies.damage(e, damage * falloff);
    }
  }

  reset(): void {
    this.gun.reset();
    this.missileCooldown = 0;
    this.novaCooldown = 0;
  }
}
