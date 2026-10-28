export interface Positioned {
  position: { x: number; z: number };
}

/** Uniform grid on the XZ plane, rebuilt every frame for fast neighbour queries. */
export class SpatialHash<T extends Positioned> {
  private readonly cells = new Map<number, T[]>();
  private readonly pool: T[][] = [];

  constructor(private readonly cellSize: number) {}

  private key(cx: number, cz: number): number {
    return (cx + 1024) * 4096 + (cz + 1024);
  }

  clear(): void {
    for (const bucket of this.cells.values()) {
      bucket.length = 0;
      this.pool.push(bucket);
    }
    this.cells.clear();
  }

  insert(item: T): void {
    const cx = Math.floor(item.position.x / this.cellSize);
    const cz = Math.floor(item.position.z / this.cellSize);
    const k = this.key(cx, cz);
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = this.pool.pop() ?? [];
      this.cells.set(k, bucket);
    }
    bucket.push(item);
  }

  /** Collects items whose cell overlaps the query circle. Callers do the exact distance test. */
  query(x: number, z: number, radius: number, out: T[]): T[] {
    out.length = 0;
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minZ = Math.floor((z - radius) / this.cellSize);
    const maxZ = Math.floor((z + radius) / this.cellSize);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const bucket = this.cells.get(this.key(cx, cz));
        if (bucket) for (const item of bucket) out.push(item);
      }
    }
    return out;
  }
}
