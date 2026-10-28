import type { RunStats } from '../core/World';
import { el } from './dom';

/** Full-screen overlays: title, pause, victory/defeat. */
export class Screens {
  private readonly title: HTMLElement;
  private readonly end: HTMLElement;
  private readonly endTitle: HTMLElement;
  private readonly endStats: HTMLElement;
  private readonly pause: HTMLElement;

  constructor(parent: HTMLElement, onStart: () => void) {
    this.title = el('div', 'screen title-screen show', parent);
    const card = el('div', 'screen-card', this.title);
    el('div', 'game-title', card, 'BULWARK');
    el('div', 'game-subtitle', card, 'Hold the last fortress against the swarm');
    const how = el('div', 'howto', card);
    const lines: [string, string][] = [
      ['Mouse', 'Aim the core cannon'],
      ['LMB (hold)', 'Fire'],
      ['RMB', 'Swarm missiles at cursor'],
      ['Space', 'Nova pulse — knockback blast'],
      ['1 – 5', 'Build turrets and barriers'],
      ['X', 'Sell hovered structure'],
      ['Wheel', 'Zoom · P pause · M mute'],
    ];
    for (const [key, text] of lines) {
      const row = el('div', 'howto-row', how);
      el('span', 'howto-key', row, key);
      el('span', 'howto-text', row, text);
    }
    const start = el('button', 'primary', card, 'Deploy');
    start.addEventListener('click', () => onStart());

    this.end = el('div', 'screen end-screen', parent);
    const endCard = el('div', 'screen-card', this.end);
    this.endTitle = el('div', 'game-title', endCard);
    this.endStats = el('div', 'end-stats', endCard);
    const again = el('button', 'primary', endCard, 'Play again');
    again.addEventListener('click', () => onStart());

    this.pause = el('div', 'screen pause-screen', parent);
    el('div', 'game-title small', el('div', 'screen-card', this.pause), 'Paused');
  }

  hideAll(): void {
    this.title.classList.remove('show');
    this.end.classList.remove('show');
  }

  setPaused(paused: boolean): void {
    this.pause.classList.toggle('show', paused);
  }

  showEnd(victory: boolean, stats: RunStats, wave: number, total: number): void {
    this.end.classList.add('show');
    this.end.classList.toggle('victory', victory);
    this.endTitle.textContent = victory ? 'Fortress holds' : 'Core destroyed';
    const minutes = Math.floor(stats.time / 60);
    const seconds = Math.floor(stats.time % 60).toString().padStart(2, '0');
    this.endStats.replaceChildren();
    const rows: [string, string][] = [
      ['Waves survived', victory ? `${total} / ${total}` : `${Math.max(0, wave - 1)} / ${total}`],
      ['Hostiles destroyed', `${stats.kills}`],
      ['Structures built', `${stats.structuresBuilt}`],
      ['Time', `${minutes}:${seconds}`],
    ];
    for (const [k, v] of rows) {
      const row = el('div', 'end-row', this.endStats);
      el('span', '', row, k);
      el('span', 'end-value', row, v);
    }
  }
}
