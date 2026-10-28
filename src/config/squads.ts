import type { TargetLayer } from './structures';

export type SquadKind = 'sentinel' | 'lancer' | 'rampart' | 'kestrel';

export type AllyWeaponStyle = 'blaster' | 'rail' | 'cannon' | 'missiles';

export interface AllyWeaponDef {
  style: AllyWeaponStyle;
  range: number;
  damage: number;
  interval: number;
  targets: TargetLayer;
  projectileSpeed?: number;
  splash?: number;
}

export interface AllyUnitDef {
  hp: number;
  speed: number;
  radius: number;
  flying: boolean;
  /** Hover or flight height above the ground. */
  altitude: number;
  /** Height enemies aim at, above the unit's feet. */
  aimHeight: number;
  turnSpeed: number;
  weapon: AllyWeaponDef;
  /** Explosion scale on death. */
  deathSize: number;
}

export interface SquadDef {
  kind: SquadKind;
  name: string;
  /** KeyboardEvent.code of the deploy hotkey, and how it's shown. */
  hotkey: string;
  keyLabel: string;
  cost: number;
  /** Seconds before another squad of this kind can deploy. */
  cooldown: number;
  size: number;
  /** Distance between squad members at their guard post. */
  spacing: number;
  description: string;
  unit: AllyUnitDef;
}

/** Most squads that can be in the field at once. */
export const SQUAD_CAP = 6;

/** How far squad members will chase from their guard post. */
export const SQUAD_LEASH = 12;

export const SQUAD_ORDER: SquadKind[] = ['sentinel', 'lancer', 'rampart', 'kestrel'];

export const SQUADS: Record<SquadKind, SquadDef> = {
  sentinel: {
    kind: 'sentinel',
    name: 'Sentinels',
    hotkey: 'KeyQ',
    keyLabel: 'Q',
    cost: 120,
    cooldown: 8,
    size: 6,
    spacing: 1.8,
    description: 'Six light hover drones with rapid blasters. Cheap and fast; hit ground and air.',
    unit: {
      hp: 90, speed: 6.5, radius: 0.6, flying: false, altitude: 0.7, aimHeight: 0.9, turnSpeed: 8, deathSize: 0.8,
      weapon: { style: 'blaster', range: 13, damage: 7, interval: 0.32, targets: 'both', projectileSpeed: 70 },
    },
  },
  lancer: {
    kind: 'lancer',
    name: 'Lancers',
    hotkey: 'KeyW',
    keyLabel: 'W',
    cost: 200,
    cooldown: 14,
    size: 3,
    spacing: 2.6,
    description: 'Three walkers with charged rail beams. Slow, but each shot punches through armour.',
    unit: {
      hp: 260, speed: 3.4, radius: 1, flying: false, altitude: 0, aimHeight: 2, turnSpeed: 4, deathSize: 1.3,
      weapon: { style: 'rail', range: 20, damage: 75, interval: 2.2, targets: 'ground' },
    },
  },
  rampart: {
    kind: 'rampart',
    name: 'Rampart',
    hotkey: 'KeyE',
    keyLabel: 'E',
    cost: 320,
    cooldown: 22,
    size: 1,
    spacing: 0,
    description: 'One heavy hover tank. Soaks up punishment and shells crowds with splash rounds.',
    unit: {
      hp: 1400, speed: 2.4, radius: 2, flying: false, altitude: 0.5, aimHeight: 1.5, turnSpeed: 2.5, deathSize: 2.4,
      weapon: { style: 'cannon', range: 18, damage: 60, interval: 1.5, targets: 'ground', projectileSpeed: 55, splash: 3 },
    },
  },
  kestrel: {
    kind: 'kestrel',
    name: 'Kestrels',
    hotkey: 'KeyR',
    keyLabel: 'R',
    cost: 260,
    cooldown: 18,
    size: 3,
    spacing: 3.2,
    description: 'Three interceptors that circle their post and rain homing missiles on ground and air targets.',
    unit: {
      hp: 220, speed: 11, radius: 0.9, flying: true, altitude: 7, aimHeight: 0, turnSpeed: 3, deathSize: 1.2,
      weapon: { style: 'missiles', range: 22, damage: 28, interval: 2.4, targets: 'both', splash: 2 },
    },
  },
};
