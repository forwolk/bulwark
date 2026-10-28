export const RENDER = {
  /** Highest device pixel ratio the scene renders at. */
  maxPixelRatio: 2,
  /** Device pixels the scene may cover. Native Retina (~5M px) costs twice this and gains little on flat-shaded low-poly. */
  pixelBudget: 3_000_000,
  /** The resolution governor never goes below this. */
  minPixelRatio: 0.75,
  msaaSamples: 4,
  /** Point lights pooled for explosion flashes. Every lit pixel pays for each one, even when dark. */
  flashLights: 4,
  governor: {
    /** Lower resolution when the median frame takes longer than this (seconds). */
    slowFrame: 1 / 52,
    /** Frames per measurement window. */
    window: 90,
    /** Seconds to ignore after start-up or a resolution change (shader compiles, target reallocations). */
    settleTime: 2.5,
    /** Resolution multiplier applied per step down. */
    step: 0.85,
  },
} as const;
