import * as THREE from 'three';
import { PALETTE as C } from '../../config/palette';
import type { CoreWeaponId } from '../../config/coreWeapons';
import { buildPart } from '../ModelBuilder';

export interface WeaponMount {
  /** Whole assembly; scaled down and up during weapon swaps. */
  group: THREE.Group;
  /** Recoiling slides. Each slides back along its own local Z; rest position is in userData.restZ. */
  barrels: THREE.Group[];
  muzzles: THREE.Object3D[];
}

/** A recoil slide at `z` inside `parent`, with a muzzle `length` ahead of it. */
function slide(parent: THREE.Object3D, x: number, y: number, z: number, length: number): { barrel: THREE.Group; muzzle: THREE.Object3D } {
  const barrel = new THREE.Group();
  barrel.position.set(x, y, z);
  barrel.userData.restZ = z;
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, length);
  barrel.add(muzzle);
  parent.add(barrel);
  return { barrel, muzzle };
}

/** Twin long barrels: the all-round default. */
function autocannonMount(): WeaponMount {
  const group = new THREE.Group();
  const barrels: THREE.Group[] = [];
  const muzzles: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const { barrel, muzzle } = slide(group, side * 0.62, 1.25, 1.3, 4.1);
    barrel.add(buildPart('core-barrel', (b) => {
      b.box(0.7, 0.7, 1.0, C.playerSteel, { p: [0, 0, 0.3] });
      b.box(0.42, 0.42, 3.6, C.playerSteelDark, { p: [0, 0, 1.9] });
      b.box(0.6, 0.6, 0.5, C.playerSteel, { p: [0, 0, 3.6] });
      b.box(0.46, 0.46, 0.06, C.playerGlow, { p: [0, 0, 3.88], glow: true });
      b.box(0.48, 0.1, 1.4, C.playerGlow, { p: [0, 0.22, 1.5], glow: true });
    }));
    barrels.push(barrel);
    muzzles.push(muzzle);
  }
  return { group, barrels, muzzles };
}

/** Four stubby wide-bore barrels in a block, hazard-striped. */
function scatterMount(): WeaponMount {
  const group = new THREE.Group();
  group.add(buildPart('core-scatter-housing', (b) => {
    b.box(2, 1.5, 1.2, C.playerSteel, { p: [0, 1.25, 1.6] });
    b.box(2.04, 0.2, 0.5, C.playerAccent, { p: [0, 2.05, 1.6] });
    b.box(2.04, 0.2, 0.5, C.playerAccent, { p: [0, 0.45, 1.6] });
  }));
  const barrels: THREE.Group[] = [];
  const muzzles: THREE.Object3D[] = [];
  for (const [x, y] of [[-0.45, 1.6], [0.45, 1.6], [-0.45, 0.9], [0.45, 0.9]]) {
    const { barrel, muzzle } = slide(group, x, y, 2.1, 1.9);
    barrel.add(buildPart('core-scatter-barrel', (b) => {
      b.box(0.52, 0.52, 1.6, C.playerSteelDark, { p: [0, 0, 0.8] });
      b.box(0.64, 0.64, 0.3, C.playerSteel, { p: [0, 0, 1.6] });
      b.box(0.4, 0.4, 0.05, C.playerAccent, { p: [0, 0, 1.77], glow: true });
    }));
    barrels.push(barrel);
    muzzles.push(muzzle);
  }
  return { group, barrels, muzzles };
}

/** A single long emitter ringed with glowing focusing coils. */
function lanceMount(): WeaponMount {
  const group = new THREE.Group();
  const { barrel, muzzle } = slide(group, 0, 1.3, 1.3, 5.2);
  barrel.add(buildPart('core-lance', (b) => {
    b.box(1.1, 1.0, 1.2, C.playerSteel, { p: [0, 0, 0.3] });
    b.box(0.5, 0.5, 4.4, C.playerSteelDark, { p: [0, 0, 2.6] });
    for (const z of [1.3, 2.2, 3.1, 4.0]) b.torus(0.42, 0.08, C.playerGlow, { p: [0, 0, z], glow: true }, 10);
    for (const side of [-1, 1]) b.box(0.08, 0.7, 2.6, C.playerPlate, { p: [side * 0.38, 0, 2.4] });
    b.octa(0.34, C.playerGlowHot, { p: [0, 0, 4.95], s: [1, 1, 1.7], glow: true });
  }));
  return { group, barrels: [barrel], muzzles: [muzzle] };
}

/** A heavy mortar tube tilted skyward on a trunnion block. */
function siegeMount(): WeaponMount {
  const group = new THREE.Group();
  group.add(buildPart('core-siege-base', (b) => {
    b.box(1.8, 1.0, 1.6, C.playerSteel, { p: [0, 1.0, 1.0] });
    for (const side of [-1, 1]) b.box(0.3, 1.2, 0.9, C.playerSteelDark, { p: [side * 0.95, 1.4, 1.0] });
    b.box(1.84, 0.18, 0.4, C.playerAccent, { p: [0, 0.6, 1.0] });
  }));
  const tilt = new THREE.Group();
  tilt.position.set(0, 1.6, 1.0);
  // Rotating -0.75 rad about X points the tube's +Z up and forward.
  tilt.rotation.x = -0.75;
  group.add(tilt);
  const { barrel, muzzle } = slide(tilt, 0, 0, 0, 3.3);
  barrel.add(buildPart('core-siege-tube', (b) => {
    b.cyl(0.62, 0.7, 3.2, 8, C.playerSteelDark, { p: [0, 0, 1.4], r: [Math.PI / 2, 0, 0] });
    for (const z of [0.3, 1.5, 2.7]) b.cyl(0.76, 0.76, 0.22, 8, C.playerSteel, { p: [0, 0, z], r: [Math.PI / 2, 0, 0] });
    b.torus(0.62, 0.06, C.playerGlow, { p: [0, 0, 3.0], glow: true }, 12);
  }));
  return { group, barrels: [barrel], muzzles: [muzzle] };
}

export interface CoreRig {
  root: THREE.Group;
  /** Yaw pivot for the whole gun house. */
  head: THREE.Group;
  /** One barrel assembly per weapon mode; only the active one is shown. */
  weapons: Record<CoreWeaponId, WeaponMount>;
  /** Missile pod launch points. */
  pods: THREE.Object3D[];
  orb: THREE.Group;
  ring: THREE.Group;
}

/** The player's central fortress gun ("Bastion"). Forward is +Z. */
export function createCoreModel(): CoreRig {
  const root = new THREE.Group();

  root.add(buildPart('core-base', (b) => {
    b.cyl(4.3, 4.8, 0.8, 8, C.playerSteelDark, { p: [0, 0.4, 0] });
    b.cyl(3.7, 4.1, 0.6, 8, C.playerSteel, { p: [0, 1.0, 0] });
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const x = Math.sin(a) * 3.9;
      const z = Math.cos(a) * 3.9;
      b.box(1.3, 1.5, 2.2, C.playerPlate, { p: [x, 0.75, z], r: [0, a, 0] });
      b.box(1.34, 0.22, 0.6, C.playerAccent, { p: [x, 1.2, z], r: [0, a, 0] });
      b.box(0.5, 0.5, 0.5, C.playerSteelDark, { p: [Math.sin(a) * 5, 0.25, Math.cos(a) * 5], r: [0, a, 0] });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      b.box(1.3, 0.14, 0.1, C.playerGlow, { p: [Math.sin(a) * 3.82, 1.05, Math.cos(a) * 3.82], r: [0, a, 0], glow: true });
    }
  }));

  const head = new THREE.Group();
  head.position.y = 1.3;
  root.add(head);

  head.add(buildPart('core-head', (b) => {
    b.cyl(2.4, 2.7, 0.5, 8, C.playerSteel, { p: [0, 0.25, 0] });
    b.box(3.3, 1.4, 3.4, C.playerPlate, { p: [0, 1.15, -0.3] });
    b.box(2.6, 0.5, 2.3, C.playerSteel, { p: [0, 2.05, -0.6] });
    b.box(0.55, 1.2, 2.8, C.playerSteelDark, { p: [1.85, 1.05, 0], r: [0, 0, -0.22] });
    b.box(0.55, 1.2, 2.8, C.playerSteelDark, { p: [-1.85, 1.05, 0], r: [0, 0, 0.22] });
    b.box(2.1, 1.1, 1.1, C.playerSteelDark, { p: [0, 1.05, -2.4] });
    b.box(1.7, 0.18, 0.1, C.playerGlow, { p: [0, 1.05, -2.97], glow: true });
    b.box(1.9, 0.16, 0.1, C.playerGlow, { p: [0, 1.6, 1.42], glow: true });
    b.box(0.3, 0.3, 0.3, C.playerAccent, { p: [1.2, 2.4, -1.4] });
    b.cyl(0.05, 0.05, 1.4, 4, C.playerSteelDark, { p: [1.2, 3.0, -1.4] });
    // Missile pods on both flanks.
    for (const side of [-1, 1]) {
      b.box(0.9, 0.9, 1.6, C.playerSteel, { p: [side * 2.3, 1.6, -0.6] });
      for (let i = 0; i < 2; i++) {
        b.box(0.22, 0.22, 0.05, C.playerAccent, { p: [side * 2.3 + (i - 0.5) * 0.36, 1.75, 0.22], glow: true });
      }
    }
  }));

  const weapons: Record<CoreWeaponId, WeaponMount> = {
    autocannon: autocannonMount(),
    scatter: scatterMount(),
    lance: lanceMount(),
    siege: siegeMount(),
  };
  for (const id of Object.keys(weapons) as CoreWeaponId[]) {
    head.add(weapons[id].group);
    weapons[id].group.visible = id === 'autocannon';
  }

  const pods: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const pod = new THREE.Object3D();
    pod.position.set(side * 2.3, 1.7, 0.4);
    head.add(pod);
    pods.push(pod);
  }

  const orb = new THREE.Group();
  orb.position.set(0, 3.3, -0.8);
  orb.add(buildPart('core-orb', (b) => b.ico(0.5, C.playerGlowHot, { glow: true })));
  head.add(orb);

  const ring = new THREE.Group();
  ring.position.copy(orb.position);
  ring.add(buildPart('core-ring', (b) => b.torus(0.95, 0.06, C.playerGlow, { r: [Math.PI / 2, 0, 0], glow: true }, 14)));
  head.add(ring);

  return { root, head, weapons, pods, orb, ring };
}
