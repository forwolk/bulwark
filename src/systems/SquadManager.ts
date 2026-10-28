import * as THREE from 'three';
import { PALETTE as C } from '../config/palette';
import { SQUAD_CAP, SQUAD_ORDER, SQUADS, type SquadKind } from '../config/squads';
import { rand } from '../core/math';
import type { World } from '../core/World';
import { Ally } from '../entities/Ally';
import { Squad } from '../entities/Squad';
import { updateAlly } from './AllyAI';

export type DeployError = 'phase' | 'cap' | 'cooldown' | 'funds' | null;

const DEG = Math.PI / 180;
const tmp = new THREE.Vector3();

/** Player squads: deploying, guard posts, per-type cooldowns, the squad cap and queries for enemy AI. */
export class SquadManager {
  private squads: Squad[] = [];
  private allies: Ally[] = [];
  private readonly cooldowns = new Map<SquadKind, number>();
  private readonly markers = new Map<Squad, THREE.Mesh>();
  private readonly markerGeometry = new THREE.RingGeometry(1.6, 2, 6);
  private readonly markerMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(C.playerGlow).multiplyScalar(1.4), transparent: true, opacity: 0.35, depthWrite: false,
  });
  private time = 0;

  constructor(private readonly world: World) {
    this.markerGeometry.rotateX(-Math.PI / 2);
  }

  get all(): readonly Ally[] {
    return this.allies;
  }

  get squadCount(): number {
    return this.squads.length;
  }

  count(kind: SquadKind): number {
    return this.squads.filter((s) => s.def.kind === kind).length;
  }

  /** Remaining cooldown as a fraction of the full cooldown (0 = ready). */
  cooldownFraction(kind: SquadKind): number {
    return (this.cooldowns.get(kind) ?? 0) / SQUADS[kind].cooldown;
  }

  deployError(kind: SquadKind): DeployError {
    if (!this.world.playing) return 'phase';
    if (this.squads.length >= SQUAD_CAP) return 'cap';
    if ((this.cooldowns.get(kind) ?? 0) > 0) return 'cooldown';
    if (!this.world.economy.canAfford(SQUADS[kind].cost)) return 'funds';
    return null;
  }

  deploy(kind: SquadKind): boolean {
    const { economy, events, sfx, effects, level, scene } = this.world;
    const def = SQUADS[kind];
    const error = this.deployError(kind);
    if (error) {
      sfx.deny();
      const text = { phase: '', cap: `Squad limit reached (${SQUAD_CAP})`, cooldown: `${def.name} still recharging`, funds: 'Not enough scrap' }[error];
      if (text) events.emit('message', { text, tone: 'info' });
      return false;
    }
    economy.spend(def.cost);
    this.cooldowns.set(kind, def.cooldown);

    const squad = new Squad(def);
    this.assignPost(squad);
    // Members warp in at the edge of the core's pad, on the side facing their post.
    for (let i = 0; i < def.size; i++) {
      const a = squad.facing + rand(-0.5, 0.5);
      const r = rand(5.5, 7);
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      const ally = new Ally(def, squad, i, x, z, def.unit.flying ? level.floorAt(x, z) : level.heightAt(x, z));
      ally.addTo(scene);
      squad.members.push(ally);
      this.allies.push(ally);
      effects.warpIn(new THREE.Vector3(x, 0, z), C.playerGlow);
    }
    this.squads.push(squad);

    const marker = new THREE.Mesh(this.markerGeometry, this.markerMaterial);
    marker.position.set(squad.post.x, level.floorAt(squad.post.x, squad.post.z) + 0.15, squad.post.z);
    scene.add(marker);
    this.markers.set(squad, marker);

    sfx.deploy();
    events.emit('squadDeployed', { kind });
    return true;
  }

  /** Spreads squads over the level's entry lanes, posted just outside the build zone. */
  private assignPost(squad: Squad): void {
    const { level } = this.world;
    const gates = level.def.gates;
    const load = gates.map((_, i) => this.squads.filter((s) => s.lane === i).length);
    const lane = load.indexOf(Math.min(...load));
    const stacked = load[lane];
    const angle = gates[lane].angle * DEG;
    // Later squads on the same lane stand beside the first ones.
    const lateral = stacked === 0 ? 0 : (stacked % 2 === 1 ? 1 : -1) * Math.ceil(stacked / 2) * 4.5;
    squad.lane = lane;
    squad.facing = angle;
    const radius = squad.def.unit.flying ? 20 : 24;
    for (let r = radius; r >= 10; r -= 1) {
      const x = Math.sin(angle) * r + Math.cos(angle) * lateral;
      const z = Math.cos(angle) * r - Math.sin(angle) * lateral;
      if (squad.def.unit.flying || level.walkable(x, z)) {
        squad.post.set(x, 0, z);
        return;
      }
    }
    squad.post.set(Math.sin(angle) * 12, 0, Math.cos(angle) * 12);
  }

  update(dt: number): void {
    const { input, playing } = this.world;
    this.time += dt;
    for (const [kind, left] of this.cooldowns) this.cooldowns.set(kind, Math.max(0, left - dt));

    if (playing) {
      for (const kind of SQUAD_ORDER) if (input.wasKeyPressed(SQUADS[kind].hotkey)) this.deploy(kind);
      for (const a of this.allies) if (a.alive) updateAlly(a, dt, this.world);
    }
    for (const a of this.allies) a.animate(dt);

    if (this.allies.some((a) => !a.alive)) this.removeDead();
    this.markerMaterial.opacity = 0.25 + Math.sin(this.time * 2.5) * 0.1;
  }

  private removeDead(): void {
    const { effects, sfx, events, scene } = this.world;
    this.allies = this.allies.filter((a) => {
      if (a.alive) return true;
      const pos = a.position.clone().setY(a.aimHeight);
      effects.explosion(pos, a.unit.deathSize, { debrisColor: C.playerSteel, shake: a.unit.deathSize * 0.04 });
      sfx.explosion(a.unit.deathSize, this.world.pan(pos.x));
      a.dispose(scene);
      return false;
    });
    this.squads = this.squads.filter((s) => {
      if (s.alive) return true;
      this.markers.get(s)?.removeFromParent();
      this.markers.delete(s);
      events.emit('squadLost', { kind: s.def.kind });
      events.emit('message', { text: `${s.def.name} squad lost`, tone: 'warn' });
      return false;
    });
  }

  /** Nearest ally an enemy could attack. Ground-only attackers can't reach flyers. */
  nearest(x: number, z: number, range: number, canHitAir: boolean): Ally | null {
    let best: Ally | null = null;
    let bestDist = range;
    for (const a of this.allies) {
      if (!a.alive || (a.flying && !canHitAir)) continue;
      const d = Math.hypot(a.position.x - x, a.position.z - z) - a.radius;
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return best;
  }

  /** Ground allies caught in a blast. */
  inRadius(x: number, z: number, radius: number, out: Ally[]): Ally[] {
    out.length = 0;
    for (const a of this.allies) {
      if (!a.alive || a.flying) continue;
      if (tmp.set(a.position.x - x, 0, a.position.z - z).length() <= radius + a.radius) out.push(a);
    }
    return out;
  }

  repairAll(fraction: number): void {
    for (const a of this.allies) if (a.alive) a.repair(fraction);
  }

  clear(): void {
    for (const a of this.allies) a.dispose(this.world.scene);
    for (const m of this.markers.values()) m.removeFromParent();
    this.allies = [];
    this.squads = [];
    this.markers.clear();
    this.cooldowns.clear();
  }
}
