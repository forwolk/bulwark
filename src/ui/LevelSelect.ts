import { LEVELS } from '../levels/catalog';
import type { LevelId } from '../levels/types';
import { el } from './dom';

/** Battlefield picker on the title screen. Choosing a card swaps the live level behind the menu. */
export class LevelSelect {
  private readonly cards = new Map<LevelId, HTMLButtonElement>();

  constructor(parent: HTMLElement, selected: LevelId, onSelect: (id: LevelId) => void) {
    const root = el('div', 'level-select', parent);
    el('div', 'section-label', root, 'Battlefield');
    for (const level of LEVELS) {
      const card = el('button', 'level-card', root);
      const swatch = el('div', 'level-swatch', card);
      for (const color of level.swatch) el('span', '', swatch).style.background = color;
      const body = el('div', 'level-body', card);
      el('div', 'level-name', body, level.name);
      el('div', 'level-tagline', body, level.tagline);
      const tags = el('div', 'level-tags', body);
      for (const f of level.features) el('span', 'level-tag', tags, f);
      card.addEventListener('click', () => onSelect(level.id));
      this.cards.set(level.id, card);
    }
    this.setSelected(selected);
  }

  setSelected(id: LevelId): void {
    for (const [key, card] of this.cards) card.classList.toggle('selected', key === id);
  }
}
