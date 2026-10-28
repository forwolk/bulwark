import { NavGrid, Surface } from './NavGrid';

const N = NavGrid.size;
const DIAG = Math.SQRT2;
/** Extra cost for cells next to walls and drops keeps paths in the middle of lanes. */
const EDGE_PENALTY = [3, 1.2, 0.4];

/** Binary min-heap of cell indices keyed by an external cost array. */
class CellHeap {
  private readonly items: number[] = [];
  constructor(private readonly cost: Float32Array) {}

  get size(): number {
    return this.items.length;
  }

  push(k: number): void {
    const a = this.items;
    a.push(k);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cost[a[p]] <= this.cost[a[i]]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.cost[a[l]] < this.cost[a[m]]) m = l;
        if (r < a.length && this.cost[a[r]] < this.cost[a[m]]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Distance-to-goal field over the nav grid. Every walkable cell knows which way leads to the core,
 * so any number of ground units can path through lanes and around obstacles for one lookup each.
 */
export class FlowField {
  readonly dist = new Float32Array(N * N).fill(Infinity);
  private readonly dirX = new Float32Array(N * N);
  private readonly dirZ = new Float32Array(N * N);

  constructor(private readonly nav: NavGrid, goalX: number, goalZ: number, goalRadius: number) {
    const penalty = this.edgePenalties();
    const heap = new CellHeap(this.dist);
    for (let k = 0; k < N * N; k++) {
      if (nav.surface[k] !== Surface.Ground) continue;
      if (Math.hypot(nav.cellCenterX(k) - goalX, nav.cellCenterZ(k) - goalZ) <= goalRadius) {
        this.dist[k] = 0;
        heap.push(k);
      }
    }

    const done = new Uint8Array(N * N);
    while (heap.size > 0) {
      const k = heap.pop();
      if (done[k]) continue;
      done[k] = 1;
      const i = k % N;
      const j = (k - i) / N;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
          const nk = nj * N + ni;
          if (done[nk] || nav.surface[nk] !== Surface.Ground) continue;
          // No cutting corners past walls.
          if (di !== 0 && dj !== 0 && (nav.surface[j * N + ni] !== Surface.Ground || nav.surface[nj * N + i] !== Surface.Ground)) continue;
          const step = (di !== 0 && dj !== 0 ? DIAG : 1) + penalty[nk];
          const d = this.dist[k] + step;
          if (d < this.dist[nk]) {
            this.dist[nk] = d;
            heap.push(nk);
          }
        }
      }
    }
    this.computeDirections();
  }

  /** Cost added to cells within three steps of a non-walkable cell. */
  private edgePenalties(): Float32Array {
    const nav = this.nav;
    const penalty = new Float32Array(N * N);
    const reach = EDGE_PENALTY.length;
    for (let k = 0; k < N * N; k++) {
      if (nav.surface[k] === Surface.Ground) continue;
      const i = k % N;
      const j = (k - i) / N;
      for (let dj = -reach; dj <= reach; dj++) {
        for (let di = -reach; di <= reach; di++) {
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
          const ring = Math.max(Math.abs(di), Math.abs(dj)) - 1;
          if (ring < 0) continue;
          const nk = nj * N + ni;
          penalty[nk] = Math.max(penalty[nk], EDGE_PENALTY[ring]);
        }
      }
    }
    return penalty;
  }

  /** Each cell points at its lowest-cost neighbour. */
  private computeDirections(): void {
    for (let k = 0; k < N * N; k++) {
      if (!Number.isFinite(this.dist[k])) continue;
      const i = k % N;
      const j = (k - i) / N;
      let best = this.dist[k];
      let bx = 0;
      let bz = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ni = i + di;
          const nj = j + dj;
          if ((di === 0 && dj === 0) || ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
          const d = this.dist[nj * N + ni];
          if (d < best) {
            best = d;
            bx = di;
            bz = dj;
          }
        }
      }
      const len = Math.hypot(bx, bz) || 1;
      this.dirX[k] = bx / len;
      this.dirZ[k] = bz / len;
    }
  }

  reachable(x: number, z: number): boolean {
    const k = this.nav.index(x, z);
    return k >= 0 && Number.isFinite(this.dist[k]);
  }

  /**
   * Smoothed direction toward the goal: blends the four surrounding cells, skipping unreachable ones.
   * Returns false when the position has no path (the caller should steer directly instead).
   */
  direction(x: number, z: number, out: { x: number; z: number }): boolean {
    const fx = x + N / 2 - 0.5;
    const fz = z + N / 2 - 0.5;
    const i0 = Math.floor(fx);
    const j0 = Math.floor(fz);
    const tx = fx - i0;
    const tz = fz - j0;
    let sx = 0;
    let sz = 0;
    let sw = 0;
    for (let c = 0; c < 4; c++) {
      const i = i0 + (c & 1);
      const j = j0 + (c >> 1);
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const k = j * N + i;
      if (!Number.isFinite(this.dist[k])) continue;
      const w = ((c & 1) ? tx : 1 - tx) * ((c >> 1) ? tz : 1 - tz);
      sx += this.dirX[k] * w;
      sz += this.dirZ[k] * w;
      sw += w;
    }
    const len = Math.hypot(sx, sz);
    if (sw === 0 || len < 1e-4) return false;
    out.x = sx / len;
    out.z = sz / len;
    return true;
  }
}
