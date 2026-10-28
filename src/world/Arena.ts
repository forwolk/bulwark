import * as THREE from 'three';
import { ARENA } from '../config/balance';
import { PALETTE as C } from '../config/palette';
import { TAU } from '../core/math';
import { ModelBuilder } from '../render/ModelBuilder';
import { Materials } from '../render/Materials';
import { mulberry32 } from './Noise';
import { createTerrain, terrainHeight } from './Terrain';

/** Static environment: terrain, scattered decor, lighting, fog and the build-zone overlay. */
export class Arena {
  private readonly buildZone = new THREE.Group();
  private readonly buildZoneMaterials: THREE.Material[] = [];
  private buildZoneVisible = false;
  private buildZoneFade = 0;
  private time = 0;

  constructor(private readonly scene: THREE.Scene) {
    scene.background = new THREE.Color(C.fog);
    scene.fog = new THREE.Fog(C.fog, 75, 165);

    scene.add(createTerrain());
    this.addDecor();
    this.addLights();
    this.createBuildZone();
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xa3a6ff, 0x5a3a2a, 1.0));

    const sun = new THREE.DirectionalLight(0xffcf9e, 2.3);
    sun.position.set(-38, 62, 28);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const cam = sun.shadow.camera;
    cam.left = -58;
    cam.right = 58;
    cam.top = 58;
    cam.bottom = -58;
    cam.near = 1;
    cam.far = 180;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.scene.add(sun.target);
  }

  private addDecor(): void {
    const rnd = mulberry32(1337);
    const r = (min: number, max: number): number => min + rnd() * (max - min);
    const b = new ModelBuilder();

    // Landing pad under the core.
    b.cyl(7.5, 7.8, 0.16, 8, 0x3b3c44, { p: [0, 0.02, 0] });
    b.cyl(6.2, 6.2, 0.18, 8, 0x464852, { p: [0, 0.04, 0] });
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + TAU / 16;
      b.box(2.4, 0.04, 0.12, C.playerGlow, { p: [Math.sin(a) * 6.95, 0.13, Math.cos(a) * 6.95], r: [0, a, 0], glow: true });
      b.box(0.7, 0.04, 0.25, C.playerAccent, { p: [Math.sin(a) * 5.5, 0.14, Math.cos(a) * 5.5], r: [0, a, 0] });
    }

    // Rocks: sparse pebbles on the battlefield, boulders and mesas beyond it.
    for (let i = 0; i < 420; i++) {
      const angle = r(0, TAU);
      const dist = 24 + Math.pow(rnd(), 0.7) * 125;
      const x = Math.sin(angle) * dist;
      const z = Math.cos(angle) * dist;
      const size = dist < 48 ? r(0.3, 1.1) : r(1.2, 2.5 + (dist - 48) * 0.07);
      const color = rnd() < 0.5 ? C.rock : C.rockLight;
      const shape = rnd() < 0.5 ? 'dodeca' : 'ico';
      const opts = {
        p: [x, terrainHeight(x, z) + size * 0.15, z] as [number, number, number],
        r: [r(0, TAU), r(0, TAU), r(0, TAU)] as [number, number, number],
        s: [r(0.8, 1.4), r(0.5, 1.0), r(0.8, 1.4)] as [number, number, number],
      };
      if (shape === 'dodeca') b.dodeca(size, color, opts);
      else b.ico(size, color, opts);
    }

    // Tall faceted spires on the horizon.
    for (let i = 0; i < 26; i++) {
      const angle = r(0, TAU);
      const dist = r(72, 130);
      const x = Math.sin(angle) * dist;
      const z = Math.cos(angle) * dist;
      const y = terrainHeight(x, z);
      const h = r(10, 26);
      const w = r(2.5, 5);
      b.cyl(w * 0.55, w, h, 5, C.rock, { p: [x, y + h / 2 - 1, z], r: [r(-0.1, 0.1), r(0, TAU), r(-0.1, 0.1)] });
      b.cyl(w * 0.75, w * 0.55, h * 0.18, 5, C.rockLight, { p: [x, y + h - 1 + h * 0.08, z], r: [0, r(0, TAU), 0] });
    }

    // Glowing crystal clusters.
    for (let i = 0; i < 18; i++) {
      const angle = r(0, TAU);
      const dist = r(28, 75);
      const x = Math.sin(angle) * dist;
      const z = Math.cos(angle) * dist;
      const y = terrainHeight(x, z);
      b.dodeca(r(0.8, 1.4), C.rock, { p: [x, y, z], s: [1.3, 0.6, 1.3] });
      const shards = 3 + Math.floor(rnd() * 4);
      for (let k = 0; k < shards; k++) {
        const s = r(0.35, 0.8);
        b.octa(s, C.crystal, {
          p: [x + r(-1, 1), y + s * 1.2, z + r(-1, 1)],
          r: [r(-0.5, 0.5), r(0, TAU), r(-0.5, 0.5)],
          s: [0.45, r(2, 3.2), 0.45],
          glow: k % 2 === 0,
        });
      }
    }

    // Ruined pylons and wreckage from earlier battles.
    for (let i = 0; i < 12; i++) {
      const angle = r(0, TAU);
      const dist = r(30, 60);
      const x = Math.sin(angle) * dist;
      const z = Math.cos(angle) * dist;
      const y = terrainHeight(x, z);
      const yaw = r(0, TAU);
      if (rnd() < 0.5) {
        const h = r(2.5, 6);
        b.box(1.4, h, 1.4, 0x55565e, { p: [x, y + h / 2 - 0.3, z], r: [r(-0.25, 0.25), yaw, r(-0.25, 0.25)] });
        b.box(1.8, 0.4, 1.8, 0x3d3e45, { p: [x, y + 0.1, z], r: [0, yaw, 0] });
        b.box(0.2, 0.6, 0.05, C.playerAccent, { p: [x + Math.cos(yaw) * 0.72, y + 1.2, z - Math.sin(yaw) * 0.72], r: [0, yaw + Math.PI / 2, 0] });
      } else {
        b.box(r(3, 5), r(0.8, 1.4), r(1.5, 2.5), 0x4a4b53, { p: [x, y + 0.3, z], r: [r(-0.3, 0.3), yaw, r(-0.4, 0.4)] });
        b.box(r(1, 2), 0.3, r(2, 3), 0x5d5e66, { p: [x + 1, y + 0.6, z + 0.5], r: [0.6, yaw + 0.5, 0.2] });
      }
    }

    const built = b.build();
    if (built.body) {
      const mesh = new THREE.Mesh(built.body, Materials.body);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    if (built.glow) this.scene.add(new THREE.Mesh(built.glow, Materials.glow));
  }

  private createBuildZone(): void {
    const fill = new THREE.MeshBasicMaterial({ color: C.playerGlow, transparent: true, opacity: 0.05, depthWrite: false });
    const edge = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.playerGlow).multiplyScalar(2), transparent: true, opacity: 0.6, depthWrite: false });
    const dots = new THREE.PointsMaterial({ color: C.playerGlow, size: 0.28, transparent: true, opacity: 0.4, depthWrite: false });
    this.buildZoneMaterials.push(fill, edge, dots);

    const { buildMinRadius: rMin, buildMaxRadius: rMax, gridSize } = ARENA;
    const disc = new THREE.Mesh(new THREE.RingGeometry(rMin, rMax, 72), fill);
    const outer = new THREE.Mesh(new THREE.RingGeometry(rMax - 0.1, rMax + 0.1, 96), edge);
    const inner = new THREE.Mesh(new THREE.RingGeometry(rMin - 0.06, rMin + 0.06, 48), edge);
    for (const m of [disc, outer, inner]) {
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.06;
      this.buildZone.add(m);
    }

    const points: number[] = [];
    for (let x = -rMax; x <= rMax; x += gridSize) {
      for (let z = -rMax; z <= rMax; z += gridSize) {
        const d = Math.hypot(x, z);
        if (d >= rMin && d <= rMax) points.push(x, 0.08, z);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.buildZone.add(new THREE.Points(geo, dots));

    this.buildZone.visible = false;
    this.scene.add(this.buildZone);
  }

  setBuildZoneVisible(visible: boolean): void {
    this.buildZoneVisible = visible;
  }

  update(dt: number): void {
    this.time += dt;
    this.buildZoneFade = Math.max(0, Math.min(1, this.buildZoneFade + (this.buildZoneVisible ? dt : -dt) * 5));
    this.buildZone.visible = this.buildZoneFade > 0;
    const pulse = 0.85 + Math.sin(this.time * 3) * 0.15;
    const [fill, edge, dots] = this.buildZoneMaterials;
    fill.opacity = 0.05 * this.buildZoneFade;
    edge.opacity = 0.6 * this.buildZoneFade * pulse;
    dots.opacity = 0.4 * this.buildZoneFade;
  }
}
