import * as THREE from 'three';
import type { World } from '../core/World';
import { el } from './dom';

interface FloatingText {
  node: HTMLElement;
  pos: THREE.Vector3;
  age: number;
}

const BUCKETS = 24;
const screen = { x: 0, y: 0 };
const tmp = new THREE.Vector3();

/** Screen-space elements anchored to the 3D world: health bars, reward popups, off-screen threat arrows. */
export class WorldOverlay {
  private readonly root: HTMLElement;
  private readonly bars: HTMLElement[] = [];
  private readonly floats: FloatingText[] = [];
  private readonly arrows: HTMLElement[] = [];
  private readonly bucketCounts = new Array<number>(BUCKETS).fill(0);

  constructor(parent: HTMLElement, private readonly world: World) {
    this.root = el('div', 'world-overlay', parent);
    for (let i = 0; i < BUCKETS; i++) this.arrows.push(el('div', 'threat', this.root));
    world.events.on('enemyKilled', ({ reward, position }) => this.popup(`+${reward}`, position));
  }

  private popup(text: string, pos: THREE.Vector3): void {
    if (this.floats.length > 40) return;
    const node = el('div', 'float', this.root, text);
    this.floats.push({ node, pos: pos.clone().setY(pos.y + 1.5), age: 0 });
  }

  private bar(index: number): HTMLElement {
    while (this.bars.length <= index) {
      const bar = el('div', 'hpbar', this.root);
      el('div', 'hpbar-fill', bar);
      this.bars.push(bar);
    }
    return this.bars[index];
  }

  private placeBar(index: number, pos: THREE.Vector3, frac: number, width: number, enemy: boolean): boolean {
    if (!this.world.cameraRig.toScreen(pos, screen)) return false;
    const bar = this.bar(index);
    bar.style.display = 'block';
    bar.style.width = `${width}px`;
    bar.style.transform = `translate(${screen.x - width / 2}px, ${screen.y}px)`;
    bar.classList.toggle('enemy', enemy);
    const fill = bar.firstElementChild as HTMLElement;
    fill.style.width = `${Math.max(0, frac) * 100}%`;
    fill.classList.toggle('low', frac < 0.35);
    return true;
  }

  clear(): void {
    for (const f of this.floats) f.node.remove();
    this.floats.length = 0;
  }

  update(dt: number): void {
    const { structures, enemies, cameraRig, playing } = this.world;
    let used = 0;

    if (playing) {
      for (const s of structures.all) {
        if (s.hp < s.maxHp && this.placeBar(used, tmp.set(s.position.x, 2.8, s.position.z), s.hp / s.maxHp, 38, false)) used++;
      }
      for (const e of enemies.all) {
        if (!e.def.showHealthBar || e.hp >= e.def.hp) continue;
        const big = e.def.kind === 'leviathan';
        const base = e.flying ? e.position.y - e.def.altitude : e.position.y;
        tmp.set(e.position.x, base + e.def.radius * (big ? 2.4 : 2) + 1, e.position.z);
        if (this.placeBar(used, tmp, e.hp / e.def.hp, big ? 180 : 56, true)) used++;
      }
    }
    for (let i = used; i < this.bars.length; i++) this.bars[i].style.display = 'none';

    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.age += dt;
      f.pos.y += dt * 2.5;
      if (f.age > 1 || !cameraRig.toScreen(f.pos, screen)) {
        f.node.remove();
        this.floats.splice(i, 1);
        continue;
      }
      f.node.style.transform = `translate(${screen.x}px, ${screen.y}px) scale(${1 + Math.max(0, 0.3 - f.age)})`;
      f.node.style.opacity = `${1 - f.age * f.age}`;
    }

    this.updateThreats();
  }

  /** Arrows on the screen edge pointing at off-screen enemies, bucketed by direction. */
  private updateThreats(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;
    this.bucketCounts.fill(0);

    if (this.world.playing) {
      for (const e of this.world.enemies.all) {
        if (!this.world.cameraRig.toScreen(e.position, screen)) continue;
        if (screen.x >= 0 && screen.x <= w && screen.y >= 0 && screen.y <= h) continue;
        const a = Math.atan2(screen.y - cy, screen.x - cx);
        const bucket = ((Math.round((a / (Math.PI * 2)) * BUCKETS) % BUCKETS) + BUCKETS) % BUCKETS;
        this.bucketCounts[bucket]++;
      }
    }

    for (let i = 0; i < BUCKETS; i++) {
      const arrow = this.arrows[i];
      const count = this.bucketCounts[i];
      if (count === 0) {
        arrow.style.display = 'none';
        continue;
      }
      const a = (i / BUCKETS) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const inset = 34;
      const t = Math.min((cx - inset) / Math.abs(dx || 1e-6), (cy - inset - 40) / Math.abs(dy || 1e-6));
      arrow.style.display = 'block';
      const scale = Math.min(1.8, 0.8 + count * 0.06);
      arrow.style.transform = `translate(${cx + dx * t}px, ${cy + dy * t}px) rotate(${a}rad) scale(${scale})`;
    }
  }
}
