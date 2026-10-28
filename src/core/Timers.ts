interface Scheduled {
  remaining: number;
  fn: () => void;
}

/** Game-time delayed callbacks (respects pause and slow motion, unlike setTimeout). */
export class Timers {
  private items: Scheduled[] = [];

  after(delay: number, fn: () => void): void {
    this.items.push({ remaining: delay, fn });
  }

  update(dt: number): void {
    if (this.items.length === 0) return;
    const due: Scheduled[] = [];
    this.items = this.items.filter((item) => {
      item.remaining -= dt;
      if (item.remaining <= 0) {
        due.push(item);
        return false;
      }
      return true;
    });
    for (const item of due) item.fn();
  }

  clear(): void {
    this.items = [];
  }
}
