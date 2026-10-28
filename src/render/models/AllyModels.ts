import * as THREE from 'three';
import { PALETTE as C } from '../../config/palette';
import type { SquadKind } from '../../config/squads';
import { buildPart, type ModelBuilder, type PartMaterials } from '../ModelBuilder';

export interface AllyRig {
  root: THREE.Group;
  /** Bobbing or banking hull. */
  body: THREE.Group;
  /** Rest height of `body`. */
  bodyY: number;
  /** Turret that tracks targets independently of the hull, if any. */
  head: THREE.Group | null;
  /** Hip pivots for walkers. */
  limbs: THREE.Group[];
  /** Knee pivots for walkers, one per limb. */
  joints: THREE.Group[];
  motion: 'hover' | 'walk' | 'fly';
  muzzles: THREE.Object3D[];
}

type RigFactory = (m: PartMaterials) => AllyRig;
type V3 = [number, number, number];

// Defender palette: light armour plates over gunmetal frames, amber hazard trim, cyan lights.
const PLATE = C.playerPlate;
const STEEL = C.playerSteel;
const DARK = C.playerSteelDark;
const AMBER = C.playerAccent;
const GLOW = C.playerGlow;

function muzzleAt(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  const muzzle = new THREE.Object3D();
  muzzle.position.set(x, y, z);
  parent.add(muzzle);
  return muzzle;
}

/** Diagonal hazard stripes painted across a flat area (centre, width along X). */
function hazard(b: ModelBuilder, at: V3, width: number, count: number, yaw = 0): void {
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * (width / count);
    b.box(width / count / 2.2, 0.025, width * 0.45, AMBER, {
      p: [at[0] + Math.cos(yaw) * x, at[1], at[2] - Math.sin(yaw) * x], r: [0, yaw + 0.6, 0],
    });
  }
}

/** Thin antenna with an amber tip. */
function antenna(b: ModelBuilder, base: V3, height: number): void {
  b.strut(base, [base[0], base[1] + height, base[2]], 0.025, 0.02, 4, DARK);
  b.box(0.06, 0.1, 0.06, AMBER, { p: [base[0], base[1] + height, base[2]] });
}

/** Small hover drone: plated hex body, twin blaster pods and a glowing thruster ring. Forward is +Z. */
const sentinel: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.7;
  body.add(buildPart('sentinel-body', (b) => {
    b.cyl(0.5, 0.42, 0.18, 8, DARK, { p: [0, -0.02, 0], r: [0, Math.PI / 8, 0] });
    b.bevelBox(0.92, 0.4, 0.92, 0.16, PLATE, { p: [0, 0.22, 0] });
    b.cyl(0.36, 0.42, 0.14, 8, STEEL, { p: [0, 0.48, -0.04], r: [0, Math.PI / 8, 0] });
    b.torus(0.28, 0.035, GLOW, { p: [0, 0.56, -0.04], r: [Math.PI / 2, 0, 0], glow: true }, 12);
    b.cyl(0.2, 0.22, 0.08, 8, DARK, { p: [0, 0.58, -0.04] });
    antenna(b, [0.22, 0.55, -0.25], 0.42);
    // Visor and hazard trim.
    b.box(0.44, 0.08, 0.05, GLOW, { p: [0, 0.27, 0.47], glow: true });
    b.wedge(0.6, 0.1, 0.25, 0.5, STEEL, { p: [0, 0.38, 0.32] }, 0.8);
    hazard(b, [-0.24, 0.43, 0.18], 0.32, 2);
    hazard(b, [0.24, 0.43, 0.18], 0.32, 2);
    // Rear vents.
    for (const x of [-0.2, 0, 0.2]) b.box(0.1, 0.18, 0.04, DARK, { p: [x, 0.2, -0.47] });
    // Twin blaster pods.
    for (const s of [-1, 1]) {
      b.bevelBox(0.24, 0.26, 0.62, 0.07, DARK, { p: [s * 0.56, 0.12, 0.12] });
      b.box(0.25, 0.05, 0.3, AMBER, { p: [s * 0.56, 0.26, 0.05] });
      b.strut([s * 0.56, 0.1, 0.4], [s * 0.56, 0.1, 0.78], 0.065, 0.06, 6, STEEL);
      b.cyl(0.075, 0.075, 0.05, 6, GLOW, { p: [s * 0.56, 0.1, 0.8], r: [Math.PI / 2, 0, 0], glow: true });
    }
    // Thruster ring and glow disc underneath.
    b.torus(0.34, 0.05, GLOW, { p: [0, -0.13, 0], r: [Math.PI / 2, 0, 0], glow: true }, 14);
    b.cyl(0.24, 0.24, 0.02, 10, GLOW, { p: [0, -0.14, 0], glow: true });
  }, m));
  root.add(body);
  return {
    root, body, bodyY: 0.7, head: null, limbs: [], joints: [], motion: 'hover',
    muzzles: [muzzleAt(body, 0.56, 0.1, 0.85), muzzleAt(body, -0.56, 0.1, 0.85)],
  };
};

/** Slim biped carrying a long rail lance over its right shoulder. */
const lancer: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 2;
  body.add(buildPart('lancer-torso', (b) => {
    b.bevelBox(0.62, 0.32, 0.46, 0.08, DARK, { p: [0, -0.28, 0] });
    b.bevelBox(0.92, 0.66, 0.66, 0.14, PLATE, { p: [0, 0.22, 0] });
    b.wedge(0.8, 0.3, 0.3, 0.6, PLATE, { p: [0, 0.18, 0.3] }, 0.8);
    b.box(0.5, 0.05, 0.04, GLOW, { p: [0, 0.38, 0.35], glow: true });
    hazard(b, [-0.24, 0.57, 0.05], 0.3, 2);
    // Head with visor and antenna.
    b.bevelBox(0.36, 0.28, 0.36, 0.08, PLATE, { p: [-0.1, 0.72, 0.12] });
    b.box(0.26, 0.06, 0.04, GLOW, { p: [-0.1, 0.74, 0.31], glow: true });
    antenna(b, [-0.22, 0.86, 0.0], 0.35);
    // Backpack.
    b.bevelBox(0.66, 0.55, 0.32, 0.08, DARK, { p: [0, 0.25, -0.46] });
    for (const x of [-0.18, 0.18]) b.box(0.12, 0.3, 0.04, GLOW, { p: [x, 0.25, -0.63], glow: true });
    // Left arm.
    b.wedge(0.36, 0.22, 0.42, 0.3, STEEL, { p: [-0.6, 0.45, 0] }, 0.7);
    b.strut([-0.62, 0.42, 0], [-0.66, -0.05, 0.12], 0.09, 0.08, 6, DARK);
    b.strut([-0.66, -0.05, 0.12], [-0.62, -0.42, 0.35], 0.08, 0.07, 6, PLATE);
    // Rail lance: gunmetal core, plated housing with hazard stripes, cyan coils, muzzle and counterweight.
    b.bevelBox(0.42, 0.34, 0.5, 0.08, DARK, { p: [0.42, 0.62, 0.0] });
    b.bevelBox(0.3, 0.3, 3.0, 0.07, DARK, { p: [0.42, 0.78, 0.65] });
    b.bevelBox(0.38, 0.24, 0.9, 0.06, PLATE, { p: [0.42, 0.95, 0.15] });
    hazard(b, [0.42, 1.08, 0.15], 0.34, 2, Math.PI / 2);
    // Thin focusing coils: a dark collar with a narrow glowing band.
    for (let i = 0; i < 4; i++) {
      b.bevelBox(0.36, 0.36, 0.1, 0.04, STEEL, { p: [0.42, 0.78, 0.8 + i * 0.32] });
      b.box(0.37, 0.05, 0.05, GLOW, { p: [0.42, 0.97, 0.8 + i * 0.32], glow: true });
    }
    b.bevelBox(0.42, 0.42, 0.34, 0.08, PLATE, { p: [0.42, 0.78, 2.15] });
    b.box(0.26, 0.26, 0.04, GLOW, { p: [0.42, 0.78, 2.33], glow: true });
    b.bevelBox(0.36, 0.36, 0.4, 0.08, STEEL, { p: [0.42, 0.75, -0.75] });
  }, m));
  root.add(body);

  const limbs: THREE.Group[] = [];
  const joints: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.3, 1.72, 0);
    hip.add(buildPart('lancer-thigh', (b) => {
      b.ico(0.13, DARK, {});
      b.strut([0, 0, 0], [0, -0.82, 0.12], 0.12, 0.1, 6, DARK);
      b.bevelBox(0.26, 0.55, 0.3, 0.07, PLATE, { p: [0, -0.38, 0.1], r: [0.12, 0, 0] });
    }, m));
    const knee = new THREE.Group();
    knee.position.set(0, -0.82, 0.12);
    knee.add(buildPart('lancer-shin', (b) => {
      b.bevelBox(0.24, 0.2, 0.22, 0.06, AMBER, { p: [0, 0, 0.08] });
      b.strut([0, 0, 0], [0, -0.82, -0.12], 0.1, 0.08, 6, DARK);
      b.bevelBox(0.22, 0.45, 0.24, 0.06, PLATE, { p: [0, -0.35, 0.02], r: [-0.1, 0, 0] });
      // Foot: plate with a toe and heel.
      b.bevelBox(0.3, 0.12, 0.6, 0.05, DARK, { p: [0, -0.84, 0.0] });
      b.wedge(0.3, 0.1, 0.22, 0.6, AMBER, { p: [0, -0.84, 0.3] });
    }, m));
    hip.add(knee);
    root.add(hip);
    limbs.push(hip);
    joints.push(knee);
  }
  return { root, body, bodyY: 2, head: null, limbs, joints, motion: 'walk', muzzles: [muzzleAt(body, 0.42, 0.78, 2.4)] };
};

/** Heavy hover tank: chamfered hull, four thruster pods and a twin-barrel turret. */
const rampart: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.5;
  body.add(buildPart('rampart-hull', (b) => {
    b.bevelBox(2.4, 0.72, 3.1, 0.28, PLATE, { p: [0, 0.45, 0] });
    b.bevelBox(1.9, 0.32, 2.2, 0.16, PLATE, { p: [0, 0.92, -0.15] });
    b.wedge(2.0, 0.4, 0.7, 0.65, PLATE, { p: [0, 0.6, 1.25] }, 0.9);
    // Front grille and headlights.
    b.bevelBox(1.3, 0.42, 0.22, 0.06, DARK, { p: [0, 0.35, 1.6] });
    for (const y of [0.25, 0.37, 0.49]) b.box(1.1, 0.04, 0.05, STEEL, { p: [0, y, 1.72] });
    for (const s of [-1, 1]) b.box(0.22, 0.08, 0.05, GLOW, { p: [s * 0.85, 0.5, 1.58], glow: true });
    // Deck details: hatch, vents, hazard stripes, skirts.
    b.bevelBox(0.72, 0.08, 0.6, 0.04, DARK, { p: [-0.35, 1.1, -0.55] });
    for (const z of [-0.95, -1.1, -1.25]) b.box(0.55, 0.03, 0.06, DARK, { p: [0.55, 1.09, z] });
    hazard(b, [-0.55, 0.95, 0.85], 0.6, 3);
    hazard(b, [0.6, 0.95, 0.85], 0.45, 2);
    for (const s of [-1, 1]) {
      b.bevelBox(0.22, 0.5, 2.4, 0.06, DARK, { p: [s * 1.22, 0.35, 0] });
      b.box(0.04, 0.06, 1.4, AMBER, { p: [s * 1.34, 0.52, 0] });
    }
    // Four thruster pods: gunmetal drums with an amber band and cyan glow underneath.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p: V3 = [sx * 1.32, 0.25, sz * 1.15];
        b.cyl(0.52, 0.55, 0.72, 8, DARK, { p, r: [0, Math.PI / 8, 0] });
        b.cyl(0.56, 0.56, 0.13, 8, AMBER, { p: [p[0], p[1] + 0.14, p[2]], r: [0, Math.PI / 8, 0] });
        b.cyl(0.45, 0.5, 0.1, 8, STEEL, { p: [p[0], p[1] + 0.41, p[2]], r: [0, Math.PI / 8, 0] });
        b.box(0.34, 0.06, 0.05, GLOW, { p: [p[0], p[1] - 0.08, p[2] + sz * 0.52], glow: true });
        b.cyl(0.4, 0.4, 0.03, 10, GLOW, { p: [p[0], p[1] - 0.37, p[2]], glow: true });
      }
    }
  }, m));
  root.add(body);

  const head = new THREE.Group();
  head.position.y = 1.08;
  head.add(buildPart('rampart-turret', (b) => {
    b.cyl(0.82, 0.92, 0.22, 8, DARK, { p: [0, 0.1, 0], r: [0, Math.PI / 8, 0] });
    b.bevelBox(1.3, 0.52, 1.4, 0.2, PLATE, { p: [0, 0.45, -0.12] });
    b.wedge(1.0, 0.35, 0.45, 0.6, PLATE, { p: [0, 0.3, 0.68] }, 0.8);
    b.box(0.5, 0.09, 0.05, GLOW, { p: [0, 0.55, 0.58], glow: true });
    hazard(b, [0.42, 0.72, -0.2], 0.4, 2);
    // Sensor dome, antenna and side vents.
    b.cyl(0.18, 0.22, 0.14, 8, DARK, { p: [-0.32, 0.78, -0.45] });
    antenna(b, [0.45, 0.7, -0.65], 0.6);
    for (const s of [-1, 1]) for (const z of [-0.35, -0.5, -0.65]) b.box(0.03, 0.18, 0.08, DARK, { p: [s * 0.66, 0.45, z] });
    // Twin barrels with amber bands, cyan strips and muzzle brakes.
    for (const s of [-1, 1]) {
      b.bevelBox(0.3, 0.3, 0.4, 0.06, DARK, { p: [s * 0.28, 0.35, 0.55] });
      b.strut([s * 0.28, 0.35, 0.7], [s * 0.28, 0.35, 2.1], 0.11, 0.1, 8, DARK);
      b.cyl(0.13, 0.13, 0.12, 8, AMBER, { p: [s * 0.28, 0.35, 1.25], r: [Math.PI / 2, 0, 0] });
      b.box(0.04, 0.05, 0.6, GLOW, { p: [s * 0.28, 0.47, 1.6], glow: true });
      b.bevelBox(0.24, 0.24, 0.3, 0.05, STEEL, { p: [s * 0.28, 0.35, 2.15] });
      b.cyl(0.08, 0.08, 0.03, 8, GLOW, { p: [s * 0.28, 0.35, 2.31], r: [Math.PI / 2, 0, 0], glow: true });
    }
  }, m));
  body.add(head);
  return {
    root, body, bodyY: 0.5, head, limbs: [], joints: [], motion: 'hover',
    muzzles: [muzzleAt(head, 0.28, 0.35, 2.4), muzzleAt(head, -0.28, 0.35, 2.4)],
  };
};

/** Delta-wing interceptor with twin tail fins, wing missile rails and a glowing engine. */
const kestrel: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(buildPart('kestrel-body', (b) => {
    // Fuselage: a long faceted hull tapering to a nose.
    b.hull([
      [0, 0.05, 2.0], [0.2, 0.1, 1.4], [-0.2, 0.1, 1.4], [0, -0.12, 1.5],
      [0.35, 0.22, 0.3], [-0.35, 0.22, 0.3], [0.38, -0.18, 0.3], [-0.38, -0.18, 0.3],
      [0.3, 0.2, -1.3], [-0.3, 0.2, -1.3], [0.3, -0.15, -1.3], [-0.3, -0.15, -1.3],
    ], PLATE);
    b.box(0.08, 0.025, 1.2, AMBER, { p: [0, 0.23, -0.2] });
    // Canopy.
    b.hull([[0, 0.22, 1.25], [0.14, 0.2, 0.75], [-0.14, 0.2, 0.75], [0, 0.36, 0.7], [0.12, 0.2, 0.35], [-0.12, 0.2, 0.35]], GLOW, { glow: true });
    for (const s of [-1, 1]) {
      // Delta wing with a dark leading edge and amber trim.
      b.hull([[s * 0.3, 0, 0.6], [s * 0.3, 0.06, 0.6], [s * 1.7, 0, -0.9], [s * 1.7, 0.04, -0.9], [s * 0.3, 0, -1.1], [s * 0.3, 0.06, -1.1]], PLATE);
      b.strut([s * 0.35, 0.03, 0.6], [s * 1.7, 0.02, -0.9], 0.04, 0.03, 4, DARK);
      b.box(0.5, 0.02, 0.1, AMBER, { p: [s * 1.25, 0.05, -0.75], r: [0, s * 0.15, 0] });
      // Tail fin, canted outward.
      b.hull([[s * 0.2, 0.18, -0.6], [s * 0.2, 0.18, -1.3], [s * 0.42, 0.75, -1.35], [s * 0.42, 0.75, -1.1]], STEEL);
      b.box(0.05, 0.08, 0.2, AMBER, { p: [s * 0.42, 0.75, -1.22] });
      // Missile rail with a missile.
      b.strut([s * 0.75, -0.08, 0.35], [s * 0.75, -0.08, -0.6], 0.05, 0.05, 4, DARK);
      b.strut([s * 0.75, -0.18, 0.5], [s * 0.75, -0.18, -0.4], 0.07, 0.07, 6, PLATE);
      b.cone(0.07, 0.2, 6, AMBER, { p: [s * 0.75, -0.18, 0.6], r: [Math.PI / 2, 0, 0] });
    }
    // Engine nacelle and exhaust glow.
    b.strut([0, 0.02, -1.0], [0, 0.02, -1.55], 0.28, 0.24, 8, DARK);
    b.cone(0.2, 0.55, 8, GLOW, { p: [0, 0.02, -1.82], r: [-Math.PI / 2, 0, 0], glow: true });
  }, m));
  root.add(body);
  return {
    root, body, bodyY: 0, head: null, limbs: [], joints: [], motion: 'fly',
    muzzles: [muzzleAt(body, 0.75, -0.18, 0.75), muzzleAt(body, -0.75, -0.18, 0.75)],
  };
};

const FACTORIES: Record<SquadKind, RigFactory> = { sentinel, lancer, rampart, kestrel };

export function createAllyModel(kind: SquadKind, materials: PartMaterials): AllyRig {
  return FACTORIES[kind](materials);
}
