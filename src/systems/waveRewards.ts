import { ECONOMY } from '../config/balance';
import { ENEMIES } from '../config/enemies';
import { WAVES } from '../config/waves';

/** Share of a skipped wave's scrap granted when starting later: assumes a good, not perfect, run. */
const CATCH_UP_SHARE = 0.8;
/** Scrap per enemy still alive or unspawned when the next wave is called early. */
const EARLY_CALL_PER_ENEMY = 3;
const EARLY_CALL_MIN = 20;

/** Bonus for clearing wave number `wave` (1-based). */
export function clearBonus(wave: number): number {
  return ECONOMY.waveBonusBase + ECONOMY.waveBonusPerWave * wave;
}

/** Scrap from killing every enemy a wave spawns directly (boss spawnlings not counted). */
export function killRewards(waveIndex: number): number {
  return WAVES[waveIndex].groups.reduce((sum, g) => sum + g.count * ENEMIES[g.kind].reward, 0);
}

/** Scrap granted for starting at wave `startWave` (1-based) instead of wave 1. */
export function catchUpScrap(startWave: number): number {
  let total = 0;
  for (let w = 1; w < startWave; w++) total += killRewards(w - 1) + clearBonus(w);
  return Math.round((total * CATCH_UP_SHARE) / 10) * 10;
}

/** Risk bonus for calling the next wave while `threats` enemies are still alive or to come. */
export function earlyCallBonus(threats: number): number {
  return Math.max(EARLY_CALL_MIN, threats * EARLY_CALL_PER_ENEMY);
}
