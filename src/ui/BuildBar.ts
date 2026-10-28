import { STRUCTURE_ORDER, STRUCTURES, type StructureKind } from '../config/structures';
import type { World } from '../core/World';
import { el } from './dom';

const ICONS: Record<StructureKind, string> = {
  repeater: '⟴',
  flak: '✶',
  mortar: '◎',
  arc: 'ϟ',
  barrier: '◠',
};

/** Bottom row of structure buttons with hotkeys, costs and tooltips. */
export class BuildBar {
  private readonly root: HTMLElement;
  private readonly buttons = new Map<StructureKind, HTMLButtonElement>();

  constructor(parent: HTMLElement, private readonly world: World) {
    this.root = el('div', 'buildbar', parent);
    for (const kind of STRUCTURE_ORDER) {
      const def = STRUCTURES[kind];
      const btn = el('button', 'build-btn', this.root);
      el('span', 'build-key', btn, def.hotkey);
      el('span', 'build-icon', btn, ICONS[kind]);
      el('span', 'build-name', btn, def.name);
      el('span', 'build-cost', btn, `${def.cost}`);
      const tip = el('div', 'tooltip', btn);
      el('div', 'tooltip-title', tip, def.name);
      el('div', 'tooltip-body', tip, def.description);
      if (def.weapon) el('div', 'tooltip-stats', tip, `Range ${def.weapon.range} · DMG ${def.weapon.damage} · HP ${def.hp}`);
      else if (def.shieldBoost) el('div', 'tooltip-stats', tip, `+${def.shieldBoost.hp} shield · +${def.shieldBoost.regen}/s recharge · HP ${def.hp}`);
      else el('div', 'tooltip-stats', tip, `HP ${def.hp}`);

      btn.addEventListener('click', () => {
        world.sfx.click();
        world.build.select(kind);
      });
      this.buttons.set(kind, btn);
    }
    world.events.on('buildSelection', ({ kind }) => {
      for (const [k, btn] of this.buttons) btn.classList.toggle('selected', k === kind);
    });
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  update(): void {
    const scrap = this.world.economy.amount;
    for (const [kind, btn] of this.buttons) btn.classList.toggle('poor', scrap < STRUCTURES[kind].cost);
  }
}
