export type StructureKind = 'repeater' | 'flak' | 'mortar' | 'arc' | 'barrier';

export type TargetLayer = 'ground' | 'air' | 'both';

export interface WeaponDef {
  style: 'gatling' | 'flak' | 'mortar' | 'arc';
  range: number;
  minRange?: number;
  damage: number;
  interval: number;
  targets: TargetLayer;
  turnSpeed: number;
  projectileSpeed?: number;
  splash?: number;
  /** Arc coil: additional enemies the bolt jumps to. */
  chains?: number;
}

export interface StructureDef {
  kind: StructureKind;
  name: string;
  hotkey: string;
  cost: number;
  hp: number;
  radius: number;
  description: string;
  weapon?: WeaponDef;
}

export const STRUCTURES: Record<StructureKind, StructureDef> = {
  repeater: {
    kind: 'repeater',
    name: 'Repeater',
    hotkey: '1',
    cost: 110,
    hp: 380,
    radius: 1,
    description: 'Rotary cannon. Fast fire, short range. Hits ground and air.',
    weapon: { style: 'gatling', range: 15, damage: 9, interval: 0.09, targets: 'both', turnSpeed: 7, projectileSpeed: 70 },
  },
  flak: {
    kind: 'flak',
    name: 'Flak Battery',
    hotkey: '2',
    cost: 150,
    hp: 300,
    radius: 1,
    description: 'Proximity shells that shred flyers. Air only.',
    weapon: { style: 'flak', range: 22, damage: 32, interval: 0.55, targets: 'air', turnSpeed: 6, projectileSpeed: 48, splash: 2.8 },
  },
  mortar: {
    kind: 'mortar',
    name: 'Mortar',
    hotkey: '3',
    cost: 190,
    hp: 300,
    radius: 1,
    description: 'Long-range artillery with heavy splash. Ground only, has a dead zone.',
    weapon: { style: 'mortar', range: 30, minRange: 6, damage: 85, interval: 2.4, targets: 'ground', turnSpeed: 3, projectileSpeed: 20, splash: 3.8 },
  },
  arc: {
    kind: 'arc',
    name: 'Arc Coil',
    hotkey: '4',
    cost: 230,
    hp: 340,
    radius: 1,
    description: 'Lightning that chains between packed enemies.',
    weapon: { style: 'arc', range: 11, damage: 42, interval: 1.1, targets: 'both', turnSpeed: 99, chains: 4 },
  },
  barrier: {
    kind: 'barrier',
    name: 'Barrier',
    hotkey: '5',
    cost: 30,
    hp: 650,
    radius: 1,
    description: 'Armoured wall segment. Blocks ground units. Hold to paint lines.',
  },
};

export const STRUCTURE_ORDER: StructureKind[] = ['repeater', 'flak', 'mortar', 'arc', 'barrier'];
