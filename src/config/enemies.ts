export type EnemyKind = 'skitter' | 'strider' | 'juggernaut' | 'wasp' | 'howler' | 'vulture' | 'leviathan';

export type EnemyAttackStyle = 'melee' | 'bolt' | 'laser' | 'artillery' | 'rockets' | 'bombs';

export interface EnemyAttackDef {
  style: EnemyAttackStyle;
  /** Distance from the edge of the target at which the enemy stops and attacks. */
  range: number;
  damage: number;
  interval: number;
  projectileSpeed?: number;
  splash?: number;
  /** Rockets per salvo, or bombs per stick. */
  salvo?: number;
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
  /** Bombers fly continuous passes over their target instead of stopping to attack. */
  bomber?: { turnRate: number };
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
  howler: {
    kind: 'howler',
    name: 'Howler',
    hp: 190,
    speed: 2.6,
    radius: 1.3,
    armor: 2,
    flying: false,
    altitude: 0,
    reward: 26,
    deathSize: 1.5,
    aggroRange: 30,
    attack: { style: 'rockets', range: 30, damage: 26, interval: 5.5, splash: 2.6, salvo: 4 },
    showHealthBar: true,
  },
  vulture: {
    kind: 'vulture',
    name: 'Vulture',
    hp: 240,
    speed: 9,
    radius: 1.6,
    armor: 1,
    flying: true,
    // Cruises above the core's dome so its bombs fall onto the shield, not inside it.
    altitude: 18,
    reward: 32,
    deathSize: 1.8,
    aggroRange: 40,
    attack: { style: 'bombs', range: 0, damage: 55, interval: 3.4, splash: 3.6, salvo: 3 },
    bomber: { turnRate: 1.1 },
    showHealthBar: true,
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
