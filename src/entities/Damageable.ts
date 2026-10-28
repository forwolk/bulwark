import type * as THREE from 'three';

/** Anything enemies can attack: the core and player structures. */
export interface Damageable {
  readonly position: THREE.Vector3;
  readonly radius: number;
  readonly isCore: boolean;
  /** Height enemy projectiles aim at. */
  readonly aimHeight: number;
  readonly alive: boolean;
  hp: number;
  maxHp: number;
  takeDamage(amount: number): void;
}
