import { UPGRADE_ORDER, UPGRADES, type UpgradeId } from '../config/upgrades';
import type { World } from '../core/World';
import { el, setText } from './dom';

interface Row {
  button: HTMLButtonElement;
  pips: HTMLElement[];
  cost: HTMLElement;
}

/** Core upgrade shop on the right edge. */
export class UpgradePanel {
  private readonly root: HTMLElement;
  private readonly rows = new Map<UpgradeId, Row>();

  constructor(parent: HTMLElement, private readonly world: World) {
    this.root = el('div', 'panel upgrades', parent);
    el('div', 'label', this.root, 'Core upgrades');
    for (const id of UPGRADE_ORDER) {
      const def = UPGRADES[id];
      const button = el('button', 'upgrade', this.root);
      const head = el('div', 'upgrade-head', button);
      el('span', 'upgrade-name', head, def.name);
      const cost = el('span', 'upgrade-cost', head);
      el('div', 'upgrade-desc', button, def.description);
      const pipRow = el('div', 'pips', button);
      const pips = def.costs.map(() => el('span', 'pip', pipRow));
      button.addEventListener('click', () => {
        if (world.upgrades.purchase(id)) {
          world.sfx.build();
          world.events.emit('message', { text: `${def.name} upgraded`, tone: 'good' });
        } else {
          world.sfx.deny();
        }
      });
      this.rows.set(id, { button, pips, cost });
    }
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  update(): void {
    const { upgrades, economy } = this.world;
    for (const [id, row] of this.rows) {
      const level = upgrades.level(id);
      const cost = upgrades.nextCost(id);
      row.pips.forEach((pip, i) => pip.classList.toggle('on', i < level));
      setText(row.cost, cost === null ? 'MAX' : `${cost}`);
      row.button.classList.toggle('maxed', cost === null);
      row.button.classList.toggle('poor', cost !== null && economy.amount < cost);
    }
  }
}
