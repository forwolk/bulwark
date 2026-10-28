import { CORE } from '../config/balance';
import { UPGRADES, type UpgradeId } from '../config/upgrades';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { Core } from '../entities/Core';
import type { Economy } from './Economy';

/** Core upgrade levels and the derived weapon/hull stats. */
export class UpgradeSystem {
  private readonly levels: Record<UpgradeId, number> = { damage: 0, rate: 0, hull: 0, missiles: 0 };

  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly economy: Economy,
    private readonly core: Core,
  ) {}

  level(id: UpgradeId): number {
    return this.levels[id];
  }

  maxLevel(id: UpgradeId): number {
    return UPGRADES[id].costs.length;
  }

  /** Cost of the next level, or null when maxed. */
  nextCost(id: UpgradeId): number | null {
    return UPGRADES[id].costs[this.levels[id]] ?? null;
  }

  purchase(id: UpgradeId): boolean {
    const cost = this.nextCost(id);
    if (cost === null || !this.economy.spend(cost)) return false;
    this.levels[id]++;
    if (id === 'hull') {
      const added = this.maxHp - this.core.maxHp;
      this.core.maxHp = this.maxHp;
      this.core.hp += added;
      this.events.emit('coreHealth', { hp: this.core.hp, maxHp: this.core.maxHp });
    }
    this.events.emit('upgradePurchased', { id, level: this.levels[id] });
    return true;
  }

  /** Multiplies the damage of every core weapon mode. */
  get gunDamageMultiplier(): number {
    return 1 + 0.25 * this.levels.damage;
  }

  /** Multiplies the fire rate (and beam damage rate) of every core weapon mode. */
  get gunRateMultiplier(): number {
    return 1 + 0.15 * this.levels.rate;
  }

  get maxHp(): number {
    return Math.round(CORE.maxHp * (1 + 0.25 * this.levels.hull));
  }

  get missileCount(): number {
    return CORE.missiles.count + 2 * this.levels.missiles;
  }

  get missileCooldown(): number {
    return CORE.missiles.cooldown - this.levels.missiles;
  }

  reset(): void {
    for (const id of Object.keys(this.levels) as UpgradeId[]) this.levels[id] = 0;
  }
}
