import { BASALT_BRIDGES, BasaltRift } from './biomes/BasaltRift';
import { CRATER_RAMPS, CrystalCrater } from './biomes/CrystalCrater';
import { SALT_CANYONS, SaltFlats } from './biomes/SaltFlats';
import type { LevelDef, LevelId } from './types';

const gates = (angles: number[], radius: number, width: number) => angles.map((angle) => ({ angle, radius, width }));

export const LEVELS: LevelDef[] = [
  {
    id: 'basalt',
    name: 'Basalt Rift',
    tagline: 'A plateau of hexagonal stone above a chasm of violet mist.',
    features: ['3 bridges in', 'Knock enemies off the edge'],
    swatch: ['#3b3843', '#8e8a97', '#b36bff'],
    gates: gates(BASALT_BRIDGES, 70, 6),
    createBiome: () => new BasaltRift(),
    theme: {
      background: 0x241a35,
      fog: { color: 0x241a35, near: 72, far: 178 },
      hemisphere: { sky: 0x9c8cff, ground: 0x2b2233, intensity: 0.9 },
      sun: { color: 0xffc79a, intensity: 2.4, position: [-38, 62, 28] },
      exposure: 1.1,
      dust: 0x7d7986,
      dustDark: 0x4a4752,
      hazard: { kind: 'chasm', color: 0xb36bff },
      motes: [
        { color: 0xb070ff, intensity: 3.2, count: 170, size: 0.22, drift: [0.3, 1.1, -0.2], sway: 0.6, height: [-8, 14] },
        { color: 0xb8b4c4, intensity: 0.45, count: 260, size: 0.15, drift: [1.3, -0.3, 0.6], sway: 0.9, height: [0, 16] },
      ],
    },
  },
  {
    id: 'salt',
    name: 'Saltglass Expanse',
    tagline: 'Cracked salt flats ringed by striped mesas and sinkholes of brine.',
    features: ['4 canyons in', 'Brine sinkholes swallow the knocked-back'],
    swatch: ['#dcd5e6', '#c68b80', '#463aa0'],
    gates: gates(SALT_CANYONS, 68, 8),
    createBiome: () => new SaltFlats(),
    theme: {
      background: 0x9c8bb6,
      fog: { color: 0x9c8bb6, near: 85, far: 210 },
      hemisphere: { sky: 0xc9b8ff, ground: 0xa8949e, intensity: 0.75 },
      sun: { color: 0xffd9c4, intensity: 1.75, position: [42, 55, 22] },
      exposure: 0.95,
      dust: 0xe0d8ea,
      dustDark: 0xa99eb9,
      hazard: { kind: 'liquid', color: 0x6a55d8 },
      motes: [
        { color: 0xffffff, intensity: 0.9, count: 240, size: 0.12, drift: [1.6, 0.05, 0.4], sway: 0.6, height: [0.3, 7] },
      ],
    },
  },
  {
    id: 'crater',
    name: 'Hollowmere Crater',
    tagline: 'A terraced crater of slate and moss, lit by crystal and spore.',
    features: ['4 ramps down from the rim', 'Glowing fissures on the floor'],
    swatch: ['#56606f', '#8a6a8d', '#ff4fd8'],
    gates: gates(CRATER_RAMPS, 68, 5),
    createBiome: () => new CrystalCrater(),
    theme: {
      background: 0x253042,
      fog: { color: 0x253042, near: 75, far: 182 },
      hemisphere: { sky: 0x9fb6ff, ground: 0x3b3346, intensity: 1.0 },
      sun: { color: 0xe6ecff, intensity: 2.2, position: [-30, 60, -12] },
      exposure: 1.1,
      dust: 0x6c7480,
      dustDark: 0x474e5a,
      hazard: { kind: 'chasm', color: 0xff4fd8 },
      motes: [
        { color: 0xc8ff6a, intensity: 2.2, count: 150, size: 0.2, drift: [0.2, 0.35, -0.1], sway: 1.2, height: [0.5, 10] },
        { color: 0xff7ae0, intensity: 1.6, count: 60, size: 0.16, drift: [-0.3, 0.5, 0.2], sway: 0.8, height: [0, 6] },
      ],
    },
  },
];

export function levelById(id: LevelId): LevelDef {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}
