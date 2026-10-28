import { ECONOMY } from '../config/balance';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';

export class Economy {
  private scrap: number = ECONOMY.startScrap;
  totalEarned = 0;

  constructor(private readonly events: EventBus<GameEvents>) {}

  get amount(): number {
    return this.scrap;
  }

  canAfford(cost: number): boolean {
    return this.scrap >= cost;
  }

  earn(amount: number): void {
    this.scrap += amount;
    this.totalEarned += amount;
    this.events.emit('scrap', { amount: this.scrap, delta: amount });
  }

  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.scrap -= cost;
    this.events.emit('scrap', { amount: this.scrap, delta: -cost });
    return true;
  }

  reset(): void {
    this.scrap = ECONOMY.startScrap;
    this.totalEarned = 0;
    this.events.emit('scrap', { amount: this.scrap, delta: 0 });
  }
}
