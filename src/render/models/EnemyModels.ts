import * as THREE from 'three';
import type { EnemyKind } from '../../config/enemies';
import { PALETTE as C } from '../../config/palette';
import { buildPart, type PartMaterials } from '../ModelBuilder';

export interface EnemyRig {
  root: THREE.Group;
  /** Bobbing upper body. */
  body: THREE.Group;
  /** Limb pivots, animated by phase (legs swing on X, wings flap on Z). */
  limbs: THREE.Group[];
  limbMode: 'swing' | 'scuttle' | 'flap' | 'glide';
  muzzle: THREE.Object3D;
}

type RigFactory = (m: PartMaterials) => EnemyRig;

function attachMuzzle(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  const muzzle = new THREE.Object3D();
  muzzle.position.set(x, y, z);
  parent.add(muzzle);
  return muzzle;
}

const skitter: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = buildPart('skitter-body', (b) => {
    b.box(1.0, 0.45, 1.3, C.enemyShell, { p: [0, 0.6, 0] });
    b.box(0.8, 0.32, 0.8, C.enemyShellLight, { p: [0, 0.88, -0.15], r: [0.15, 0, 0] });
    b.box(0.62, 0.38, 0.5, C.enemyBone, { p: [0, 0.6, 0.8] });
    b.cone(0.09, 0.55, 4, C.enemyBone, { p: [0.2, 0.5, 1.15], r: [Math.PI / 2, 0, 0.3] });
    b.cone(0.09, 0.55, 4, C.enemyBone, { p: [-0.2, 0.5, 1.15], r: [Math.PI / 2, 0, -0.3] });
    b.box(0.42, 0.08, 0.06, C.enemyGlow, { p: [0, 0.7, 1.06], glow: true });
    b.box(0.3, 0.1, 0.6, C.enemyGlow, { p: [0, 1.06, -0.2], glow: true });
  }, m);
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (let set = 0; set < 2; set++) {
    const legs = buildPart(`skitter-legs-${set}`, (b) => {
      for (let i = 0; i < 3; i++) {
        const side = (i + set) % 2 === 0 ? 1 : -1;
        const z = (i - 1) * 0.45;
        b.box(0.9, 0.1, 0.12, C.enemyBone, { p: [side * 0.75, 0.42, z], r: [0, side * (i - 1) * 0.35, side * -0.55] });
      }
    }, m);
    root.add(legs);
    limbs.push(legs);
  }
  root.scale.setScalar(1.3);
  return { root, body, limbs, limbMode: 'scuttle', muzzle: attachMuzzle(body, 0, 0.6, 1.1) };
};

const strider: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 2.3;
  body.add(buildPart('strider-torso', (b) => {
    b.box(1.5, 0.9, 1.6, C.enemyShell, {});
    b.box(1.2, 0.5, 1.2, C.enemyShellLight, { p: [0, 0.6, -0.2], r: [0.2, 0, 0] });
    b.box(0.9, 0.12, 0.1, C.enemyGlow, { p: [0, 0.15, 0.82], glow: true });
    b.box(0.36, 0.36, 1.5, C.enemyShell, { p: [0.75, -0.15, 0.7] });
    b.box(0.4, 0.4, 0.3, C.enemyBone, { p: [0.75, -0.15, 1.45] });
    b.box(0.25, 0.25, 0.06, C.enemyPlasma, { p: [0.75, -0.15, 1.62], glow: true });
    b.ico(0.38, C.enemyGlow, { p: [0, 0.35, -0.85], glow: true });
    b.cone(0.15, 0.8, 4, C.enemyBone, { p: [-0.5, 0.95, -0.4], r: [-0.4, 0, 0] });
    b.cone(0.15, 0.8, 4, C.enemyBone, { p: [0.3, 0.95, -0.5], r: [-0.5, 0, 0] });
  }, m));
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.62, 2.0, 0);
    hip.add(buildPart('strider-leg', (b) => {
      b.box(0.36, 1.2, 0.4, C.enemyShellLight, { p: [0, -0.55, 0.18], r: [0.3, 0, 0] });
      b.box(0.28, 1.1, 0.28, C.enemyBone, { p: [0, -1.45, 0.12], r: [-0.25, 0, 0] });
      b.box(0.5, 0.16, 0.75, C.enemyShell, { p: [0, -1.95, 0.2] });
    }, m));
    root.add(hip);
    limbs.push(hip);
  }
  return { root, body, limbs, limbMode: 'swing', muzzle: attachMuzzle(body, 0.75, -0.15, 1.75) };
};

const juggernaut: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = buildPart('juggernaut-body', (b) => {
    b.box(3.0, 1.7, 3.8, C.enemyShell, { p: [0, 1.4, 0] });
    b.box(3.3, 1.5, 0.7, C.enemyBone, { p: [0, 1.2, 2.05], r: [0.32, 0, 0] });
    b.cone(0.3, 1.4, 4, C.enemyBone, { p: [1.15, 2.1, 2.2], r: [1.1, 0, -0.3] });
    b.cone(0.3, 1.4, 4, C.enemyBone, { p: [-1.15, 2.1, 2.2], r: [1.1, 0, 0.3] });
    b.dodeca(1.4, C.enemyShellLight, { p: [0, 2.4, -0.5], s: [1.1, 0.6, 1.3] });
    for (const x of [-0.9, 0, 0.9]) b.box(0.24, 0.14, 1.5, C.enemyGlow, { p: [x, 2.85, -0.5], glow: true });
    b.box(1.8, 0.16, 0.1, C.enemyGlow, { p: [0, 1.65, 2.45], r: [0.32, 0, 0], glow: true });
    b.ico(0.45, C.enemyGlowHot, { p: [0, 1.6, -2.0], glow: true });
  }, m);
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const tread = new THREE.Group();
    tread.position.set(side * 1.75, 0, 0);
    tread.add(buildPart('juggernaut-tread', (b) => {
      b.box(0.85, 1.0, 4.1, C.enemyShellLight, { p: [0, 0.55, 0] });
      for (let i = 0; i < 5; i++) b.box(0.95, 0.2, 0.35, C.enemyShell, { p: [0, 0.12, -1.6 + i * 0.8] });
    }, m));
    root.add(tread);
    limbs.push(tread);
  }
  return { root, body, limbs, limbMode: 'scuttle', muzzle: attachMuzzle(body, 0, 1.2, 2.4) };
};

const wasp: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = buildPart('wasp-body', (b) => {
    b.octa(0.6, C.enemyShell, { s: [0.9, 0.7, 1.8] });
    b.ico(0.36, C.enemyBone, { p: [0, 0.05, 0.95] });
    b.cone(0.26, 0.9, 4, C.enemyGlow, { p: [0, -0.05, -1.25], r: [-Math.PI / 2, 0, 0], glow: true });
    b.box(0.34, 0.07, 0.07, C.enemyGlowHot, { p: [0, 0.12, 1.22], glow: true });
    b.cone(0.06, 0.5, 3, C.enemyBone, { p: [0.15, -0.3, 1.0], r: [2.2, 0, 0] });
    b.cone(0.06, 0.5, 3, C.enemyBone, { p: [-0.15, -0.3, 1.0], r: [2.2, 0, 0] });
  }, m);
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.3, 0.3, 0.1);
    wing.add(buildPart(`wasp-wing-${side}`, (b) => {
      b.box(1.7, 0.04, 0.55, C.enemyShellLight, { p: [side * 0.85, 0, 0], r: [0, side * 0.25, 0] });
      b.box(1.4, 0.05, 0.06, C.enemyGlow, { p: [side * 0.8, 0.02, 0.2], r: [0, side * 0.25, 0], glow: true });
    }, m));
    root.add(wing);
    limbs.push(wing);
  }
  return { root, body, limbs, limbMode: 'flap', muzzle: attachMuzzle(body, 0, 0, 1.3) };
};

/** Rocket artillery crawler: a low armoured body on stubby legs with a tilted launch rack. */
const howler: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(buildPart('howler-body', (b) => {
    b.box(1.7, 0.6, 2.1, C.enemyShell, { p: [0, 0.75, 0] });
    b.box(1.3, 0.3, 1.6, C.enemyShellLight, { p: [0, 1.15, -0.2] });
    b.box(0.9, 0.4, 0.5, C.enemyBone, { p: [0, 0.75, 1.2] });
    b.box(0.6, 0.08, 0.06, C.enemyGlow, { p: [0, 0.82, 1.47], glow: true });
    // Launch rack, pitched up toward the target.
    b.box(1.5, 0.9, 1.3, C.enemyShellLight, { p: [0, 1.75, -0.1], r: [-0.55, 0, 0] });
    for (let i = 0; i < 6; i++) {
      const x = ((i % 3) - 1) * 0.42;
      const y = i < 3 ? 0.2 : -0.2;
      b.box(0.24, 0.24, 0.1, C.enemyGlowHot, { p: [x, 1.75 + y * Math.cos(0.55) + 0.36, 0.4 + y * 0.5], r: [-0.55, 0, 0], glow: true });
    }
    b.cone(0.12, 0.6, 4, C.enemyBone, { p: [0.7, 1.35, -0.9], r: [-0.6, 0, 0.3] });
    b.cone(0.12, 0.6, 4, C.enemyBone, { p: [-0.7, 1.35, -0.9], r: [-0.6, 0, -0.3] });
  }, m));
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (let set = 0; set < 2; set++) {
    const legs = buildPart(`howler-legs-${set}`, (b) => {
      for (let i = 0; i < 2; i++) {
        for (const side of [-1, 1]) {
          if ((i + (side > 0 ? 1 : 0) + set) % 2 !== 0) continue;
          b.box(1.0, 0.16, 0.2, C.enemyBone, { p: [side * 1.05, 0.45, (i - 0.5) * 1.3], r: [0, side * (i - 0.5) * 0.4, side * -0.6] });
        }
      }
    }, m);
    root.add(legs);
    limbs.push(legs);
  }
  return { root, body, limbs, limbMode: 'scuttle', muzzle: attachMuzzle(body, 0, 2.3, 0.5) };
};

/** Bomber: broad swept wings, a long chitin fuselage and a glowing bomb bay underneath. */
const vulture: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = buildPart('vulture-body', (b) => {
    b.octa(0.9, C.enemyShell, { s: [1, 0.6, 2.4] });
    b.box(0.9, 0.3, 1.4, C.enemyShellLight, { p: [0, 0.35, -0.3] });
    b.ico(0.45, C.enemyBone, { p: [0, 0.05, 1.9], s: [1, 0.8, 1.2] });
    b.box(0.5, 0.08, 0.08, C.enemyGlowHot, { p: [0, 0.15, 2.38], glow: true });
    b.box(0.7, 0.14, 1.0, C.enemyGlowHot, { p: [0, -0.5, 0], glow: true });
    for (const side of [-1, 1]) {
      b.cone(0.22, 0.7, 5, C.enemyGlow, { p: [side * 0.55, 0, -2.1], r: [-Math.PI / 2, 0, 0], glow: true });
      b.box(0.08, 0.7, 0.8, C.enemyShellLight, { p: [side * 0.35, 0.45, -1.8], r: [0, 0, side * 0.3] });
    }
  }, m);
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.6, 0.1, 0);
    wing.add(buildPart(`vulture-wing-${side}`, (b) => {
      b.box(3.2, 0.1, 1.5, C.enemyShellLight, { p: [side * 1.6, 0, -0.3], r: [0, side * 0.35, 0] });
      b.box(3.0, 0.14, 0.25, C.enemyBone, { p: [side * 1.5, 0.05, 0.35], r: [0, side * 0.35, 0] });
      b.box(2.4, 0.06, 0.08, C.enemyGlow, { p: [side * 1.5, 0.08, -0.4], r: [0, side * 0.35, 0], glow: true });
    }, m));
    root.add(wing);
    limbs.push(wing);
  }
  root.scale.setScalar(0.85);
  return { root, body, limbs, limbMode: 'glide', muzzle: attachMuzzle(body, 0, -0.6, 0) };
};

const leviathan: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 3.2;
  body.add(buildPart('leviathan-body', (b) => {
    b.dodeca(2.7, C.enemyShell, { s: [1.25, 0.75, 1.6] });
    b.dodeca(1.9, C.enemyShellLight, { p: [0, 0.4, -3.2], s: [1.1, 0.7, 1.2] });
    b.box(2.8, 1.7, 2.2, C.enemyBone, { p: [0, -0.2, 3.6], r: [0.15, 0, 0] });
    b.box(3.1, 0.6, 1.0, C.enemyShell, { p: [0, 0.75, 3.5] });
    for (const x of [-0.9, -0.3, 0.3, 0.9]) b.box(0.3, 0.2, 0.1, C.enemyGlowHot, { p: [x, 0.1, 4.72], glow: true });
    for (let i = 0; i < 6; i++) {
      const z = 2.0 - i * 1.1;
      b.cone(0.35, 1.8 - i * 0.12, 4, C.enemyBone, { p: [0, 1.9 - i * 0.08, z], r: [-0.35, 0, 0] });
      b.cone(0.25, 1.2, 4, C.enemyBone, { p: [1.6, 1.2, z], r: [-0.2, 0, -0.6] });
      b.cone(0.25, 1.2, 4, C.enemyBone, { p: [-1.6, 1.2, z], r: [-0.2, 0, 0.6] });
    }
    b.ico(1.0, C.enemyGlow, { p: [0, 0.8, -1.2], glow: true }, 1);
    b.cyl(0.42, 0.55, 2.6, 6, C.enemyShell, { p: [0, 1.6, 1.0], r: [0.9, 0, 0] });
    b.cyl(0.36, 0.36, 0.1, 6, C.enemyPlasma, { p: [0, 2.45, 1.85], r: [0.9, 0, 0], glow: true });
    b.box(4.6, 0.3, 0.3, C.enemyGlow, { p: [0, -0.9, 0], glow: true });
  }, m));
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const hip = new THREE.Group();
    hip.position.set(side * 2.6, 3.0, 2.2 - Math.floor(i / 2) * 2.2);
    hip.rotation.y = side * 0.25;
    hip.add(buildPart(`leviathan-leg-${side}`, (b) => {
      b.box(2.4, 0.6, 0.6, C.enemyShellLight, { p: [side * 1.1, 0.4, 0], r: [0, 0, side * 0.45] });
      b.box(0.5, 3.6, 0.5, C.enemyBone, { p: [side * 2.4, -1.2, 0], r: [0, 0, side * -0.18] });
      b.cone(0.3, 0.8, 4, C.enemyShell, { p: [side * 2.7, -3.0, 0], r: [Math.PI, 0, 0] });
    }, m));
    root.add(hip);
    limbs.push(hip);
  }
  return { root, body, limbs, limbMode: 'swing', muzzle: attachMuzzle(body, 0, 2.5, 1.95) };
};

const FACTORIES: Record<EnemyKind, RigFactory> = { skitter, strider, juggernaut, wasp, howler, vulture, leviathan };

export function createEnemyModel(kind: EnemyKind, materials: PartMaterials): EnemyRig {
  return FACTORIES[kind](materials);
}
