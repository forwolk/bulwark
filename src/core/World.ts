import * as THREE from 'three';
import { Sfx } from '../audio/Sfx';
import type { Damageable } from '../entities/Damageable';
import { Core } from '../entities/Core';
import { CameraRig } from '../render/CameraRig';
import { Renderer } from '../render/Renderer';
import { ResolutionGovernor } from '../render/ResolutionGovernor';
import { BuildSystem } from '../systems/BuildSystem';
import { Economy } from '../systems/Economy';
import { EnemyManager } from '../systems/EnemyManager';
import { PlayerWeapons } from '../systems/PlayerWeapons';
import { SquadManager } from '../systems/SquadManager';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { StructureManager } from '../systems/StructureManager';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { WaveManager } from '../systems/WaveManager';
import { levelById } from '../levels/catalog';
import { Level } from '../levels/Level';
import type { LevelId } from '../levels/types';
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
  readonly resolution: ResolutionGovernor;
  readonly input: Input;
  readonly sfx = new Sfx();
  readonly timers = new Timers();
  readonly arena: Arena;
  /** The loaded battlefield. Replaced by loadLevel(), so systems read it fresh each frame. */
  level: Level;
  readonly effects: Effects;
  readonly core: Core;
  readonly economy: Economy;
  readonly upgrades: UpgradeSystem;
  readonly enemies: EnemyManager;
  readonly structures: StructureManager;
  readonly squads: SquadManager;
  readonly projectiles: ProjectileSystem;
  readonly weapons: PlayerWeapons;
  readonly waves: WaveManager;
  readonly build: BuildSystem;

  phase: Phase = 'title';
  readonly aimPoint = new THREE.Vector3();
  hasAim = false;
  readonly stats: RunStats = { kills: 0, time: 0, structuresBuilt: 0 };

  private readonly bufferSize = new THREE.Vector2();

  constructor(container: HTMLElement, levelId: LevelId) {
    this.renderer = new Renderer(container, this.cameraRig.camera);
    this.resolution = new ResolutionGovernor(this.renderer);
    this.input = new Input(this.renderer.canvas);
    this.arena = new Arena(this.scene);
    this.effects = new Effects(this.scene, this.cameraRig, this.renderer.webgl);
    this.level = this.createLevel(levelId);
    this.core = new Core(this.scene);
    this.economy = new Economy(this.events);
    this.upgrades = new UpgradeSystem(this.events, this.economy, this.core);
    this.enemies = new EnemyManager(this);
    this.structures = new StructureManager(this);
    this.squads = new SquadManager(this);
    this.projectiles = new ProjectileSystem(this);
    this.weapons = new PlayerWeapons(this);
    this.waves = new WaveManager(this);
    this.build = new BuildSystem(this);
  }

  private createLevel(id: LevelId): Level {
    const level = new Level(levelById(id));
    this.scene.add(level.root);
    this.arena.applyTheme(level.theme);
    this.renderer.webgl.toneMappingExposure = level.theme.exposure;
    this.renderer.setBloom(level.theme.bloom.threshold, level.theme.bloom.strength);
    this.effects.setGround(level);
    return level;
  }

  /** Swaps the battlefield. Only valid outside a run: clears every unit and effect. */
  loadLevel(id: LevelId): void {
    if (id === this.level.def.id) return;
    this.enemies.clear();
    this.structures.clear();
    this.squads.clear();
    this.projectiles.clear();
    this.effects.clear();
    this.level.dispose();
    this.level = this.createLevel(id);
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
    this.hasAim = this.level.raycast(this.cameraRig.pointerRay(this.input.pointer), this.aimPoint);
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
    this.squads.update(dt);
    this.projectiles.update(dt);
    this.core.update(dt, this.effects);
    this.effects.update(dt);
    this.arena.update(dt);
    const { camera, focusPoint } = this.cameraRig;
    this.level.update(dt, camera, focusPoint, this.renderer.webgl.getDrawingBufferSize(this.bufferSize).y);
    this.timers.update(dt);
  }

  render(): void {
    this.renderer.render();
  }

  reset(): void {
    this.timers.clear();
    this.enemies.clear();
    this.structures.clear();
    this.squads.clear();
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
