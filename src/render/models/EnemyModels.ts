import * as THREE from 'three';
import type { EnemyKind } from '../../config/enemies';
import { PALETTE as C } from '../../config/palette';
import { Finish } from '../Materials';
import { buildPart, type ModelBuilder, type PartMaterials } from '../ModelBuilder';
import { cable, pustules, spines } from './greebles';

export interface EnemyRig {
  root: THREE.Group;
  /** Bobbing upper body. */
  body: THREE.Group;
  /** Rest height of `body` for walkers that bob it. */
  bodyY: number;
  /** Limb pivots, animated by phase (legs swing on X, crawler leg sets twist on Y, wings flap on Z). */
  limbs: THREE.Group[];
  /** Knee pivots for walkers, one per limb; bent through the stride. */
  joints: THREE.Group[];
  limbMode: 'swing' | 'scuttle' | 'flap' | 'glide';
  muzzle: THREE.Object3D;
}

type RigFactory = (m: PartMaterials) => EnemyRig;
type V3 = [number, number, number];

// Swarm palette: black chitin, maroon armour, bone claws, molten glow.
const SHELL = C.enemyShell;
const SHELL_L = C.enemyShellLight;
const PLATE = C.enemyPlate;
const PLATE_L = C.enemyPlateLight;
const BONE = C.enemyBone;
const GLOW = C.enemyGlow;
const HOT = C.enemyGlowHot;
/** Exposed sinew between armour plates. */
const FLESH = 0x8e2c3e;

function attachMuzzle(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  const muzzle = new THREE.Object3D();
  muzzle.position.set(x, y, z);
  parent.add(muzzle);
  return muzzle;
}

/** Bone claw or horn: a 4-sided cone from `at` pointing along `dir`. */
function claw(b: ModelBuilder, at: V3, dir: V3, length: number, width: number, color: number = BONE): void {
  const len = Math.hypot(...dir) || 1;
  b.strut(at, [at[0] + (dir[0] / len) * length, at[1] + (dir[1] / len) * length, at[2] + (dir[2] / len) * length], width, 0.01, 4, color);
}

/** Two-segment crawler leg with a knuckle and a claw tip. */
function crawlerLeg(b: ModelBuilder, hip: V3, knee: V3, foot: V3, r: number, upper: number, lower: number): void {
  b.strut(hip, knee, r, r * 0.8, 5, upper);
  b.ico(r * 1.15, SHELL, { p: knee });
  // A spur on the knuckle and a sinew band on the upper segment.
  claw(b, knee, [knee[0] - hip[0], 1.2, knee[2] - hip[2]], r * 2.2, r * 0.45);
  b.ico(r * 0.9, FLESH, { p: [hip[0] + (knee[0] - hip[0]) * 0.35, hip[1] + (knee[1] - hip[1]) * 0.35 - r * 0.3, hip[2] + (knee[2] - hip[2]) * 0.35], s: [1.2, 0.7, 1.2] });
  b.strut(knee, foot, r * 0.75, r * 0.45, 5, lower);
  claw(b, foot, [foot[0] - knee[0], foot[1] - knee[1] - 0.6, foot[2] - knee[2]], r * 3, r * 0.5);
}

/** Overlapping armour plates down the back, each a tapered wedge with a glowing seam behind it. */
function carapace(b: ModelBuilder, y: number, zFront: number, count: number, w: number, step: number, thickness: number): void {
  for (let i = 0; i < count; i++) {
    const z = zFront - i * step;
    const scale = 1 - i * 0.08;
    b.wedge(w * scale, thickness, step * 1.35, 0.35, i % 2 === 0 ? PLATE : PLATE_L, { p: [0, y - i * 0.03, z], r: [-0.18, 0, 0] }, 0.7);
    if (i > 0) b.box(w * scale * 0.55, 0.04, 0.05, GLOW, { p: [0, y + thickness * 0.55, z + step * 0.62], glow: true });
  }
}

/** Small, fast six-legged bug with mandibles. Legs move as two alternating tripods. */
const skitter: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = buildPart('skitter-body', (b) => {
    b.bevelBox(0.9, 0.42, 1.15, 0.14, SHELL, { p: [0, 0.62, 0] });
    carapace(b, 0.78, 0.35, 3, 0.95, 0.38, 0.22);
    for (let i = 0; i < 3; i++) claw(b, [0, 1.0 - i * 0.04, 0.2 - i * 0.36], [0, 0.6, -1], 0.3 - i * 0.04, 0.07);
    // Head with glowing eyes and mandibles.
    b.bevelBox(0.62, 0.34, 0.42, 0.1, SHELL_L, { p: [0, 0.62, 0.74] });
    b.wedge(0.6, 0.14, 0.4, 0.4, PLATE_L, { p: [0, 0.78, 0.7], r: [-0.1, 0, 0] }, 0.7);
    for (const s of [-1, 1]) {
      b.ico(0.075, HOT, { p: [s * 0.17, 0.7, 0.95], glow: true });
      b.ico(0.05, HOT, { p: [s * 0.27, 0.64, 0.9], glow: true });
      claw(b, [s * 0.2, 0.5, 0.95], [s * -0.25, -0.15, 1], 0.42, 0.07);
    }
    // Abdomen with a glowing underside sac.
    b.bevelBox(0.72, 0.4, 0.6, 0.14, SHELL, { p: [0, 0.6, -0.72], r: [0.2, 0, 0] });
    b.ico(0.2, GLOW, { p: [0, 0.48, -0.85], s: [1.3, 0.8, 1.2], glow: true });
    // Ribbed abdomen, glowing blisters, feelers and serrated inner mandibles.
    for (let i = 0; i < 3; i++) b.torus(0.3 - i * 0.03, 0.035, SHELL_L, { p: [0, 0.62 - i * 0.04, -0.55 - i * 0.16], r: [0.2, 0, 0] }, 8);
    pustules(b, [0, 0.72, -0.78], [0.6, 0.15, 0.4], 5, 0.06, HOT, 3);
    for (const s of [-1, 1]) {
      b.strut([s * 0.12, 0.75, 0.9], [s * 0.35, 1.15, 1.35], 0.025, 0.012, 3, SHELL_L);
      claw(b, [s * 0.12, 0.52, 1.0], [s * -0.4, -0.1, 1], 0.22, 0.04);
      b.ico(0.09, FLESH, { p: [s * 0.32, 0.55, 0.62], s: [1, 0.8, 1.4] });
    }
  }, m, Finish.Gloss);
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (let set = 0; set < 2; set++) {
    const legs = buildPart(`skitter-legs-${set}`, (b) => {
      for (let i = 0; i < 3; i++) {
        for (const side of [-1, 1]) {
          // Tripod gait: front and back legs on one side move with the middle leg on the other.
          if (((i % 2) ^ (side > 0 ? 1 : 0) ^ set) !== 0) continue;
          const z = (i - 1) * 0.42;
          const fan = (i - 1) * 0.35;
          crawlerLeg(b,
            [side * 0.42, 0.62, z],
            [side * 0.85, 0.92, z + fan * 0.6],
            [side * 1.25, 0.02, z + fan * 1.2],
            0.07, PLATE, SHELL);
        }
      }
    }, m, Finish.Gloss);
    root.add(legs);
    limbs.push(legs);
  }
  root.scale.setScalar(1.3);
  return { root, body, bodyY: 0, limbs, joints: [], limbMode: 'scuttle', muzzle: attachMuzzle(body, 0, 0.6, 1.1) };
};

/** Hunched two-legged walker with a plasma cannon arm and a bone blade on the other. */
const strider: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 2.3;
  body.add(buildPart('strider-torso', (b) => {
    b.bevelBox(1.35, 0.85, 1.4, 0.2, SHELL, {});
    carapace(b, 0.32, 0.45, 3, 1.4, 0.42, 0.3);
    for (let i = 0; i < 3; i++) claw(b, [0, 0.75 - i * 0.05, 0.1 - i * 0.42], [0, 0.7, -1], 0.45, 0.09);
    // Chest core and seams.
    b.ico(0.22, HOT, { p: [0, -0.05, 0.72], glow: true });
    b.box(0.9, 0.05, 0.05, GLOW, { p: [0, 0.2, 0.71], glow: true });
    // Head: armoured, low-slung, horned.
    b.bevelBox(0.55, 0.38, 0.5, 0.1, SHELL_L, { p: [0, 0.2, 0.92] });
    b.wedge(0.55, 0.18, 0.5, 0.5, PLATE, { p: [0, 0.38, 0.88] }, 0.6);
    for (const s of [-1, 1]) {
      b.ico(0.06, HOT, { p: [s * 0.14, 0.24, 1.18], glow: true });
      claw(b, [s * 0.22, 0.45, 0.85], [s * 0.4, 0.8, -0.6], 0.55, 0.08);
    }
    // Right arm: plasma cannon with glowing coils.
    b.wedge(0.6, 0.35, 0.8, 0.3, PLATE_L, { p: [0.85, 0.2, 0.1] }, 0.75);
    b.strut([0.85, -0.1, 0.2], [0.85, -0.22, 1.75], 0.2, 0.17, 6, SHELL);
    for (const z of [0.7, 1.05, 1.4]) b.torus(0.2, 0.05, GLOW, { p: [0.85, -0.15 - z * 0.05, z], glow: true }, 8);
    b.cyl(0.13, 0.13, 0.08, 8, C.enemyPlasma, { p: [0.85, -0.23, 1.78], r: [Math.PI / 2, 0, 0], glow: true });
    // Left arm: bone blade.
    b.strut([-0.75, 0.05, 0.1], [-0.95, -0.55, 0.45], 0.13, 0.1, 5, SHELL_L);
    claw(b, [-0.95, -0.55, 0.45], [0.05, -0.3, 1], 0.9, 0.12);
    // Shoulder spines, ribs along the flanks, sinew to the arms and veins feeding the cannon.
    spines(b, [0.6, 0.45, 0.45], [0.75, 0.3, -0.35], 3, 0.5, 0.08, BONE, [0.6, 1, -0.4]);
    spines(b, [-0.6, 0.45, 0.45], [-0.75, 0.3, -0.35], 3, 0.5, 0.08, BONE, [-0.6, 1, -0.4]);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) b.strut([s * 0.68, 0.25 - i * 0.18, 0.4], [s * 0.7, 0.18 - i * 0.18, -0.45], 0.04, 0.04, 4, BONE);
    }
    b.strut([0.55, 0.05, 0.3], [0.85, -0.05, 0.55], 0.1, 0.08, 5, FLESH);
    b.strut([-0.55, 0.0, 0.3], [-0.75, 0.05, 0.12], 0.1, 0.08, 5, FLESH);
    cable(b, [[0.62, 0.22, 0.1], [0.98, 0.0, 0.5], [1.03, -0.12, 1.0], [0.98, -0.18, 1.5]], 0.035, GLOW);
    pustules(b, [0, 0.55, -0.35], [0.9, 0.2, 0.6], 6, 0.07, HOT, 7);
  }, m, Finish.Gloss));
  root.add(body);

  const limbs: THREE.Group[] = [];
  const joints: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.55, 2.0, 0);
    hip.add(buildPart('strider-thigh', (b) => {
      b.ico(0.2, SHELL, {});
      b.strut([0, 0, 0], [0, -0.95, 0.35], 0.18, 0.15, 6, PLATE);
      b.wedge(0.3, 0.12, 0.55, 0.4, PLATE_L, { p: [0, -0.45, 0.2], r: [0.35, 0, 0] });
      b.strut([0, -0.1, -0.12], [0, -0.85, 0.2], 0.09, 0.07, 5, FLESH);
      claw(b, [0, -0.95, 0.42], [0, 0.4, 1], 0.35, 0.08);
    }, m, Finish.Gloss));
    const knee = new THREE.Group();
    knee.position.set(0, -0.95, 0.35);
    knee.add(buildPart('strider-shin', (b) => {
      b.ico(0.15, SHELL, {});
      b.strut([0, 0, 0], [0, -1.0, -0.35], 0.13, 0.1, 6, SHELL_L);
      // Three-toed clawed foot with a heel spur.
      for (const t of [-0.25, 0, 0.25]) claw(b, [0, -1.0, -0.35], [t, -0.25, 1], 0.5, 0.08);
      claw(b, [0, -1.0, -0.35], [0, -0.3, -1], 0.3, 0.07);
      b.wedge(0.22, 0.1, 0.6, 0.3, PLATE, { p: [0, -0.45, 0.0], r: [-0.35, 0, 0] }, 0.7);
      spines(b, [0, -0.3, -0.15], [0, -0.7, -0.3], 2, 0.25, 0.05, BONE, [0, 0.3, -1]);
    }, m, Finish.Gloss));
    hip.add(knee);
    root.add(hip);
    limbs.push(hip);
    joints.push(knee);
  }
  return { root, body, bodyY: 2.3, limbs, joints, limbMode: 'swing', muzzle: attachMuzzle(body, 0.85, -0.23, 1.85) };
};

/** Heavy crusher on four thick legs, led by a horned battering-ram head. */
const juggernaut: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = buildPart('juggernaut-body', (b) => {
    b.bevelBox(2.6, 1.4, 3.3, 0.35, SHELL, { p: [0, 1.6, -0.1] });
    carapace(b, 2.15, 1.1, 4, 2.6, 0.75, 0.45);
    for (let i = 0; i < 4; i++) {
      for (const s of [-1, 1]) claw(b, [s * 0.75, 2.6 - i * 0.05, 0.9 - i * 0.75], [s * 0.3, 0.8, -0.8], 0.6, 0.13);
    }
    // Shoulder armour.
    for (const s of [-1, 1]) {
      b.wedge(0.7, 0.9, 1.6, 0.3, PLATE_L, { p: [s * 1.35, 1.35, 0.7], r: [0, 0, s * -0.25] }, 0.6);
      b.box(0.05, 0.5, 1.0, GLOW, { p: [s * 1.33, 1.6, -0.3], glow: true });
    }
    // Ram head: a bone wall with brow horns and glowing slits.
    b.bevelBox(2.4, 1.5, 0.9, 0.25, BONE, { p: [0, 1.45, 1.8], r: [0.25, 0, 0] });
    b.bevelBox(1.8, 0.5, 0.6, 0.15, SHELL_L, { p: [0, 0.75, 1.75] });
    for (const s of [-1, 1]) {
      claw(b, [s * 0.95, 2.0, 2.0], [s * 0.4, 0.3, 1], 1.5, 0.3);
      b.box(0.45, 0.09, 0.08, HOT, { p: [s * 0.5, 1.75, 2.3], r: [0.25, 0, s * 0.15], glow: true });
    }
    // Glowing back vents and a hot core at the rear.
    for (const x of [-0.6, 0, 0.6]) b.box(0.18, 0.1, 1.1, GLOW, { p: [x, 2.5, -0.9], glow: true });
    b.ico(0.4, HOT, { p: [0, 1.6, -1.85], glow: true });
    // Blisters down the flanks, bone ridges on the ram and sinew under the shoulder plates.
    for (const s of [-1, 1]) {
      pustules(b, [s * 1.25, 1.75, -0.6], [0.1, 0.5, 1.6], 6, 0.11, HOT, s > 0 ? 11 : 13);
      b.strut([s * 1.0, 0.9, 1.3], [s * 1.25, 1.1, 0.0], 0.22, 0.18, 6, FLESH);
    }
    for (const x of [-0.7, 0, 0.7]) b.strut([x, 0.8, 2.2], [x, 2.1, 1.85], 0.07, 0.07, 4, SHELL_L);
    for (const x of [-0.35, 0.35]) claw(b, [x, 2.15, 1.6], [x * 0.5, 1, 0.4], 0.7, 0.14);
  }, m, Finish.Gloss);
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (let set = 0; set < 2; set++) {
    const legs = buildPart(`juggernaut-legs-${set}`, (b) => {
      for (const [sx, sz] of set === 0 ? [[1, 1], [-1, -1]] : [[-1, 1], [1, -1]]) {
        const hip: V3 = [sx * 1.1, 1.3, sz * 1.1];
        const knee: V3 = [sx * 1.85, 1.25, sz * 1.45];
        const foot: V3 = [sx * 1.95, 0, sz * 1.55];
        b.strut(hip, knee, 0.42, 0.36, 6, PLATE);
        b.ico(0.42, SHELL, { p: knee });
        b.strut(knee, foot, 0.36, 0.3, 6, SHELL_L);
        for (const t of [-0.5, 0, 0.5]) claw(b, [foot[0], 0.15, foot[2]], [sx * 0.3 + t * 0.4, -0.2, sz * 0.8 + t], 0.55, 0.13);
        // Armour plate over the upper leg, a knee horn and sinew behind the shin.
        b.wedge(0.6, 0.18, 0.9, 0.3, PLATE_L, { p: [(hip[0] + knee[0]) / 2, 1.55, (hip[2] + knee[2]) / 2], r: [0, Math.atan2(sx, sz), 0] }, 0.7);
        claw(b, knee, [sx * 0.5, 1, sz * 0.3], 0.6, 0.15);
        b.strut([knee[0] - sx * 0.2, 1.0, knee[2] - sz * 0.25], [foot[0] - sx * 0.15, 0.4, foot[2] - sz * 0.2], 0.12, 0.09, 5, FLESH);
      }
    }, m, Finish.Gloss);
    root.add(legs);
    limbs.push(legs);
  }
  return { root, body, bodyY: 0, limbs, joints: [], limbMode: 'scuttle', muzzle: attachMuzzle(body, 0, 1.2, 2.4) };
};

/** Dragonfly-like flyer: segmented abdomen, big glowing eyes, four pale membrane wings. */
const wasp: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = buildPart('wasp-body', (b) => {
    b.bevelBox(0.55, 0.5, 0.75, 0.14, SHELL, {});
    b.wedge(0.5, 0.18, 0.7, 0.3, PLATE, { p: [0, 0.2, 0] }, 0.7);
    // Head.
    b.ico(0.3, SHELL_L, { p: [0, 0.02, 0.6], s: [1.1, 0.9, 1] });
    for (const s of [-1, 1]) {
      b.ico(0.13, HOT, { p: [s * 0.17, 0.08, 0.72], glow: true });
      claw(b, [s * 0.1, -0.15, 0.8], [s * -0.2, -0.3, 1], 0.28, 0.04);
    }
    b.cone(0.09, 0.3, 5, GLOW, { p: [0, -0.12, 0.98], r: [Math.PI / 2, 0, 0], glow: true });
    // Segmented abdomen tapering to a stinger.
    for (let i = 0; i < 4; i++) {
      const z = -0.55 - i * 0.38;
      const s = 0.42 - i * 0.07;
      b.bevelBox(s, s * 0.9, 0.36, 0.08, i % 2 === 0 ? PLATE : SHELL, { p: [0, -0.05 - i * 0.05, z] });
      if (i < 3) b.box(s * 0.8, 0.04, 0.04, GLOW, { p: [0, -0.05 - i * 0.05 + s * 0.46, z - 0.19], glow: true });
    }
    claw(b, [0, -0.25, -2.0], [0, -0.3, -1], 0.4, 0.06);
    // Feelers, a glowing venom sac under the stinger and ridges between the abdomen plates.
    for (const s of [-1, 1]) b.strut([s * 0.1, 0.2, 0.75], [s * 0.4, 0.55, 1.25], 0.02, 0.01, 3, SHELL_L);
    b.ico(0.12, HOT, { p: [0, -0.33, -1.75], s: [1, 0.8, 1.3], glow: true });
    pustules(b, [0, 0.25, -0.2], [0.35, 0.05, 0.5], 3, 0.05, HOT, 5);
    // Dangling legs.
    for (const s of [-1, 1]) {
      for (const z of [-0.2, 0.1, 0.35]) b.strut([s * 0.22, -0.2, z], [s * 0.45, -0.75, z + 0.1], 0.035, 0.02, 4, SHELL_L);
    }
  }, m, Finish.Gloss);
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.25, 0.28, 0.05);
    wing.add(buildPart(`wasp-wing-${side}`, (b) => {
      for (const [z, len, sweep] of [[0.15, 1.9, 0.18], [-0.25, 1.6, -0.12]]) {
        b.hull([
          [0, 0, z], [0, 0.03, z],
          [side * len, 0, z + sweep], [side * len, 0.03, z + sweep],
          [side * len * 0.75, 0, z + sweep - 0.32], [side * len * 0.4, 0, z - 0.3],
        ], 0xd6b9a8);
        b.strut([0, 0.04, z], [side * len * 0.95, 0.04, z + sweep], 0.025, 0.015, 3, GLOW, true);
      }
    }, m, Finish.Gloss));
    root.add(wing);
    limbs.push(wing);
  }
  return { root, body, bodyY: 0, limbs, joints: [], limbMode: 'flap', muzzle: attachMuzzle(body, 0, -0.12, 1.15) };
};

/** Rocket artillery crawler: six legs and a tilted six-tube launch rack on its back. */
const howler: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(buildPart('howler-body', (b) => {
    b.bevelBox(1.6, 0.6, 2.0, 0.18, SHELL, { p: [0, 0.82, 0] });
    carapace(b, 1.08, 0.55, 2, 1.55, 0.6, 0.18);
    // Head.
    b.bevelBox(0.8, 0.42, 0.5, 0.12, SHELL_L, { p: [0, 0.8, 1.15] });
    for (const s of [-1, 1]) {
      b.ico(0.07, HOT, { p: [s * 0.2, 0.86, 1.42], glow: true });
      claw(b, [s * 0.28, 0.65, 1.35], [s * -0.2, -0.2, 1], 0.4, 0.07);
    }
    // Launch rack pitched up toward the target: a maroon frame around six tubes.
    const pitch = 0.55;
    const up: V3 = [0, Math.cos(pitch), -Math.sin(pitch)];
    const fwd: V3 = [0, Math.sin(pitch), Math.cos(pitch)];
    const centre: V3 = [0, 1.7, -0.15];
    // Open cradle: a back plate and two side cheeks, so the tubes stand out of it.
    const behind: V3 = [0, centre[1] - fwd[1] * 0.55, centre[2] - fwd[2] * 0.55];
    b.bevelBox(1.55, 0.95, 0.3, 0.1, PLATE, { p: behind, r: [-pitch, 0, 0] });
    for (const s of [-1, 1]) b.bevelBox(0.14, 1.0, 1.1, 0.05, PLATE_L, { p: [s * 0.78, centre[1], centre[2]], r: [-pitch, 0, 0] });
    for (let i = 0; i < 6; i++) {
      const x = ((i % 3) - 1) * 0.44;
      const y = i < 3 ? 0.22 : -0.22;
      const c: V3 = [x, centre[1] + up[1] * y, centre[2] + up[2] * y];
      const front: V3 = [c[0], c[1] + fwd[1] * 0.72, c[2] + fwd[2] * 0.72];
      const back: V3 = [c[0], c[1] - fwd[1] * 0.6, c[2] - fwd[2] * 0.6];
      b.strut(back, front, 0.17, 0.17, 8, SHELL);
      b.strut([back[0], back[1] + fwd[1] * 0.35, back[2] + fwd[2] * 0.35], [back[0], back[1] + fwd[1] * 0.45, back[2] + fwd[2] * 0.45], 0.2, 0.2, 8, BONE);
      b.strut(front, [front[0], front[1] + fwd[1] * 0.04, front[2] + fwd[2] * 0.04], 0.13, 0.13, 8, HOT, true);
    }
    // Bone bands round the tubes, sinew bracing the rack and blisters along the back.
    for (const s of [-1, 1]) b.strut([s * 0.45, 1.05, 0.5], [s * 0.6, 1.5, 0.05], 0.09, 0.07, 5, FLESH);
    pustules(b, [0, 1.1, -0.75], [1.1, 0.15, 0.5], 6, 0.08, HOT, 17);
    spines(b, [0, 1.15, 0.6], [0, 1.1, 0.25], 2, 0.35, 0.07, BONE);
    // Mounting struts and spines.
    for (const s of [-1, 1]) {
      b.strut([s * 0.55, 1.05, 0.2], [s * 0.6, 1.4, 0.2], 0.08, 0.08, 5, SHELL_L);
      claw(b, [s * 0.7, 1.15, -0.9], [s * 0.4, 0.6, -1], 0.5, 0.08);
    }
  }, m, Finish.Gloss));
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (let set = 0; set < 2; set++) {
    const legs = buildPart(`howler-legs-${set}`, (b) => {
      for (let i = 0; i < 3; i++) {
        for (const side of [-1, 1]) {
          if (((i % 2) ^ (side > 0 ? 1 : 0) ^ set) !== 0) continue;
          const z = (i - 1) * 0.75;
          const fan = (i - 1) * 0.4;
          crawlerLeg(b, [side * 0.75, 0.8, z], [side * 1.35, 1.15, z + fan * 0.5], [side * 1.75, 0.02, z + fan], 0.1, PLATE, SHELL);
        }
      }
    }, m, Finish.Gloss);
    root.add(legs);
    limbs.push(legs);
  }
  return { root, body, bodyY: 0, limbs, joints: [], limbMode: 'scuttle', muzzle: attachMuzzle(body, 0, 2.35, 0.55) };
};

/** Bomber: broad bat wings of dark membrane on bone spars, with a glowing bomb bay. */
const vulture: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = buildPart('vulture-body', (b) => {
    b.hull([
      [0, 0.45, 1.6], [0.5, 0.1, 1.2], [-0.5, 0.1, 1.2], [0, -0.35, 1.1],
      [0.75, 0.3, 0], [-0.75, 0.3, 0], [0.6, -0.4, 0], [-0.6, -0.4, 0],
      [0.35, 0.2, -1.8], [-0.35, 0.2, -1.8], [0, -0.2, -2.0],
    ], SHELL);
    carapace(b, 0.32, 0.9, 4, 1.1, 0.55, 0.2);
    // Head with horns and eyes.
    b.bevelBox(0.6, 0.45, 0.6, 0.14, SHELL_L, { p: [0, 0.15, 1.85] });
    for (const s of [-1, 1]) {
      b.ico(0.08, HOT, { p: [s * 0.18, 0.22, 2.15], glow: true });
      claw(b, [s * 0.22, 0.35, 1.75], [s * 0.3, 0.5, -1], 0.7, 0.1);
    }
    // Bomb bay: a glowing sac under the belly, ringed in bone.
    b.ico(0.42, HOT, { p: [0, -0.5, 0.1], s: [1, 0.7, 1.2], glow: true });
    b.torus(0.48, 0.07, BONE, { p: [0, -0.42, 0.1], r: [Math.PI / 2, 0, 0] }, 10);
    // Dorsal spines and blisters flanking the bomb bay.
    spines(b, [0, 0.55, 1.2], [0, 0.4, -1.2], 5, 0.55, 0.08, BONE);
    pustules(b, [0, -0.3, 0.1], [1.0, 0.15, 1.2], 6, 0.08, HOT, 19);
    // Tail spikes.
    for (const s of [-1, 0, 1]) claw(b, [s * 0.2, 0.1, -1.9], [s * 0.4, 0.1, -1], 0.7, 0.09);
  }, m, Finish.Gloss);
  root.add(body);

  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.6, 0.2, 0.2);
    wing.add(buildPart(`vulture-wing-${side}`, (b) => {
      const shoulder: V3 = [0, 0, 0];
      const elbow: V3 = [side * 1.6, 0.25, 0.5];
      const tip: V3 = [side * 3.8, 0.05, -0.2];
      // Membrane: two dark panels between the spars and the trailing edge.
      b.hull([shoulder, [0, 0.04, 0], elbow, [side * 1.6, 0.29, 0.5], [side * 1.3, 0.02, -1.4], [0, 0, -1.2]], SHELL_L);
      b.hull([elbow, [side * 1.6, 0.29, 0.5], tip, [side * 3.8, 0.09, -0.2], [side * 2.8, 0.02, -1.35], [side * 1.3, 0.02, -1.4]], SHELL_L);
      // Bone spars and finger spikes.
      b.strut(shoulder, elbow, 0.13, 0.1, 5, BONE);
      b.strut(elbow, tip, 0.1, 0.05, 5, BONE);
      b.ico(0.13, BONE, { p: elbow });
      claw(b, elbow, [side * 0.2, 0.3, 1], 0.5, 0.08);
      for (const [x, z] of [[1.3, -1.4], [2.8, -1.35]]) b.strut(elbow, [side * x, 0.03, z], 0.05, 0.03, 4, BONE);
      // Hooked claw at the wrist and a vein web across the inner membrane.
      claw(b, tip, [side * 0.5, -0.2, 0.6], 0.5, 0.06);
      b.strut([side * 0.3, 0.05, -0.4], [side * 1.4, 0.2, 0.2], 0.03, 0.02, 3, FLESH);
      b.strut([side * 1.9, 0.18, 0.1], [side * 2.4, 0.06, -0.9], 0.03, 0.02, 3, FLESH);
      // Glowing veins along the membrane edge.
      b.strut([side * 1.35, 0.06, -1.35], [side * 2.75, 0.06, -1.3], 0.035, 0.035, 3, GLOW, true);
      b.strut([side * 2.85, 0.06, -1.3], [side * 3.7, 0.1, -0.25], 0.035, 0.02, 3, GLOW, true);
    }, m, Finish.Gloss));
    root.add(wing);
    limbs.push(wing);
  }
  root.scale.setScalar(0.85);
  return { root, body, bodyY: 0, limbs, joints: [], limbMode: 'glide', muzzle: attachMuzzle(body, 0, -0.7, 0.1) };
};

/** Colossal armoured beetle: spined plates, a glowing maw and six jointed legs. Carries an artillery tube. */
const leviathan: RigFactory = (m) => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 3.2;
  body.add(buildPart('leviathan-body', (b) => {
    b.dodeca(2.7, SHELL, { s: [1.25, 0.72, 1.55] });
    carapace(b, 1.35, 2.6, 6, 4.4, 1.0, 0.7);
    // Two rows of spines down the back, and a crest.
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) claw(b, [s * 1.0, 2.1 - i * 0.06, 2.0 - i * 1.0], [s * 0.35, 1, -0.5], 1.6 - i * 0.12, 0.3);
      claw(b, [0, 2.2 - i * 0.05, 1.6 - i * 1.0], [0, 1, -0.6], 1.1, 0.22);
    }
    // Flank armour with glowing seams.
    for (const s of [-1, 1]) {
      b.wedge(1.2, 1.6, 4.6, 0.15, PLATE_L, { p: [s * 2.45, -0.9, 0], r: [0, 0, s * -0.35] }, 0.5);
      b.box(0.08, 0.08, 3.8, GLOW, { p: [s * 2.55, 0.1, 0], glow: true });
    }
    // Rear abdomen.
    b.dodeca(1.9, SHELL_L, { p: [0, 0.3, -3.2], s: [1.15, 0.72, 1.2] });
    b.ico(0.7, HOT, { p: [0, -0.2, -4.1], glow: true });
    // Head: armoured brow, tusks and a glowing maw.
    b.bevelBox(3.0, 1.7, 1.9, 0.4, PLATE, { p: [0, -0.1, 3.4], r: [0.15, 0, 0] });
    b.bevelBox(2.6, 0.7, 1.2, 0.2, BONE, { p: [0, 0.75, 3.7], r: [0.3, 0, 0] });
    b.box(1.8, 0.5, 0.3, HOT, { p: [0, -0.45, 4.4], glow: true });
    for (const x of [-1.1, -0.55, 0, 0.55, 1.1]) claw(b, [x, -0.1, 4.35], [x * 0.2, -0.6, 1], 0.55, 0.12);
    for (const s of [-1, 1]) {
      claw(b, [s * 1.2, -0.5, 4.2], [s * 0.4, -0.2, 1], 1.8, 0.35);
      b.ico(0.18, HOT, { p: [s * 0.7, 0.45, 4.35], glow: true });
    }
    // Blisters on the flanks, ribs under the armour and a fringe of sinew round the head.
    for (const s of [-1, 1]) {
      pustules(b, [s * 2.3, 0.6, -0.8], [0.3, 0.8, 3.6], 9, 0.2, HOT, s > 0 ? 23 : 29);
      for (let i = 0; i < 4; i++) b.strut([s * 1.9, -0.6, 1.4 - i * 1.0], [s * 2.6, -1.4, 1.2 - i * 1.0], 0.13, 0.1, 5, BONE);
      b.strut([s * 1.3, -0.6, 2.6], [s * 1.5, 0.5, 2.4], 0.3, 0.25, 6, FLESH);
    }
    // Artillery tube rising from the back.
    b.strut([0, 1.2, 0.3], [0, 2.5, 1.85], 0.55, 0.45, 8, SHELL);
    b.torus(0.5, 0.1, GLOW, { p: [0, 1.85, 1.1], r: [0.9, 0, 0], glow: true }, 10);
    b.cyl(0.36, 0.36, 0.1, 8, C.enemyPlasma, { p: [0, 2.5, 1.9], r: [0.9, 0, 0], glow: true });
  }, m, Finish.Gloss));
  root.add(body);

  const limbs: THREE.Group[] = [];
  const joints: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const hip = new THREE.Group();
    hip.position.set(side * 2.5, 3.0, 2.2 - Math.floor(i / 2) * 2.2);
    hip.rotation.y = side * 0.25;
    hip.add(buildPart(`leviathan-thigh-${side}`, (b) => {
      b.ico(0.6, SHELL, {});
      b.strut([0, 0, 0], [side * 2.1, 1.0, 0], 0.55, 0.45, 6, PLATE);
      b.wedge(0.8, 0.4, 1.2, 0.3, PLATE_L, { p: [side * 1.1, 0.7, 0], r: [0, 0, side * -0.45] });
      claw(b, [side * 1.4, 0.95, 0], [side * 0.2, 1, 0], 0.7, 0.18);
      b.strut([side * 0.3, -0.35, 0], [side * 1.9, 0.55, 0], 0.25, 0.2, 6, FLESH);
    }, m, Finish.Gloss));
    const knee = new THREE.Group();
    knee.position.set(side * 2.1, 1.0, 0);
    knee.add(buildPart(`leviathan-shin-${side}`, (b) => {
      b.ico(0.45, SHELL_L, {});
      b.strut([0, 0, 0], [side * 0.6, -3.9, 0], 0.4, 0.25, 6, SHELL);
      claw(b, [side * 0.6, -3.7, 0], [side * 0.1, -1, 0.3], 0.6, 0.25);
      b.wedge(0.7, 0.3, 1.6, 0.3, PLATE_L, { p: [side * 0.25, -1.4, 0], r: [0, 0, side * 0.1] }, 0.6);
      spines(b, [side * 0.15, -0.8, 0], [side * 0.35, -2.4, 0], 3, 0.6, 0.14, BONE, [side * 1, 0.4, 0]);
    }, m, Finish.Gloss));
    hip.add(knee);
    root.add(hip);
    limbs.push(hip);
    joints.push(knee);
  }
  return { root, body, bodyY: 3.2, limbs, joints, limbMode: 'swing', muzzle: attachMuzzle(body, 0, 2.6, 1.95) };
};

const FACTORIES: Record<EnemyKind, RigFactory> = { skitter, strider, juggernaut, wasp, howler, vulture, leviathan };

export function createEnemyModel(kind: EnemyKind, materials: PartMaterials): EnemyRig {
  return FACTORIES[kind](materials);
}
