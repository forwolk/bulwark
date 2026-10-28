import { CORE_WEAPON_ORDER, CORE_WEAPONS, type CoreWeaponId } from '../config/coreWeapons';
import type { World } from '../core/World';
import { el } from './dom';

interface Tile {
  root: HTMLButtonElement;
  fill: HTMLElement;
}

/** Row of core weapon modes above the ability tiles: hotkeys, active mode, swap progress, auto-fire switch. */
export class WeaponSelector {
  private readonly root: HTMLElement;
  private readonly tiles = new Map<CoreWeaponId, Tile>();
  private readonly autoSwitch: HTMLButtonElement;

  constructor(parent: HTMLElement, private readonly world: World) {
    this.root = el('div', 'weapons', parent);
    const head = el('div', 'weapons-head', this.root);
    el('div', 'label', head, 'Core gun · Tab');
    this.autoSwitch = el('button', 'auto-switch', head);
    el('span', 'auto-key', this.autoSwitch, 'T');
    el('span', 'auto-text', this.autoSwitch, 'Auto-fire');
    el('span', 'auto-track', this.autoSwitch).appendChild(el('span', 'auto-knob'));
    this.autoSwitch.addEventListener('click', () => world.weapons.gun.setAutoFire(!world.weapons.gun.autoFire));
    const row = el('div', 'weapons-row', this.root);
    for (const id of CORE_WEAPON_ORDER) {
      const def = CORE_WEAPONS[id];
      const tile = el('button', 'weapon', row);
      const fill = el('div', 'weapon-fill', tile);
      el('span', 'weapon-key', tile, def.keyLabel);
      el('span', 'weapon-icon', tile, def.icon);
      el('span', 'weapon-name', tile, def.name);
      const tip = el('div', 'tooltip', tile);
      el('div', 'tooltip-title', tip, def.name);
      el('div', 'tooltip-body', tip, def.description);
      tile.addEventListener('click', () => world.weapons.gun.select(id));
      this.tiles.set(id, { root: tile, fill });
    }
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  update(): void {
    const gun = this.world.weapons.gun;
    this.autoSwitch.classList.toggle('on', gun.autoFire);
    const incoming = gun.incoming;
    for (const [id, tile] of this.tiles) {
      const active = id === (incoming ?? gun.current);
      tile.root.classList.toggle('active', active);
      // The incoming mode fills up as its barrels extend.
      tile.fill.style.transform = `scaleX(${id === incoming ? gun.swapProgress : active ? 1 : 0})`;
    }
  }
}
