import type { TargetLayer } from './structures';

export type CoreWeaponId = 'autocannon' | 'scatter' | 'lance' | 'siege';

interface CoreWeaponBase {
  id: CoreWeaponId;
  name: string;
  /** KeyboardEvent.code of the direct-select hotkey, and how it's shown. */
  hotkey: string;
  keyLabel: string;
  icon: string;
  description: string;
  layer: TargetLayer;
}

export interface AutocannonDef extends CoreWeaponBase {
  style: 'autocannon';
  damage: number;
  interval: number;
  range: number;
  speed: number;
  splash: number;
  spread: number;
}

export interface ScatterDef extends CoreWeaponBase {
  style: 'scatter';
  /** Damage per pellet. */
  damage: number;
  pellets: number;
  /** Half-angle of the cone in radians. */
  cone: number;
  interval: number;
  range: number;
  speed: number;
  /** Knockback per pellet. */
  push: number;
}

export interface LanceDef extends CoreWeaponBase {
  style: 'lance';
  /** Damage per second at full charge, to every enemy in the beam. */
  dps: number;
  range: number;
  /** Beam half-width for hit tests. */
  width: number;
  /** Seconds of holding fire to reach full power. */
  chargeTime: number;
}

export interface SiegeDef extends CoreWeaponBase {
  style: 'siege';
  damage: number;
  splash: number;
  interval: number;
  minRange: number;
  range: number;
  /** Explosion size (visual) and blast knockback. */
  blast: number;
  push: number;
}

export type CoreWeaponDef = AutocannonDef | ScatterDef | LanceDef | SiegeDef;

/** Seconds to retract one weapon and bring another online. */
export const WEAPON_SWAP_TIME = 0.7;

export const CORE_WEAPON_ORDER: CoreWeaponId[] = ['autocannon', 'scatter', 'lance', 'siege'];

export const CORE_WEAPONS: Record<CoreWeaponId, CoreWeaponDef> = {
  autocannon: {
    id: 'autocannon', style: 'autocannon', name: 'Autocannon', hotkey: 'KeyA', keyLabel: 'A', icon: '⦀', layer: 'both',
    description: 'Twin rapid-fire cannons with a small blast. Good at everything.',
    damage: 24, interval: 0.13, range: 52, speed: 85, splash: 1.3, spread: 0.025,
  },
  scatter: {
    id: 'scatter', style: 'scatter', name: 'Scatter', hotkey: 'KeyS', keyLabel: 'S', icon: '⋰', layer: 'both',
    description: 'Four stubby barrels fire a wide cone of pellets. Shreds swarms up close and shoves them back.',
    damage: 13, pellets: 7, cone: 0.2, interval: 0.42, range: 26, speed: 75, push: 3.5,
  },
  lance: {
    id: 'lance', style: 'lance', name: 'Lance', hotkey: 'KeyD', keyLabel: 'D', icon: '━', layer: 'both',
    description: 'Hold to channel a beam that pierces every enemy in its line. Builds power the longer it fires.',
    dps: 150, range: 44, width: 0.7, chargeTime: 0.6,
  },
  siege: {
    id: 'siege', style: 'siege', name: 'Siege', hotkey: 'KeyF', keyLabel: 'F', icon: '◓', layer: 'ground',
    description: 'Lobs a heavy shell exactly where you aim, over walls. Huge blast that throws enemies. Ground only.',
    damage: 150, splash: 5, interval: 1.6, minRange: 10, range: 50, blast: 2.6, push: 20,
  },
};
