import { LEVELS } from './catalog';
import type { LevelId } from './types';

const KEY = 'bulwark.level';

/** Last battlefield the player picked. A convenience only, so storage failures fall back silently. */
export function loadLevelChoice(): LevelId {
  try {
    const saved = localStorage.getItem(KEY);
    const match = LEVELS.find((l) => l.id === saved);
    if (match) return match.id;
  } catch {
    // Storage blocked (private mode, sandboxed preview): use the default.
  }
  return LEVELS[0].id;
}

export function saveLevelChoice(id: LevelId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not critical.
  }
}
