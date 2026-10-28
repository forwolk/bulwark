import * as THREE from 'three';
import { PALETTE as C } from '../../config/palette';
import type { SquadKind } from '../../config/squads';
import { buildPart, type PartMaterials } from '../ModelBuilder';

export interface AllyRig {
  root: THREE.Group;
  /** Bobbing or banking hull. */
  body: THREE.Group;
  /** Turret that tracks targets independently of the hull, if any. */
  head: THREE.Group | null;
  /** Leg pivots for walkers. */
  limbs: THREE.Group[];
  motion: 'hover' | 'walk' | 'fly';
  muzzles: THREE.Object3D[];
}

type RigFactory = (m: PartMaterials) => AllyRig;

function muzzleAt(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  const muzzle = new THREE.Object3D();
  muzzle.position.set(x, y, z);
  parent.add(muzzle);
  return muzzle;
}

/** Light hover drone: a plated pod over a glowing thruster ring. Forward is +Z. */
const sentinel: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.7;
  body.add(buildPart('sentinel-body', (b) => {
    b.box(0.75, 0.42, 0.9, C.playerPlate, { p: [0, 0.25, 0] });
    b.box(0.6, 0.18, 0.7, C.playerSteel, { p: [0, 0.52, -0.05] });
    b.box(0.5, 0.1, 0.06, C.playerGlow, { p: [0, 0.32, 0.46], glow: true });
    b.box(0.8, 0.08, 0.2, C.playerAccent, { p: [0, 0.2, -0.3] });
    for (const side of [-1, 1]) b.box(0.12, 0.12, 0.55, C.playerSteelDark, { p: [side * 0.3, 0.05, 0.4] });
    b.cyl(0.32, 0.4, 0.14, 8, C.playerSteelDark, { p: [0, -0.02, 0] });
    b.torus(0.3, 0.05, C.playerGlow, { p: [0, -0.1, 0], r: [Math.PI / 2, 0, 0], glow: true }, 12);
  }, m));
  root.add(body);
  return { root, body, head: null, limbs: [], motion: 'hover', muzzles: [muzzleAt(body, 0.3, 0.05, 0.7), muzzleAt(body, -0.3, 0.05, 0.7)] };
};

/** Two-legged walker carrying a long rail lance on its back. */
const lancer: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 2;
  body.add(buildPart('lancer-torso', (b) => {
    b.box(1.2, 0.8, 1.2, C.playerPlate, {});
    b.box(1.0, 0.3, 0.9, C.playerSteel, { p: [0, 0.5, -0.1] });
    b.box(0.6, 0.12, 0.08, C.playerGlow, { p: [0, 0.1, 0.62], glow: true });
    b.box(1.24, 0.16, 0.4, C.playerAccent, { p: [0, -0.2, -0.3] });
    // Rail lance: long barrel with glowing coils.
    b.box(0.32, 0.32, 2.6, C.playerSteelDark, { p: [0.35, 0.75, 0.6] });
    for (let i = 0; i < 4; i++) b.box(0.4, 0.4, 0.12, C.playerGlow, { p: [0.35, 0.75, 0.0 + i * 0.45], glow: true });
    b.box(0.2, 0.2, 0.3, C.playerPlate, { p: [0.35, 0.75, 1.95] });
  }, m));
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.5, 1.75, 0);
    hip.add(buildPart('lancer-leg', (b) => {
      b.box(0.32, 1.0, 0.36, C.playerSteel, { p: [0, -0.45, 0.12], r: [0.25, 0, 0] });
      b.box(0.26, 0.95, 0.26, C.playerSteelDark, { p: [0, -1.25, 0.08], r: [-0.2, 0, 0] });
      b.box(0.46, 0.14, 0.7, C.playerPlate, { p: [0, -1.7, 0.15] });
    }, m));
    root.add(hip);
    limbs.push(hip);
  }
  return { root, body, head: null, limbs, motion: 'walk', muzzles: [muzzleAt(body, 0.35, 0.75, 2.15)] };
};

/** Heavy hover tank: low armoured hull, side thruster pods and a twin-barrel turret. */
const rampart: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.5;
  body.add(buildPart('rampart-hull', (b) => {
    b.box(2.6, 0.8, 3.4, C.playerSteel, { p: [0, 0.4, 0] });
    b.box(2.2, 0.4, 2.8, C.playerPlate, { p: [0, 0.95, -0.1] });
    b.box(2.0, 0.3, 0.5, C.playerAccent, { p: [0, 0.55, 1.6] });
    for (const side of [-1, 1]) {
      b.box(0.6, 0.7, 2.8, C.playerSteelDark, { p: [side * 1.5, 0.3, 0] });
      b.box(0.5, 0.1, 2.2, C.playerGlow, { p: [side * 1.5, -0.08, 0], glow: true });
    }
    b.box(1.8, 0.08, 0.1, C.playerGlow, { p: [0, 0.6, 1.72], glow: true });
  }, m));
  root.add(body);

  const head = new THREE.Group();
  head.position.y = 1.15;
  head.add(buildPart('rampart-turret', (b) => {
    b.cyl(0.9, 1.05, 0.6, 6, C.playerPlate, { p: [0, 0.3, 0] });
    b.box(1.1, 0.4, 0.9, C.playerSteel, { p: [0, 0.65, -0.2] });
    for (const side of [-1, 1]) {
      b.box(0.22, 0.22, 1.8, C.playerSteelDark, { p: [side * 0.28, 0.4, 1.2] });
      b.box(0.3, 0.3, 0.2, C.playerAccent, { p: [side * 0.28, 0.4, 2.1] });
    }
    b.box(0.5, 0.1, 0.06, C.playerGlow, { p: [0, 0.65, 0.26], glow: true });
  }, m));
  body.add(head);
  return { root, body, head, limbs: [], motion: 'hover', muzzles: [muzzleAt(head, 0.28, 0.4, 2.3), muzzleAt(head, -0.28, 0.4, 2.3)] };
};

/** Delta-wing interceptor with twin missile rails and a glowing engine. */
const kestrel: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(buildPart('kestrel-body', (b) => {
    b.box(0.5, 0.35, 2.2, C.playerPlate, {});
    b.cone(0.28, 0.8, 4, C.playerPlate, { p: [0, 0, 1.45], r: [Math.PI / 2, 0, 0] });
    b.box(0.3, 0.16, 0.5, C.playerGlow, { p: [0, 0.22, 0.6], glow: true });
    for (const side of [-1, 1]) {
      b.box(1.5, 0.06, 1.2, C.playerSteel, { p: [side * 0.85, -0.05, -0.2], r: [0, side * -0.45, 0] });
      b.box(0.5, 0.06, 0.12, C.playerAccent, { p: [side * 1.35, -0.02, -0.65], r: [0, side * -0.45, 0] });
      b.box(0.14, 0.14, 0.8, C.playerSteelDark, { p: [side * 0.6, -0.15, 0.3] });
      b.box(0.06, 0.5, 0.5, C.playerSteel, { p: [side * 0.25, 0.3, -0.85] });
    }
    b.cone(0.22, 0.5, 6, C.playerGlow, { p: [0, 0, -1.3], r: [-Math.PI / 2, 0, 0], glow: true });
  }, m));
  root.add(body);
  return { root, body, head: null, limbs: [], motion: 'fly', muzzles: [muzzleAt(body, 0.6, -0.15, 0.75), muzzleAt(body, -0.6, -0.15, 0.75)] };
};

const FACTORIES: Record<SquadKind, RigFactory> = { sentinel, lancer, rampart, kestrel };

export function createAllyModel(kind: SquadKind, materials: PartMaterials): AllyRig {
  return FACTORIES[kind](materials);
}
