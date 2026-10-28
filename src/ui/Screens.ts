import type { RunStats } from '../core/World';
import type { LevelId } from '../levels/types';
import { el } from './dom';
import { LevelSelect } from './LevelSelect';

export interface ScreenActions {
  onStart: () => void;
  onSelectLevel: (id: LevelId) => void;
  /** Back to the title screen from the end screen. */
  onMenu: () => void;
  onResume: () => void;
  /** Abandon the run from the pause screen. */
  onQuit: () => void;
}

/** Full-screen overlays: title with battlefield picker, pause, victory/defeat. */
export class Screens {
  private readonly title: HTMLElement;
  private readonly levelSelect: LevelSelect;
  private readonly end: HTMLElement;
  private readonly endTitle: HTMLElement;
  private readonly endLevel: HTMLElement;
  private readonly endStats: HTMLElement;
  private readonly pause: HTMLElement;

  constructor(parent: HTMLElement, actions: ScreenActions, selectedLevel: LevelId) {
    this.title = el('div', 'screen title-screen show', parent);
    const card = el('div', 'screen-card title-card', this.title);
    el('div', 'game-title', card, 'BULWARK');
    el('div', 'game-subtitle', card, 'Hold the last fortress against the swarm');
    this.levelSelect = new LevelSelect(card, selectedLevel, actions.onSelectLevel);
    el('button', 'primary', card, 'Deploy').addEventListener('click', () => actions.onStart());

    const how = el('div', 'howto', card);
    const lines: [string, string][] = [
      ['Mouse · LMB', 'Aim and fire the core cannon'],
      ['RMB', 'Swarm missiles at cursor'],
      ['Space', 'Nova pulse: knockback blast'],
      ['1 – 5', 'Build turrets and barriers'],
      ['Q W E R', 'Deploy squads'],
      ['X', 'Sell hovered structure'],
      ['Wheel · P · M', 'Zoom · pause · mute'],
    ];
    for (const [key, text] of lines) {
      const row = el('div', 'howto-row', how);
      el('span', 'howto-key', row, key);
      el('span', 'howto-text', row, text);
    }

    this.end = el('div', 'screen end-screen', parent);
    const endCard = el('div', 'screen-card', this.end);
    this.endTitle = el('div', 'game-title', endCard);
    this.endLevel = el('div', 'game-subtitle', endCard);
    this.endStats = el('div', 'end-stats', endCard);
    el('button', 'primary', endCard, 'Play again').addEventListener('click', () => actions.onStart());
    el('button', 'secondary', endCard, 'Change battlefield').addEventListener('click', () => actions.onMenu());

    this.pause = el('div', 'screen pause-screen', parent);
    const pauseCard = el('div', 'screen-card', this.pause);
    el('div', 'game-title small', pauseCard, 'Paused');
    el('button', 'primary', pauseCard, 'Resume').addEventListener('click', () => actions.onResume());
    el('button', 'secondary', pauseCard, 'Quit to menu').addEventListener('click', () => actions.onQuit());
  }

  hideAll(): void {
    this.title.classList.remove('show');
    this.end.classList.remove('show');
    this.pause.classList.remove('show');
  }

  showTitle(): void {
    this.hideAll();
    this.title.classList.add('show');
  }

  setSelectedLevel(id: LevelId): void {
    this.levelSelect.setSelected(id);
  }

  setPaused(paused: boolean): void {
    this.pause.classList.toggle('show', paused);
  }

  showEnd(victory: boolean, stats: RunStats, wave: number, total: number, levelName: string): void {
    this.end.classList.add('show');
    this.end.classList.toggle('victory', victory);
    this.endTitle.textContent = victory ? 'Fortress holds' : 'Core destroyed';
    this.endLevel.textContent = levelName;
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
