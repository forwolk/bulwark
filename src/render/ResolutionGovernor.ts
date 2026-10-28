import { RENDER } from '../config/graphics';
import type { Renderer } from './Renderer';

const { governor } = RENDER;

/**
 * Watches real frame times and lowers render resolution while the GPU can't keep up.
 * It only ever steps down: with vsync there is no reliable way to measure headroom, so stepping
 * back up would oscillate between a smooth and a stuttering resolution.
 */
export class ResolutionGovernor {
  private readonly samples: number[] = [];
  private settle: number = governor.settleTime;

  constructor(private readonly renderer: Renderer) {}

  /** @param frameSeconds unclamped wall-clock time since the previous frame */
  update(frameSeconds: number): void {
    if (this.settle > 0) {
      this.settle -= frameSeconds;
      return;
    }
    this.samples.push(frameSeconds);
    if (this.samples.length < governor.window) return;

    this.samples.sort((a, b) => a - b);
    const median = this.samples[this.samples.length >> 1];
    this.samples.length = 0;
    if (median <= governor.slowFrame || !this.renderer.lowerResolution(governor.step)) return;

    this.settle = governor.settleTime;
    if (import.meta.env.DEV) {
      console.info(`[render] median frame ${(median * 1000).toFixed(1)}ms, pixel ratio lowered to ${this.renderer.resolution.toFixed(2)}`);
    }
  }
}
