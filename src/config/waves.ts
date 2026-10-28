import type { EnemyKind } from './enemies';

export interface SpawnGroup {
  kind: EnemyKind;
  count: number;
  /** Seconds between individual spawns within the group. */
  interval: number;
  /** Seconds after wave start before the group begins. */
  delay: number;
  /** Optional fixed approach angle in degrees (0 = from +Z / bottom of screen). Random if omitted. */
  angle?: number;
}

export interface WaveDef {
  groups: SpawnGroup[];
}

export const WAVES: WaveDef[] = [
  { groups: [
    { kind: 'skitter', count: 14, interval: 0.6, delay: 0, angle: 180 },
    { kind: 'skitter', count: 10, interval: 0.5, delay: 9 },
  ] },
  { groups: [
    { kind: 'skitter', count: 18, interval: 0.4, delay: 0 },
    { kind: 'strider', count: 4, interval: 1.6, delay: 5 },
    { kind: 'skitter', count: 12, interval: 0.35, delay: 14 },
  ] },
  { groups: [
    { kind: 'wasp', count: 8, interval: 0.7, delay: 0 },
    { kind: 'skitter', count: 20, interval: 0.3, delay: 4 },
    { kind: 'strider', count: 6, interval: 1.2, delay: 10 },
  ] },
  { groups: [
    { kind: 'juggernaut', count: 2, interval: 4, delay: 0 },
    { kind: 'skitter', count: 30, interval: 0.25, delay: 2 },
    { kind: 'strider', count: 8, interval: 1, delay: 8 },
  ] },
  { groups: [
    { kind: 'wasp', count: 16, interval: 0.4, delay: 0 },
    { kind: 'wasp', count: 10, interval: 0.4, delay: 10 },
    { kind: 'strider', count: 10, interval: 0.9, delay: 3 },
    { kind: 'skitter', count: 24, interval: 0.25, delay: 12 },
  ] },
  { groups: [
    { kind: 'juggernaut', count: 4, interval: 3, delay: 0 },
    { kind: 'skitter', count: 40, interval: 0.18, delay: 3 },
    { kind: 'strider', count: 12, interval: 0.8, delay: 8 },
    { kind: 'wasp', count: 10, interval: 0.5, delay: 14 },
  ] },
  { groups: [
    { kind: 'skitter', count: 30, interval: 0.15, delay: 0 },
    { kind: 'skitter', count: 30, interval: 0.15, delay: 0 },
    { kind: 'wasp', count: 20, interval: 0.35, delay: 6 },
    { kind: 'juggernaut', count: 3, interval: 2.5, delay: 10 },
    { kind: 'strider', count: 14, interval: 0.6, delay: 14 },
  ] },
  { groups: [
    { kind: 'juggernaut', count: 6, interval: 2, delay: 0 },
    { kind: 'strider', count: 18, interval: 0.5, delay: 4 },
    { kind: 'wasp', count: 24, interval: 0.3, delay: 8 },
    { kind: 'skitter', count: 40, interval: 0.15, delay: 12 },
  ] },
  { groups: [
    { kind: 'skitter', count: 50, interval: 0.12, delay: 0 },
    { kind: 'wasp', count: 30, interval: 0.25, delay: 3 },
    { kind: 'juggernaut', count: 8, interval: 1.6, delay: 8 },
    { kind: 'strider', count: 20, interval: 0.45, delay: 12 },
    { kind: 'skitter', count: 40, interval: 0.12, delay: 20 },
  ] },
  { groups: [
    { kind: 'leviathan', count: 1, interval: 1, delay: 2, angle: 180 },
    { kind: 'skitter', count: 30, interval: 0.2, delay: 0 },
    { kind: 'strider', count: 16, interval: 0.6, delay: 8 },
    { kind: 'wasp', count: 24, interval: 0.4, delay: 16 },
    { kind: 'juggernaut', count: 6, interval: 2.5, delay: 24 },
  ] },
];
