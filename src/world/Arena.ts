import * as THREE from 'three';
import { ARENA } from '../config/balance';
import { PALETTE as C } from '../config/palette';
import { TAU } from '../core/math';
import type { LevelTheme } from '../levels/types';
import { Materials } from '../render/Materials';
import { ModelBuilder } from '../render/ModelBuilder';

/** Level-independent scene setup: lighting rig, fog, the core's landing pad and the build-zone overlay. Re-tinted per level theme. */
export class Arena {
  private readonly buildZone = new THREE.Group();
  private readonly buildZoneMaterials: THREE.Material[] = [];
  private readonly hemisphere = new THREE.HemisphereLight();
  private readonly sun = new THREE.DirectionalLight();
  private readonly fog = new THREE.Fog(0x000000, 75, 165);
  private readonly background = new THREE.Color();
  private buildZoneVisible = false;
  private buildZoneFade = 0;
  private time = 0;

  constructor(private readonly scene: THREE.Scene) {
    scene.background = this.background;
    scene.fog = this.fog;
    this.addLights();
    this.addLandingPad();
    this.createBuildZone();
  }

  applyTheme(theme: LevelTheme): void {
    this.background.setHex(theme.background);
    this.fog.color.setHex(theme.fog.color);
    this.fog.near = theme.fog.near;
    this.fog.far = theme.fog.far;
    this.hemisphere.color.setHex(theme.hemisphere.sky);
    this.hemisphere.groundColor.setHex(theme.hemisphere.ground);
    this.hemisphere.intensity = theme.hemisphere.intensity;
    this.sun.color.setHex(theme.sun.color);
    this.sun.intensity = theme.sun.intensity;
    this.sun.position.set(...theme.sun.position);
  }

  private addLights(): void {
    this.scene.add(this.hemisphere);
    const sun = this.sun;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const cam = sun.shadow.camera;
    cam.left = -62;
    cam.right = 62;
    cam.top = 62;
    cam.bottom = -62;
    cam.near = 1;
    cam.far = 200;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.scene.add(sun.target);
  }

  private addLandingPad(): void {
    const b = new ModelBuilder();
    b.cyl(7.5, 7.8, 0.4, 8, 0x3b3c44, { p: [0, -0.1, 0] });
    b.cyl(6.2, 6.2, 0.4, 8, 0x464852, { p: [0, -0.02, 0] });
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + TAU / 16;
      b.box(2.4, 0.04, 0.12, C.playerGlow, { p: [Math.sin(a) * 6.95, 0.13, Math.cos(a) * 6.95], r: [0, a, 0], glow: true });
      b.box(0.7, 0.04, 0.25, C.playerAccent, { p: [Math.sin(a) * 5.5, 0.2, Math.cos(a) * 5.5], r: [0, a, 0] });
    }
    const built = b.build();
    const pad = new THREE.Mesh(built.body!, Materials.body);
    pad.receiveShadow = true;
    this.scene.add(pad, new THREE.Mesh(built.glow!, Materials.glow));
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
      m.position.y = 0.2;
      this.buildZone.add(m);
    }

    const points: number[] = [];
    for (let x = -rMax; x <= rMax; x += gridSize) {
      for (let z = -rMax; z <= rMax; z += gridSize) {
        const d = Math.hypot(x, z);
        if (d >= rMin && d <= rMax) points.push(x, 0.22, z);
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
