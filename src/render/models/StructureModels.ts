import * as THREE from 'three';
import type { StructureKind } from '../../config/structures';
import { PALETTE as C } from '../../config/palette';
import { buildPart, type ModelBuilder, type PartMaterials } from '../ModelBuilder';

export interface StructureRig {
  root: THREE.Group;
  /** Yaw pivot (absent for walls). */
  head?: THREE.Group;
  /** Element that recoils or spins when firing. */
  barrel?: THREE.Group;
  muzzles: THREE.Object3D[];
}

function turretBase(b: ModelBuilder): void {
  b.cyl(1.0, 1.15, 0.5, 6, C.playerSteelDark, { p: [0, 0.25, 0] });
  b.cyl(0.78, 0.9, 0.45, 6, C.playerSteel, { p: [0, 0.72, 0] });
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
    b.box(0.5, 0.1, 0.06, C.playerGlow, { p: [Math.sin(a) * 0.97, 0.5, Math.cos(a) * 0.97], r: [0, a, 0], glow: true });
    b.box(0.35, 0.35, 0.35, C.playerAccent, { p: [Math.sin(a + Math.PI / 3) * 1.05, 0.18, Math.cos(a + Math.PI / 3) * 1.05], r: [0, a, 0] });
  }
}

function muzzleAt(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  const m = new THREE.Object3D();
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

type RigFactory = (m: PartMaterials) => StructureRig;

const repeater: RigFactory = (m) => {
  const root = new THREE.Group();
  root.add(buildPart('turret-base', turretBase, m));
  const head = new THREE.Group();
  head.position.y = 0.95;
  head.add(buildPart('repeater-head', (b) => {
    b.box(1.1, 0.7, 1.25, C.playerPlate, { p: [0, 0.35, -0.1] });
    b.box(0.6, 0.5, 0.6, C.playerSteel, { p: [0, 0.4, -0.85] });
    b.box(0.7, 0.1, 0.06, C.playerGlow, { p: [0, 0.55, 0.53], glow: true });
    b.box(0.25, 0.25, 0.5, C.playerAccent, { p: [0.62, 0.3, -0.2] });
  }, m));
  const barrel = new THREE.Group();
  barrel.position.set(0, 0.35, 0.55);
  barrel.add(buildPart('repeater-barrels', (b) => {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      b.cyl(0.08, 0.08, 1.4, 5, C.playerSteelDark, { p: [Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.7], r: [Math.PI / 2, 0, 0] });
    }
    b.cyl(0.28, 0.28, 0.18, 6, C.playerSteel, { p: [0, 0, 1.1], r: [Math.PI / 2, 0, 0] });
    b.cyl(0.3, 0.3, 0.3, 6, C.playerSteel, { p: [0, 0, 0.15], r: [Math.PI / 2, 0, 0] });
  }, m));
  head.add(barrel);
  root.add(head);
  return { root, head, barrel, muzzles: [muzzleAt(head, 0, 0.35, 2.05)] };
};

const flak: RigFactory = (m) => {
  const root = new THREE.Group();
  root.add(buildPart('turret-base', turretBase, m));
  const head = new THREE.Group();
  head.position.y = 0.95;
  head.add(buildPart('flak-head', (b) => {
    b.box(1.4, 0.65, 1.1, C.playerPlate, { p: [0, 0.35, -0.1] });
    b.box(1.0, 0.25, 0.8, C.playerSteel, { p: [0, 0.78, -0.2] });
    b.box(0.12, 0.4, 0.12, C.playerAccent, { p: [0.5, 1.0, -0.4] });
    b.ico(0.1, C.flak, { p: [0.5, 1.25, -0.4], glow: true });
  }, m));
  const barrel = new THREE.Group();
  barrel.position.set(0, 0.45, 0.25);
  barrel.rotation.x = -0.45;
  barrel.add(buildPart('flak-barrels', (b) => {
    for (const x of [-0.36, 0.36]) {
      b.box(0.26, 0.26, 1.7, C.playerSteelDark, { p: [x, 0, 0.8] });
      b.box(0.34, 0.34, 0.3, C.playerSteel, { p: [x, 0, 1.6] });
      b.box(0.22, 0.22, 0.05, C.flak, { p: [x, 0, 1.77], glow: true });
    }
  }, m));
  head.add(barrel);
  root.add(head);
  return { root, head, barrel, muzzles: [muzzleAt(barrel, -0.36, 0, 1.9), muzzleAt(barrel, 0.36, 0, 1.9)] };
};

const mortar: RigFactory = (m) => {
  const root = new THREE.Group();
  root.add(buildPart('turret-base', turretBase, m));
  const head = new THREE.Group();
  head.position.y = 0.95;
  head.add(buildPart('mortar-head', (b) => {
    b.cyl(0.7, 0.8, 0.45, 8, C.playerPlate, { p: [0, 0.22, 0] });
    b.box(0.3, 0.7, 0.9, C.playerSteel, { p: [0.62, 0.55, 0] });
    b.box(0.3, 0.7, 0.9, C.playerSteel, { p: [-0.62, 0.55, 0] });
  }, m));
  const barrel = new THREE.Group();
  barrel.position.set(0, 0.6, 0);
  barrel.rotation.x = 0.55;
  barrel.add(buildPart('mortar-tube', (b) => {
    b.cyl(0.4, 0.46, 1.7, 8, C.playerSteelDark, { p: [0, 0.6, 0] });
    b.cyl(0.48, 0.48, 0.25, 8, C.playerSteel, { p: [0, 1.35, 0] });
    b.cyl(0.36, 0.36, 0.05, 8, C.playerAccent, { p: [0, 1.49, 0], glow: true });
    b.cyl(0.47, 0.47, 0.1, 8, C.playerGlow, { p: [0, 0.2, 0], glow: true });
  }, m));
  head.add(barrel);
  root.add(head);
  return { root, head, barrel, muzzles: [muzzleAt(barrel, 0, 1.6, 0)] };
};

const arc: RigFactory = (m) => {
  const root = new THREE.Group();
  root.add(buildPart('turret-base', turretBase, m));
  root.add(buildPart('arc-pylon', (b) => {
    b.cyl(0.3, 0.5, 2.3, 6, C.playerSteel, { p: [0, 2.0, 0] });
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      b.box(0.14, 2.0, 0.14, C.playerSteelDark, { p: [Math.sin(a) * 0.55, 1.9, Math.cos(a) * 0.55], r: [Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12] });
    }
    b.cyl(0.6, 0.2, 0.3, 6, C.playerPlate, { p: [0, 3.25, 0] });
  }, m));
  const barrel = new THREE.Group();
  barrel.add(buildPart('arc-coils', (b) => {
    for (let i = 0; i < 3; i++) b.torus(0.62 - i * 0.1, 0.07, C.arc, { p: [0, 1.5 + i * 0.55, 0], r: [Math.PI / 2, 0, 0], glow: true }, 8);
    b.ico(0.42, C.arc, { p: [0, 3.75, 0], glow: true });
  }, m));
  root.add(barrel);
  return { root, barrel, muzzles: [muzzleAt(root, 0, 3.75, 0)] };
};

const barrier: RigFactory = (m) => {
  const root = new THREE.Group();
  root.add(buildPart('barrier', (b) => {
    b.box(1.95, 1.2, 1.95, C.playerSteel, { p: [0, 0.6, 0] });
    b.box(1.7, 0.35, 1.7, C.playerPlate, { p: [0, 1.37, 0] });
    b.box(2.0, 0.1, 2.0, C.playerGlow, { p: [0, 0.95, 0], glow: true });
    b.box(2.02, 0.25, 0.5, C.playerAccent, { p: [0, 0.35, 0] });
    b.box(0.5, 0.25, 2.02, C.playerAccent, { p: [0, 0.35, 0] });
  }, m));
  return { root, muzzles: [] };
};

const FACTORIES: Record<StructureKind, RigFactory> = { repeater, flak, mortar, arc, barrier };

export function createStructureModel(kind: StructureKind, materials: PartMaterials = {}): StructureRig {
  return FACTORIES[kind](materials);
}
