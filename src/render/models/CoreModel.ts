import * as THREE from 'three';
import { PALETTE as C } from '../../config/palette';
import { buildPart } from '../ModelBuilder';

export interface CoreRig {
  root: THREE.Group;
  /** Yaw pivot for the whole gun house. */
  head: THREE.Group;
  /** Recoiling barrel groups (local +Z is forward). */
  barrels: THREE.Group[];
  muzzles: THREE.Object3D[];
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

  const barrels: THREE.Group[] = [];
  const muzzles: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const barrel = new THREE.Group();
    barrel.position.set(side * 0.62, 1.25, 1.3);
    barrel.add(buildPart('core-barrel', (b) => {
      b.box(0.7, 0.7, 1.0, C.playerSteel, { p: [0, 0, 0.3] });
      b.box(0.42, 0.42, 3.6, C.playerSteelDark, { p: [0, 0, 1.9] });
      b.box(0.6, 0.6, 0.5, C.playerSteel, { p: [0, 0, 3.6] });
      b.box(0.46, 0.46, 0.06, C.playerGlow, { p: [0, 0, 3.88], glow: true });
      b.box(0.48, 0.1, 1.4, C.playerGlow, { p: [0, 0.22, 1.5], glow: true });
    }));
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, 4.1);
    barrel.add(muzzle);
    head.add(barrel);
    barrels.push(barrel);
    muzzles.push(muzzle);
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

  return { root, head, barrels, muzzles, pods, orb, ring };
}
