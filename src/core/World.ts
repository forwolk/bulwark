import * as THREE from 'three';
import { Sfx } from '../audio/Sfx';
import type { Damageable } from '../entities/Damageable';
import { Core } from '../entities/Core';
import { CameraRig } from '../render/CameraRig';
import { Renderer } from '../render/Renderer';
import { BuildSystem } from '../systems/BuildSystem';
import { Economy } from '../systems/Economy';
import { EnemyManager } from '../systems/EnemyManager';
import { PlayerWeapons } from '../systems/PlayerWeapons';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { StructureManager } from '../systems/StructureManager';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { WaveManager } from '../systems/WaveManager';
import { Effects } from '../vfx/Effects';
import { Arena } from '../world/Arena';
import { EventBus } from './EventBus';
import type { GameEvents, Phase } from './events';
import { Input } from './Input';
import { clamp } from './math';
import { Timers } from './Timers';

export interface RunStats {
  kills: number;
  time: number;
  structuresBuilt: number;
}

/**
 * Owns every subsystem and the shared state between them. Systems receive the World
 * and talk to each other through it (or through the event bus for UI/audio concerns).
 */
export class World {
  readonly events = new EventBus<GameEvents>();
  readonly cameraRig = new CameraRig();
  readonly renderer: Renderer;
  readonly input: Input;
  readonly sfx = new Sfx();
  readonly timers = new Timers();
  readonly arena: Arena;
  readonly effects: Effects;
  readonly core: Core;
  readonly economy: Economy;
  readonly upgrades: UpgradeSystem;
  readonly enemies: EnemyManager;
  readonly structures: StructureManager;
  readonly projectiles: ProjectileSystem;
  readonly weapons: PlayerWeapons;
  readonly waves: WaveManager;
  readonly build: BuildSystem;

  phase: Phase = 'title';
  readonly aimPoint = new THREE.Vector3();
  hasAim = false;
  readonly stats: RunStats = { kills: 0, time: 0, structuresBuilt: 0 };

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container, this.cameraRig.camera);
    this.input = new Input(this.renderer.canvas);
    this.arena = new Arena(this.scene);
    this.effects = new Effects(this.scene, this.cameraRig, this.renderer.webgl);
    this.core = new Core(this.scene);
    this.economy = new Economy(this.events);
    this.upgrades = new UpgradeSystem(this.events, this.economy, this.core);
    this.enemies = new EnemyManager(this);
    this.structures = new StructureManager(this);
    this.projectiles = new ProjectileSystem(this);
    this.weapons = new PlayerWeapons(this);
    this.waves = new WaveManager(this);
    this.build = new BuildSystem(this);
  }

  get scene(): THREE.Scene {
    return this.renderer.scene;
  }

  get playing(): boolean {
    return this.phase === 'build' || this.phase === 'combat';
  }

  /** Stereo pan for a world x position. */
  pan(x: number): number {
    return clamp(x / 45, -0.9, 0.9);
  }

  /** Routes enemy damage to the core or a structure, with feedback. */
  damageDefense(target: Damageable, amount: number): void {
    if (!target.alive) return;
    target.takeDamage(amount);
    if (target.isCore) {
      this.events.emit('coreHealth', { hp: target.hp, maxHp: target.maxHp });
      this.sfx.coreHit();
      this.cameraRig.addShake(Math.min(0.3, amount / 250));
    }
  }

  update(dt: number): void {
    this.hasAim = this.cameraRig.groundPoint(this.input.pointer, this.aimPoint);
    this.cameraRig.update(dt, this.input.pointer, this.input.wheelDelta);

    if (this.playing) {
      this.stats.time += dt;
      // Weapons read the build selection before BuildSystem consumes clicks this frame.
      this.weapons.update(dt);
      this.build.update(dt);
      if (this.phase === 'combat') this.waves.update(dt);
    }
    this.enemies.update(dt);
    this.structures.update(dt);
    this.projectiles.update(dt);
    this.core.update(dt, this.effects);
    this.effects.update(dt);
    this.arena.update(dt);
    this.timers.update(dt);
  }

  render(): void {
    this.renderer.render();
  }

  reset(): void {
    this.timers.clear();
    this.enemies.clear();
    this.structures.clear();
    this.projectiles.clear();
    this.effects.clear();
    this.upgrades.reset();
    this.economy.reset();
    this.weapons.reset();
    this.waves.reset();
    this.build.select(null);
    this.core.reset(this.upgrades.maxHp);
    this.events.emit('coreHealth', { hp: this.core.hp, maxHp: this.core.maxHp });
    this.stats.kills = 0;
    this.stats.time = 0;
    this.stats.structuresBuilt = 0;
  }
}
