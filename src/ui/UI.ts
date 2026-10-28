import type { World } from '../core/World';
import { BuildBar } from './BuildBar';
import { Hud } from './Hud';
import { Screens, type ScreenActions } from './Screens';
import { SquadBar } from './SquadBar';
import { WeaponSelector } from './WeaponSelector';
import { UpgradePanel } from './UpgradePanel';
import { WorldOverlay } from './WorldOverlay';

export interface UIActions extends ScreenActions {
  onLaunch: () => void;
}

/** Composes all DOM UI and toggles it per game phase. */
export class UI {
  readonly hud: Hud;
  readonly screens: Screens;
  private readonly buildBar: BuildBar;
  private readonly upgrades: UpgradePanel;
  private readonly squadBar: SquadBar;
  private readonly weaponSelector: WeaponSelector;
  private readonly overlay: WorldOverlay;

  constructor(root: HTMLElement, private readonly world: World, actions: UIActions) {
    // Buttons must never hold keyboard focus, or Enter/Space (launch wave, nova) would re-trigger them.
    root.addEventListener('mousedown', (e) => e.preventDefault());
    this.overlay = new WorldOverlay(root, world);
    this.hud = new Hud(root, world, actions.onLaunch);
    this.buildBar = new BuildBar(root, world);
    this.upgrades = new UpgradePanel(root, world);
    this.squadBar = new SquadBar(root, world);
    this.weaponSelector = new WeaponSelector(root, world);
    this.screens = new Screens(root, actions, world.level.def.id);

    world.events.on('phase', ({ phase }) => {
      const playing = phase === 'build' || phase === 'combat';
      this.hud.setVisible(playing);
      this.buildBar.setVisible(playing);
      this.upgrades.setVisible(playing);
      this.squadBar.setVisible(playing);
      this.weaponSelector.setVisible(playing);
      if (playing) this.screens.hideAll();
      if (phase === 'build' && world.waves.index < 0) this.overlay.clear();
    });
    this.hud.setVisible(false);
    this.buildBar.setVisible(false);
    this.upgrades.setVisible(false);
    this.squadBar.setVisible(false);
    this.weaponSelector.setVisible(false);
  }

  update(dt: number): void {
    if (!this.world.playing) {
      this.overlay.update(dt);
      return;
    }
    this.hud.update(dt);
    this.buildBar.update();
    this.upgrades.update();
    this.squadBar.update();
    this.weaponSelector.update();
    this.overlay.update(dt);
  }
}
