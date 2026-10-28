import type * as THREE from 'three';
import type { ModelBuilder } from '../render/ModelBuilder';

export type LevelId = 'isles' | 'dunes' | 'hollow';

/** Where ground enemies enter the map. Angle in degrees, 0 = +Z (bottom of the screen). */
export interface GateDef {
  angle: number;
  radius: number;
  /** Lateral spread of spawns across the gate. */
  width: number;
}

/** A layer of drifting ambient particles: embers, dust, spores. */
export interface MoteLayer {
  color: number;
  /** HDR brightness; above ~1 the motes bloom. */
  intensity: number;
  count: number;
  size: number;
  /** Constant drift (units/s). */
  drift: [number, number, number];
  /** Random per-mote sway amplitude. */
  sway: number;
  /** Height band the motes live in. */
  height: [number, number];
}

export interface LevelTheme {
  background: number;
  fog: { color: number; near: number; far: number };
  hemisphere: { sky: number; ground: number; intensity: number };
  sun: { color: number; intensity: number; position: [number, number, number] };
  exposure: number;
  /** Bright daylight ground needs a higher threshold so only real glows bloom. */
  bloom: { threshold: number; strength: number };
  /** Colours of dust and debris kicked up from this ground. */
  dust: number;
  dustDark: number;
  /** What happens to enemies knocked into a hazard. */
  hazard: { kind: 'chasm' | 'liquid'; color: number } | null;
  motes: MoteLayer[];
}

export interface LevelDef {
  id: LevelId;
  name: string;
  tagline: string;
  /** Short gameplay notes shown on the level card. */
  features: string[];
  /** Three colours for the level card swatch. */
  swatch: [string, string, string];
  theme: LevelTheme;
  gates: GateDef[];
  createBiome: () => Biome;
}

/** Hooks a biome uses to dress the level. */
export interface DecorContext {
  /** Static lit + glow parts, merged into one mesh each. */
  readonly builder: ModelBuilder;
  /** For custom meshes (liquids, mist, animated glow). Disposed with the level. */
  readonly group: THREE.Group;
  readonly rnd: () => number;
  heightAt(x: number, z: number): number;
  isWalkable(x: number, z: number): boolean;
  /** Marks a circular footprint as impassable for ground units. */
  block(x: number, z: number, radius: number): void;
  /** Registers a per-frame animation (game time). */
  animate(fn: (dt: number, time: number) => void): void;
  /** Darkens the ground around a prop: a baked contact shadow. */
  occlude(x: number, z: number, radius: number, strength?: number): void;
  /** Soft coloured light on the ground, e.g. under a glowing crystal. */
  glowPool(x: number, z: number, radius: number, color: number, intensity?: number): void;
}

/** Shape, colouring and dressing of one level. */
export interface Biome {
  /** Terrain height. Deterministic; sampled for the mesh and the navigation grid. */
  height(x: number, z: number): number;
  /** Chasm or liquid: enemies knocked in here are lost. */
  isHazard(x: number, z: number): boolean;
  /** Colour of the terrain at a vertex. `slope` is 0 on flat ground, 1 on a vertical wall. */
  color(x: number, z: number, h: number, slope: number, out: THREE.Color): void;
  decorate(ctx: DecorContext): void;
}
