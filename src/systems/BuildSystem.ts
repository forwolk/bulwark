import * as THREE from 'three';
import { PALETTE as C } from '../config/palette';
import { STRUCTURE_ORDER, STRUCTURES, type StructureKind } from '../config/structures';
import type { World } from '../core/World';
import type { Structure } from '../entities/Structure';
import { Materials } from '../render/Materials';
import { createStructureModel, type StructureRig } from '../render/models/StructureModels';
import { StructureManager, type PlacementError } from './StructureManager';

const ERROR_TEXT: Record<Exclude<PlacementError, null>, string> = {
  range: 'Outside the build zone',
  terrain: 'Blocked by terrain',
  occupied: 'Cell occupied',
  funds: 'Not enough scrap',
};

/** Placement mode: ghost preview, grid snapping, validation, painting walls and selling. */
export class BuildSystem {
  selected: StructureKind | null = null;
  hovered: Structure | null = null;
  private ghost: StructureRig | null = null;
  private readonly rangeRing: THREE.Mesh;
  private readonly hoverRing: THREE.Mesh;
  private readonly cell = new THREE.Vector3();
  private error: PlacementError = null;
  /** Holds the cannon after a placement click until the button is released. */
  private fireLock = false;

  constructor(private readonly world: World) {
    const ringGeo = new THREE.RingGeometry(0.96, 1, 64);
    ringGeo.rotateX(-Math.PI / 2);
    this.rangeRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(C.playerGlow).multiplyScalar(1.5), transparent: true, opacity: 0.5, depthWrite: false }));
    this.rangeRing.position.y = 0.1;
    this.rangeRing.visible = false;
    world.scene.add(this.rangeRing);

    const hoverGeo = new THREE.RingGeometry(1.25, 1.45, 6);
    hoverGeo.rotateX(-Math.PI / 2);
    this.hoverRing = new THREE.Mesh(hoverGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(C.playerAccent).multiplyScalar(2), transparent: true, opacity: 0.8, depthWrite: false }));
    this.hoverRing.position.y = 0.1;
    this.hoverRing.visible = false;
    world.scene.add(this.hoverRing);
  }

  get blocksFire(): boolean {
    return this.selected !== null || this.fireLock;
  }

  select(kind: StructureKind | null): void {
    if (kind === this.selected) kind = null;
    if (this.selected && !kind) this.fireLock = this.world.input.isButtonDown(0);
    this.selected = kind;
    if (this.ghost) this.world.scene.remove(this.ghost.root);
    this.ghost = null;
    if (kind) {
      this.ghost = createStructureModel(kind, { body: Materials.ghostValid, glow: Materials.ghostValid });
      this.ghost.root.traverse((o) => {
        o.castShadow = false;
      });
      this.world.scene.add(this.ghost.root);
    }
    this.rangeRing.visible = false;
    this.world.arena.setBuildZoneVisible(kind !== null);
    this.world.events.emit('buildSelection', { kind });
  }

  /** Text for the HUD hint line. */
  get hint(): string {
    if (this.selected) {
      const def = STRUCTURES[this.selected];
      const err = this.error ? ` — ${ERROR_TEXT[this.error]}` : '';
      return `Place ${def.name} (${def.cost})${err} · RMB/Esc cancel · Shift: keep placing`;
    }
    if (this.hovered) return `${this.hovered.def.name} · [X] Sell for ${this.world.structures.sellValue(this.hovered)}`;
    return '';
  }

  update(_dt: number): void {
    const { input, structures, hasAim, aimPoint } = this.world;
    if (!input.isButtonDown(0)) this.fireLock = false;

    for (const kind of STRUCTURE_ORDER) {
      if (input.wasKeyPressed(`Digit${STRUCTURES[kind].hotkey}`)) {
        this.world.sfx.click();
        this.select(kind);
      }
    }
    if (this.selected && (input.wasKeyPressed('Escape') || input.wasButtonPressed(2))) this.select(null);

    this.hovered = null;
    this.hoverRing.visible = false;

    if (!this.selected || !this.ghost || !hasAim) {
      if (!this.selected && hasAim) this.updateHover();
      return;
    }

    const kind = this.selected;
    this.cell.set(StructureManager.snap(aimPoint.x), 0, StructureManager.snap(aimPoint.z));
    this.error = structures.placementError(kind, this.cell.x, this.cell.z);
    const valid = this.error === null;

    this.ghost.root.position.copy(this.cell);
    const mat = valid ? Materials.ghostValid : Materials.ghostInvalid;
    this.ghost.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = mat;
    });

    const ring = STRUCTURES[kind].weapon?.range;
    this.rangeRing.visible = ring !== undefined;
    if (ring !== undefined) {
      this.rangeRing.position.set(this.cell.x, 0.1, this.cell.z);
      this.rangeRing.scale.setScalar(ring);
    }

    if (input.wasButtonPressed(0)) {
      if (valid) this.placeAt(kind);
      else this.world.sfx.deny();
    }
  }

  private placeAt(kind: StructureKind): void {
    const s = this.world.structures.place(kind, this.cell.x, this.cell.z);
    if (!s) return;
    this.world.effects.structurePlaced(s.position);
    this.world.sfx.build();
    const keep = this.world.input.isKeyDown('ShiftLeft') || this.world.input.isKeyDown('ShiftRight');
    if (!keep) this.select(null);
  }

  private updateHover(): void {
    const s = this.world.structures.at(this.world.aimPoint.x, this.world.aimPoint.z);
    if (!s) return;
    this.hovered = s;
    this.hoverRing.visible = true;
    this.hoverRing.position.set(s.position.x, 0.1, s.position.z);
    if (this.world.input.wasKeyPressed('KeyX')) {
      this.world.structures.sell(s);
      this.world.sfx.sell();
      this.hovered = null;
      this.hoverRing.visible = false;
    }
  }
}
