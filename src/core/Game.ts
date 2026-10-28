import * as THREE from 'three';
import { ECONOMY } from '../config/balance';
import { PALETTE as C } from '../config/palette';
import { rand } from './math';
import { WAVES } from '../config/waves';
import type { Phase } from './events';
import { loadLevelChoice, saveLevelChoice } from '../levels/selection';
import type { LevelId } from '../levels/types';
import { catchUpScrap, clearBonus, earlyCallBonus } from '../systems/waveRewards';
import { UI } from '../ui/UI';
import { loadPref, savePref } from './prefs';
import { World } from './World';

const MAX_FRAME = 1 / 20;

/** Main loop and phase state machine: title → build ⇄ combat → victory | defeat. */
export class Game {
  readonly world: World;
  private readonly ui: UI;
  private lastTime = performance.now();
  private timeScale = 1;
  private paused = false;
  /** Wave a new run begins at (1-based); later starts come with catch-up scrap. */
  private startWave = Number(loadPref<string>('startWave', '1', (v) => Number(v) >= 1 && Number(v) <= WAVES.length));

  constructor(viewport: HTMLElement, uiRoot: HTMLElement) {
    this.world = new World(viewport, loadLevelChoice());
    this.ui = new UI(uiRoot, this.world, {
      onStart: () => this.start(),
      onLaunch: () => this.launchWave(),
      onSelectLevel: (id) => this.selectLevel(id),
      onMenu: () => this.ui.screens.showTitle(),
      onResume: () => this.setPaused(false),
      onQuit: () => this.quitToMenu(),
      onStartWave: (wave: number) => this.setStartWave(wave),
    }, this.startWave);
    requestAnimationFrame(this.frame);
  }

  private setPhase(phase: Phase): void {
    this.world.phase = phase;
    this.world.events.emit('phase', { phase, wave: this.world.waves.index + 1 });
  }

  private start(): void {
    const { world } = this;
    if (world.playing) return;
    world.sfx.unlock();
    world.sfx.click();
    world.reset();
    this.timeScale = 1;
    if (this.startWave > 1) {
      world.waves.startFrom(this.startWave);
      world.economy.earn(catchUpScrap(this.startWave));
    }
    this.setPhase('build');
    const sub = this.startWave > 1
      ? `Starting at wave ${this.startWave}: spend your catch-up scrap, then launch`
      : 'Build your defenses with 1–5, then launch the wave';
    this.ui.hud.showBanner(world.level.def.name, sub, 'info');
  }

  private setStartWave(wave: number): void {
    this.startWave = Math.min(WAVES.length, Math.max(1, wave));
    savePref('startWave', String(this.startWave));
    this.world.sfx.click();
    this.ui.screens.setStartWave(this.startWave, catchUpScrap(this.startWave));
  }

  /** Swaps the battlefield behind the menu. Not allowed mid-run. */
  private selectLevel(id: LevelId): void {
    if (this.world.playing) return;
    this.world.sfx.unlock();
    this.world.sfx.click();
    this.world.loadLevel(id);
    saveLevelChoice(id);
    this.ui.screens.setSelectedLevel(id);
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.ui.screens.setPaused(paused);
  }

  private quitToMenu(): void {
    this.setPaused(false);
    this.timeScale = 1;
    this.world.reset();
    this.setPhase('title');
    this.ui.screens.showTitle();
  }

  private launchWave(): void {
    const { world } = this;
    if (world.phase === 'combat') {
      this.callNextWaveEarly();
      return;
    }
    if (world.phase !== 'build') return;
    world.waves.startNext();
    world.sfx.waveStart();
    this.setPhase('combat');
  }

  /**
   * Starts the next wave while the current one is still running. The current wave's clear bonus
   * is paid now (it will never be "cleared" on its own), plus a bonus for every enemy still in play.
   */
  private callNextWaveEarly(): void {
    const { world } = this;
    const { waves } = world;
    if (!waves.canCallEarly) return;
    const bonus = clearBonus(waves.index + 1) + earlyCallBonus(waves.threats);
    world.economy.earn(bonus);
    waves.startNext();
    world.sfx.waveStart();
    world.events.emit('message', { text: `Wave called early: +${bonus} scrap`, tone: 'good' });
  }

  private waveCleared(): void {
    const { world } = this;
    world.waves.finish();
    const wave = world.waves.index + 1;
    if (world.waves.isFinalWave) {
      this.victory();
      return;
    }
    const bonus = clearBonus(wave);
    world.economy.earn(bonus);
    world.structures.repairAll(ECONOMY.interWaveRepair);
    world.squads.repairAll(ECONOMY.interWaveRepair);
    world.core.hp = Math.min(world.core.maxHp, world.core.hp + (world.core.maxHp - world.core.hp) * ECONOMY.interWaveRepair);
    world.events.emit('coreHealth', { hp: world.core.hp, maxHp: world.core.maxHp });
    world.events.emit('waveCleared', { wave, bonus });
    world.sfx.waveClear();
    this.setPhase('build');
  }

  private victory(): void {
    const { world } = this;
    world.sfx.victory();
    this.setPhase('victory');
    world.build.select(null);
    this.ui.screens.showEnd(true, world.stats, world.waves.index + 1, world.waves.total, world.level.def.name);
  }

  /** Slow-motion chain reaction as the core goes down. */
  private defeat(): void {
    const { world } = this;
    const { effects, timers, sfx, core } = world;
    this.setPhase('defeat');
    world.build.select(null);
    this.timeScale = 0.35;
    sfx.defeat();
    for (let i = 0; i < 7; i++) {
      timers.after(i * 0.12, () => {
        const p = new THREE.Vector3(rand(-3, 3), rand(1, 4), rand(-3, 3));
        effects.explosion(p, rand(1.5, 2.5), { debrisColor: C.playerSteel, shake: 0.3 });
        sfx.explosion(2.5, 0);
      });
    }
    timers.after(0.9, () => {
      core.setDestroyed();
      effects.explosion(core.position.clone().setY(2), 6, { debrisColor: C.playerPlate, shake: 1, color: C.playerGlow });
      effects.shockwave(core.position, 26, C.playerGlow);
      sfx.explosion(5, 0);
    });
    timers.after(2.2, () => {
      this.timeScale = 1;
      this.ui.screens.showEnd(false, world.stats, world.waves.index + 1, world.waves.total, world.level.def.name);
    });
  }

  private readonly frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const { world } = this;
    const { input } = world;
    const frameSeconds = (now - this.lastTime) / 1000;
    const rawDt = Math.min(MAX_FRAME, frameSeconds);
    this.lastTime = now;
    world.resolution.update(frameSeconds);

    if (input.wasKeyPressed('KeyM')) {
      const muted = world.sfx.toggleMute();
      world.events.emit('message', { text: muted ? 'Sound off' : 'Sound on', tone: 'info' });
    }
    if ((input.wasKeyPressed('KeyP') || (this.paused && input.wasKeyPressed('Escape'))) && world.playing) {
      this.setPaused(!this.paused);
    }

    if (!this.paused) {
      if ((world.phase === 'build' || world.phase === 'combat') && (input.wasKeyPressed('Enter') || input.wasKeyPressed('NumpadEnter'))) this.launchWave();
      if (world.phase === 'combat' && world.waves.cleared) this.waveCleared();
      if (world.playing && !world.core.alive) this.defeat();

      world.update(rawDt * this.timeScale);
      this.ui.update(rawDt);
    }
    world.render();
    input.endFrame();
  };
}
