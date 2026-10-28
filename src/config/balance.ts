export const ARENA = {
  /** Enemies appear on this ring, just outside camera view. */
  spawnRadius: 64,
  /** Structures may be placed between these radii from the core. */
  buildMinRadius: 6.5,
  buildMaxRadius: 21,
  gridSize: 2,
} as const;

export const CORE = {
  maxHp: 2000,
  radius: 3.2,
  muzzleHeight: 2.6,
  turnSpeed: 9, // rad/s
  // Main gun modes live in config/coreWeapons.ts.
  missiles: {
    count: 6,
    cooldown: 9,
    damage: 75,
    splash: 2.4,
    speed: 30,
  },
  nova: {
    cooldown: 24,
    radius: 17,
    damage: 160,
    knockback: 22,
    stun: 1.2,
  },
} as const;

export const ECONOMY = {
  startScrap: 500,
  waveBonusBase: 90,
  waveBonusPerWave: 25,
  sellRefund: 0.6,
  /** Fraction of missing HP restored to structures and the core after each wave. */
  interWaveRepair: 0.4,
} as const;
