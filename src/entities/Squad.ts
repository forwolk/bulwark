import * as THREE from 'three';
import type { SquadDef } from '../config/squads';
import type { Ally } from './Ally';

let nextId = 1;

/** A group of allies deployed together and guarding one post. */
export class Squad {
  readonly id = nextId++;
  readonly members: Ally[] = [];
  /** Guard point the squad holds, and the direction it faces (outward, toward the lane). */
  readonly post = new THREE.Vector3();
  facing = 0;
  /** Index of the level gate (lane) this squad guards. */
  lane = 0;

  constructor(readonly def: SquadDef) {}

  get alive(): boolean {
    return this.members.some((m) => m.alive);
  }

  /** Formation slot for a member: a loose line across the lane, facing outward. */
  slotPosition(slot: number, out: THREE.Vector3): THREE.Vector3 {
    const n = this.def.size;
    const across = (slot - (n - 1) / 2) * this.def.spacing;
    // Big squads stagger into two rows.
    const row = n > 4 ? (slot % 2) * this.def.spacing * 0.8 : 0;
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    return out.set(this.post.x + fz * across - fx * row, this.post.y, this.post.z - fx * across - fz * row);
  }
}
