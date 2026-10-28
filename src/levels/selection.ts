import { loadPref, savePref } from '../core/prefs';
import { LEVELS } from './catalog';
import type { LevelId } from './types';

/** Last battlefield the player picked. */
export function loadLevelChoice(): LevelId {
  return loadPref<LevelId>('level', LEVELS[0].id, (v) => LEVELS.some((l) => l.id === v));
}

export function saveLevelChoice(id: LevelId): void {
  savePref('level', id);
}
