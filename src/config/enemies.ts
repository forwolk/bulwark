export type EnemyKind = 'skitter' | 'strider' | 'juggernaut' | 'wasp' | 'leviathan';

export type EnemyAttackStyle = 'melee' | 'bolt' | 'laser' | 'artillery';

export interface EnemyAttackDef {
  style: EnemyAttackStyle;
  /** Distance from the edge of the target at which the enemy stops and attacks. */
  range: number;
  damage: number;
  interval: number;
  projectileSpeed?: number;
  splash?: number;
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  /** Flat damage reduction per hit (min 25% of damage always gets through). */
  armor: number;
  flying: boolean;
  altitude: number;
  reward: number;
  /** Explosion scale on death. */
  deathSize: number;
  /** Structures within this distance pull the enemy off its path to the core. */
  aggroRange: number;
  attack: EnemyAttackDef;
  spawner?: { kind: EnemyKind; count: number; interval: number };
  showHealthBar?: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  skitter: {
    kind: 'skitter',
    name: 'Skitter',
    hp: 45,
    speed: 7.5,
    radius: 0.7,
    armor: 0,
    flying: false,
    altitude: 0,
    reward: 5,
    deathSize: 0.7,
    aggroRange: 3,
    attack: { style: 'melee', range: 0.3, damage: 12, interval: 0.7 },
  },
  strider: {
    kind: 'strider',
    name: 'Strider',
    hp: 150,
    speed: 3.6,
    radius: 1.0,
    armor: 2,
    flying: false,
    altitude: 0,
    reward: 12,
    deathSize: 1.1,
    aggroRange: 16,
    attack: { style: 'bolt', range: 14, damage: 18, interval: 1.7, projectileSpeed: 26 },
  },
  juggernaut: {
    kind: 'juggernaut',
    name: 'Juggernaut',
    hp: 900,
    speed: 2.1,
    radius: 1.9,
    armor: 8,
    flying: false,
    altitude: 0,
    reward: 45,
    deathSize: 2.2,
    aggroRange: 4,
    attack: { style: 'melee', range: 0.5, damage: 70, interval: 1.6 },
    showHealthBar: true,
  },
  wasp: {
    kind: 'wasp',
    name: 'Wasp',
    hp: 70,
    speed: 8.5,
    radius: 0.9,
    armor: 0,
    flying: true,
    altitude: 4.5,
    reward: 9,
    deathSize: 0.9,
    aggroRange: 10,
    attack: { style: 'laser', range: 7, damage: 7, interval: 0.75 },
  },
  leviathan: {
    kind: 'leviathan',
    name: 'Leviathan',
    hp: 14000,
    speed: 1.25,
    radius: 4.2,
    armor: 12,
    flying: false,
    altitude: 0,
    reward: 600,
    deathSize: 5,
    aggroRange: 8,
    attack: { style: 'artillery', range: 24, damage: 90, interval: 2.6, projectileSpeed: 22, splash: 4 },
    spawner: { kind: 'skitter', count: 4, interval: 7 },
    showHealthBar: true,
  },
};
