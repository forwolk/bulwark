import * as THREE from 'three';
import { CORE } from '../config/balance';
import { Materials } from '../render/Materials';
import { ModelBuilder } from '../render/ModelBuilder';
import { AmbientMotes } from '../world/AmbientMotes';
import { GlowPools, type PoolSpec } from '../world/features/GlowPools';
import { OcclusionMap } from '../world/features/OcclusionMap';
import { mulberry32 } from '../world/Noise';
import { createTerrainMesh } from '../world/TerrainMesh';
import { FlowField } from './FlowField';
import { NavGrid, Surface } from './NavGrid';
import type { DecorContext, GateDef, LevelDef, LevelTheme } from './types';

const SHARED_MATERIALS = new Set<THREE.Material>(Object.values(Materials));
const DEG = Math.PI / 180;

/**
 * A loaded level: its meshes, navigation and ground queries. Gameplay asks the level
 * about the ground instead of assuming a flat floor at y = 0.
 */
export class Level {
  readonly root = new THREE.Group();
  readonly nav: NavGrid;
  readonly flow: FlowField;
  private readonly animators: ((dt: number, time: number) => void)[] = [];
  private readonly motes: AmbientMotes[] = [];
  private readonly pools: GlowPools | null = null;
  private time = 0;

  constructor(readonly def: LevelDef) {
    const biome = def.createBiome();
    this.nav = new NavGrid(biome);

    const builder = new ModelBuilder();
    const occlusion = new OcclusionMap();
    const poolSpecs: PoolSpec[] = [];
    const ctx: DecorContext = {
      builder,
      group: this.root,
      rnd: mulberry32(1337),
      heightAt: (x, z) => this.nav.heightAt(x, z),
      isWalkable: (x, z) => this.nav.walkable(x, z),
      block: (x, z, r) => this.nav.block(x, z, r),
      animate: (fn) => this.animators.push(fn),
      occlude: (x, z, r, strength) => occlusion.add(x, z, r, strength),
      glowPool: (x, z, radius, color, intensity = 0.5) => poolSpecs.push({ x, y: this.nav.heightAt(x, z), z, radius, color, intensity }),
    };
    biome.decorate(ctx);
    // Terrain comes after the props so it can bake their contact shadows into its colours.
    this.root.add(createTerrainMesh(biome, (x, z) => occlusion.at(x, z)));

    const built = builder.build();
    if (built.body) {
      // Matte, faceted nature material: rocks and foliage shouldn't share the units' metallic sheen.
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
      const mesh = new THREE.Mesh(built.body, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
    }
    if (built.glow) this.root.add(new THREE.Mesh(built.glow, Materials.glow));
    if (poolSpecs.length > 0) {
      this.pools = new GlowPools(poolSpecs);
      this.root.add(this.pools.mesh);
    }

    // The core's own footprint is not walkable, so the goal is the ring just around it.
    this.flow = new FlowField(this.nav, 0, 0, CORE.radius + 2.5);
    const seed = mulberry32(99);
    for (const layer of def.theme.motes) {
      const motes = new AmbientMotes(layer, seed);
      this.motes.push(motes);
      this.root.add(motes.points);
    }

    if (import.meta.env.DEV) {
      for (const g of def.gates) {
        const { x, z } = this.gatePoint(g, 0);
        if (!this.flow.reachable(x, z)) console.warn(`[level] ${def.id}: gate at ${g.angle}° has no path to the core`);
      }
    }
  }

  get theme(): LevelTheme {
    return this.def.theme;
  }

  get dust(): number {
    return this.def.theme.dust;
  }

  get dustDark(): number {
    return this.def.theme.dustDark;
  }

  /** Point across a gate; `offset` in [-1, 1] spreads spawns over its width. */
  gatePoint(g: GateDef, offset: number): { x: number; z: number } {
    const a = g.angle * DEG;
    const lateral = offset * g.width * 0.5;
    return {
      x: Math.sin(a) * g.radius + Math.cos(a) * lateral,
      z: Math.cos(a) * g.radius - Math.sin(a) * lateral,
    };
  }

  /** Real terrain height, including chasm floors. */
  heightAt(x: number, z: number): number {
    return this.nav.heightAt(x, z);
  }

  /** The surface shots and aiming treat as the floor: chasms and pools count as level ground. */
  floorAt(x: number, z: number): number {
    return Math.max(0, this.nav.heightAt(x, z));
  }

  walkable(x: number, z: number): boolean {
    return this.nav.walkable(x, z);
  }

  isHazard(x: number, z: number): boolean {
    return this.nav.surfaceAt(x, z) === Surface.Hazard;
  }

  /** Ray-marches the floor surface. Falls back to the y = 0 plane if the ray never meets it. */
  raycast(ray: THREE.Ray, out: THREE.Vector3): boolean {
    const { origin: o, direction: d } = ray;
    if (d.y >= 0) return false;
    let prev = 0;
    for (let t = 0; t < 400; t += 0.8) {
      const y = o.y + d.y * t;
      if (y <= this.floorAt(o.x + d.x * t, o.z + d.z * t)) {
        // Refine between the last step above the surface and this one.
        let lo = prev;
        let hi = t;
        for (let i = 0; i < 8; i++) {
          const mid = (lo + hi) / 2;
          if (o.y + d.y * mid <= this.floorAt(o.x + d.x * mid, o.z + d.z * mid)) hi = mid;
          else lo = mid;
        }
        out.copy(o).addScaledVector(d, hi);
        return true;
      }
      prev = t;
    }
    out.copy(o).addScaledVector(d, -o.y / d.y);
    return true;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, focus: THREE.Vector3, bufferHeight: number): void {
    this.time += dt;
    for (const fn of this.animators) fn(dt, this.time);
    this.pools?.update(this.time);
    for (const m of this.motes) m.update(this.time, camera, focus, bufferHeight);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh || o instanceof THREE.Points)) return;
      o.geometry.dispose();
      for (const m of [o.material].flat()) {
        if (SHARED_MATERIALS.has(m)) continue;
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
        m.dispose();
      }
    });
  }
}
