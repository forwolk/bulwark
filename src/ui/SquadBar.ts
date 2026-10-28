import { SQUAD_CAP, SQUAD_ORDER, SQUADS, type SquadKind } from '../config/squads';
import type { World } from '../core/World';
import { el, setText } from './dom';

const ICONS: Record<SquadKind, string> = {
  sentinel: '⁘',
  lancer: '⟋',
  rampart: '▣',
  kestrel: '➤',
};

interface SquadButton {
  root: HTMLButtonElement;
  cooldown: HTMLElement;
  active: HTMLElement;
}

/** Left-side panel of squad deploy buttons with hotkeys, costs, cooldown sweeps and active counts. */
export class SquadBar {
  private readonly root: HTMLElement;
  private readonly capText: HTMLElement;
  private readonly buttons = new Map<SquadKind, SquadButton>();

  constructor(parent: HTMLElement, private readonly world: World) {
    this.root = el('div', 'panel squadbar', parent);
    const head = el('div', 'squad-head', this.root);
    el('span', 'label', head, 'Squads');
    this.capText = el('span', 'squad-cap', head, `0 / ${SQUAD_CAP}`);

    for (const kind of SQUAD_ORDER) {
      const def = SQUADS[kind];
      const btn = el('button', 'squad-btn', this.root);
      const cooldown = el('div', 'squad-cd', btn);
      el('span', 'squad-key', btn, def.keyLabel);
      el('span', 'squad-icon', btn, ICONS[kind]);
      const text = el('span', 'squad-text', btn);
      el('span', 'squad-name', text, def.name);
      el('span', 'squad-size', text, `${def.size} unit${def.size > 1 ? 's' : ''}`);
      el('span', 'squad-cost', btn, `${def.cost}`);
      const active = el('span', 'squad-active', btn);

      const tip = el('div', 'tooltip squad-tip', btn);
      el('div', 'tooltip-title', tip, def.name);
      el('div', 'tooltip-body', tip, def.description);
      const u = def.unit;
      el('div', 'tooltip-stats', tip, `HP ${u.hp} · DMG ${u.weapon.damage} · Range ${u.weapon.range} · ${u.weapon.targets === 'both' ? 'Ground + air' : 'Ground'}`);

      btn.addEventListener('click', () => world.squads.deploy(kind));
      this.buttons.set(kind, { root: btn, cooldown, active });
    }
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  update(): void {
    const { squads, economy } = this.world;
    setText(this.capText, `${squads.squadCount} / ${SQUAD_CAP}`);
    this.capText.classList.toggle('full', squads.squadCount >= SQUAD_CAP);
    for (const [kind, b] of this.buttons) {
      const def = SQUADS[kind];
      const cd = squads.cooldownFraction(kind);
      b.cooldown.style.transform = `scaleY(${cd})`;
      b.root.classList.toggle('poor', economy.amount < def.cost);
      b.root.classList.toggle('blocked', cd > 0 || squads.squadCount >= SQUAD_CAP);
      const n = squads.count(kind);
      setText(b.active, n > 0 ? `×${n}` : '');
    }
  }
}
