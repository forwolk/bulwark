export type UpgradeId = 'damage' | 'rate' | 'hull' | 'missiles';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  costs: number[];
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  damage: {
    id: 'damage',
    name: 'Shell Payload',
    description: '+25% cannon damage',
    costs: [150, 260, 400, 600],
  },
  rate: {
    id: 'rate',
    name: 'Autoloader',
    description: '+15% cannon fire rate',
    costs: [140, 240, 380, 560],
  },
  hull: {
    id: 'hull',
    name: 'Hull Plating',
    description: '+25% core integrity, repairs the added amount',
    costs: [120, 220, 340, 500],
  },
  missiles: {
    id: 'missiles',
    name: 'Swarm Pods',
    description: '+2 missiles per salvo, -1s cooldown',
    costs: [160, 280, 420, 600],
  },
};

export const UPGRADE_ORDER: UpgradeId[] = ['damage', 'rate', 'hull', 'missiles'];
