import * as THREE from 'three';

interface Flash {
  light: THREE.PointLight;
  peak: number;
  age: number;
  life: number;
}

/**
 * Fixed pool of point lights for explosion flashes. The pool size never changes,
 * which avoids shader recompiles that adding/removing lights would trigger.
 */
export class LightFlashes {
  private readonly flashes: Flash[] = [];

  constructor(scene: THREE.Scene, size: number) {
    for (let i = 0; i < size; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      scene.add(light);
      this.flashes.push({ light, peak: 0, age: 1, life: 1 });
    }
  }

  flash(pos: THREE.Vector3, color: THREE.ColorRepresentation, intensity: number, distance: number, life: number): void {
    // Reuse whichever slot currently contributes the least light.
    let best = this.flashes[0];
    for (const f of this.flashes) if (f.light.intensity < best.light.intensity) best = f;
    if (best.light.intensity > intensity) return;
    best.light.position.copy(pos);
    best.light.position.y = Math.max(pos.y, 1.5);
    best.light.color.set(color);
    best.light.distance = distance;
    best.peak = intensity;
    best.age = 0;
    best.life = life;
    best.light.intensity = intensity;
  }

  clear(): void {
    for (const f of this.flashes) f.light.intensity = 0;
  }

  update(dt: number): void {
    for (const f of this.flashes) {
      if (f.age >= f.life) {
        f.light.intensity = 0;
        continue;
      }
      f.age += dt;
      const t = Math.min(1, f.age / f.life);
      f.light.intensity = f.peak * (1 - t) * (1 - t);
    }
  }
}
