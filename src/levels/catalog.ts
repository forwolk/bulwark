import { DUNE_CANYONS, DuneSea } from './biomes/DuneSea';
import { ISLE_BRIDGES, LakeIsles } from './biomes/LakeIsles';
import { HOLLOW_RAMPS, RuinedHollow } from './biomes/RuinedHollow';
import type { LevelDef, LevelId } from './types';

const gates = (angles: number[], radius: number, width: number) => angles.map((angle) => ({ angle, radius, width }));

export const LEVELS: LevelDef[] = [
  {
    id: 'isles',
    name: 'Mirrorlake Isles',
    tagline: 'A green island in a still lake, ringed by pine woods.',
    features: ['3 land bridges in', 'Knock enemies into the lake'],
    swatch: ['#6f9c48', '#ab7c4e', '#23394a'],
    gates: gates(ISLE_BRIDGES, 70, 6),
    createBiome: () => new LakeIsles(),
    theme: {
      background: 0xb9d3df,
      fog: { color: 0xb9d3df, near: 95, far: 230 },
      hemisphere: { sky: 0xd8ebff, ground: 0x5d7a45, intensity: 1.25 },
      sun: { color: 0xfff2df, intensity: 2.7, position: [-38, 62, 28] },
      exposure: 1,
      bloom: { threshold: 1.5, strength: 0.55 },
      dust: 0x9a8360,
      dustDark: 0x6f5c42,
      hazard: { kind: 'liquid', color: 0xdcefff },
      motes: [
        { color: 0xfff3b0, intensity: 0.7, count: 70, size: 0.12, drift: [0.4, 0.15, 0.2], sway: 1.2, height: [0.5, 5] },
      ],
    },
  },
  {
    id: 'dunes',
    name: 'Sunscar Dunes',
    tagline: 'Pale desert flats walled in by banded sandstone mesas.',
    features: ['4 canyons in', 'Quicksand swallows the knocked-back'],
    swatch: ['#f0e6cf', '#c99365', '#5f8e4c'],
    gates: gates(DUNE_CANYONS, 68, 8),
    createBiome: () => new DuneSea(),
    theme: {
      background: 0xeadcc4,
      fog: { color: 0xeadcc4, near: 95, far: 230 },
      hemisphere: { sky: 0xe2ecff, ground: 0xd9c39a, intensity: 1 },
      sun: { color: 0xfff0d8, intensity: 2.5, position: [42, 55, 22] },
      exposure: 0.95,
      bloom: { threshold: 2.2, strength: 0.5 },
      dust: 0xe3d2ae,
      dustDark: 0xb99d72,
      hazard: { kind: 'liquid', color: 0xd8bf8f },
      motes: [
        { color: 0xf3e2bd, intensity: 0.5, count: 120, size: 0.12, drift: [1.8, 0.05, 0.5], sway: 0.6, height: [0.3, 4] },
      ],
    },
  },
  {
    id: 'hollow',
    name: 'Mossgate Hollow',
    tagline: 'A grassy hollow of stone terraces and old standing stones.',
    features: ['4 ramps down from the rim', 'Ravines with a stream below'],
    swatch: ['#76a04a', '#a3a29b', '#c9b58e'],
    gates: gates(HOLLOW_RAMPS, 68, 5),
    createBiome: () => new RuinedHollow(),
    theme: {
      background: 0xbcd4cf,
      fog: { color: 0xbcd4cf, near: 95, far: 225 },
      hemisphere: { sky: 0xd6e8ff, ground: 0x5a7a42, intensity: 1.2 },
      sun: { color: 0xfff3e2, intensity: 2.6, position: [-30, 60, -12] },
      exposure: 1,
      bloom: { threshold: 1.5, strength: 0.55 },
      dust: 0x8f7a58,
      dustDark: 0x665640,
      hazard: { kind: 'liquid', color: 0xdcefff },
      motes: [
        { color: 0xd8ff9a, intensity: 0.8, count: 60, size: 0.12, drift: [0.2, 0.25, -0.1], sway: 1.4, height: [0.5, 6] },
      ],
    },
  },
];

export function levelById(id: LevelId): LevelDef {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}
