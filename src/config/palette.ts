/** Central colour palette. Glow colours are multiplied above 1.0 at render time to feed the bloom pass. */
export const PALETTE = {
  // Player faction: cold steel with cyan energy.
  playerSteel: 0x5d6b7a,
  playerSteelDark: 0x2e3640,
  playerPlate: 0xa7b2bd,
  playerAccent: 0xe8a33d,
  playerGlow: 0x3fd8ff,
  playerGlowHot: 0xbdf6ff,

  // Hostile swarm: chitin and molten orange/red cores.
  enemyShell: 0x2a1d22,
  enemyShellLight: 0x5a3a35,
  enemyBone: 0xc9b39a,
  /** Maroon armour plates layered over the black chitin. */
  enemyPlate: 0x5a1c2a,
  enemyPlateLight: 0x7c2a3a,
  enemyGlow: 0xff4b1f,
  enemyGlowHot: 0xffb04a,
  enemyPlasma: 0xff2e7e,

  // Effects.
  fireCore: 0xfff1c4,
  fireMid: 0xffa23a,
  fireOuter: 0xd2401b,
  smoke: 0x4a4440,
  smokeLight: 0x7a716a,
  arc: 0x8fb8ff,
  flak: 0xffd36b,

  // Environment colours live in each level's theme (src/levels/catalog.ts).
} as const;
