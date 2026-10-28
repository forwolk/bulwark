import { clamp } from '../core/math';

type Wave = OscillatorType;

/**
 * Procedural sound effects synthesized with WebAudio. No audio files needed.
 * Each sound is rate-limited so dense combat doesn't turn into noise.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private readonly lastPlayed = new Map<string, number>();
  private muted = false;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.ratio.value = 6;
      this.master = ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(compressor).connect(ctx.destination);

      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
    }
    void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  private gate(key: string, minInterval: number): AudioContext | null {
    const ctx = this.ctx;
    if (!ctx || this.muted) return null;
    const last = this.lastPlayed.get(key) ?? -1;
    if (ctx.currentTime - last < minInterval) return null;
    this.lastPlayed.set(key, ctx.currentTime);
    return ctx;
  }

  private output(ctx: AudioContext, pan: number): AudioNode {
    const panner = ctx.createStereoPanner();
    panner.pan.value = clamp(pan, -1, 1);
    panner.connect(this.master);
    return panner;
  }

  private tone(ctx: AudioContext, type: Wave, f0: number, f1: number, dur: number, vol: number, pan = 0, delay = 0): void {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.output(ctx, pan));
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(ctx: AudioContext, dur: number, vol: number, filter: BiquadFilterType, f0: number, f1: number, pan = 0, q = 1): void {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(f0, t);
    biquad.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(biquad).connect(gain).connect(this.output(ctx, pan));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  cannon(pan: number): void {
    const ctx = this.gate('cannon', 0.05);
    if (!ctx) return;
    this.noise(ctx, 0.16, 0.45, 'lowpass', 3200, 300, pan);
    this.tone(ctx, 'square', 160, 50, 0.12, 0.12, pan);
  }

  gatling(pan: number): void {
    const ctx = this.gate('gatling', 0.07);
    if (!ctx) return;
    this.noise(ctx, 0.05, 0.18, 'bandpass', 3500, 1400, pan, 2);
  }

  flak(pan: number): void {
    const ctx = this.gate('flak', 0.12);
    if (!ctx) return;
    this.noise(ctx, 0.12, 0.25, 'bandpass', 1800, 500, pan, 1.5);
    this.tone(ctx, 'square', 300, 120, 0.06, 0.05, pan);
  }

  mortar(pan: number): void {
    const ctx = this.gate('mortar', 0.15);
    if (!ctx) return;
    this.tone(ctx, 'sine', 140, 40, 0.35, 0.5, pan);
    this.noise(ctx, 0.25, 0.25, 'lowpass', 900, 100, pan);
  }

  zap(pan: number): void {
    const ctx = this.gate('zap', 0.08);
    if (!ctx) return;
    this.tone(ctx, 'sawtooth', 1400, 180, 0.22, 0.12, pan);
    this.noise(ctx, 0.2, 0.18, 'highpass', 4000, 2000, pan);
  }

  missile(pan: number): void {
    const ctx = this.gate('missile', 0.06);
    if (!ctx) return;
    this.noise(ctx, 0.35, 0.22, 'bandpass', 500, 2600, pan, 3);
  }

  explosion(size: number, pan: number): void {
    const ctx = this.gate(size > 1.6 ? 'boom-big' : 'boom', size > 1.6 ? 0.08 : 0.045);
    if (!ctx) return;
    const vol = clamp(0.25 + size * 0.2, 0.25, 0.9);
    this.noise(ctx, 0.35 + size * 0.25, vol, 'lowpass', 1500 + size * 400, 60, pan);
    this.tone(ctx, 'sine', 110, 28, 0.3 + size * 0.2, vol * 0.8, pan);
  }

  nova(): void {
    const ctx = this.gate('nova', 0.5);
    if (!ctx) return;
    this.tone(ctx, 'sine', 320, 30, 1.0, 0.7);
    this.tone(ctx, 'sawtooth', 900, 60, 0.6, 0.12);
    this.noise(ctx, 0.9, 0.4, 'lowpass', 3000, 80);
  }

  enemyShot(pan: number): void {
    const ctx = this.gate('enemyShot', 0.08);
    if (!ctx) return;
    this.tone(ctx, 'square', 520, 180, 0.12, 0.06, pan);
  }

  laser(pan: number): void {
    const ctx = this.gate('laser', 0.09);
    if (!ctx) return;
    this.tone(ctx, 'sawtooth', 1800, 1100, 0.07, 0.04, pan);
  }

  melee(pan: number): void {
    const ctx = this.gate('melee', 0.1);
    if (!ctx) return;
    this.noise(ctx, 0.08, 0.15, 'bandpass', 900, 400, pan, 4);
  }

  /** Core weapon swap: servo whine and a heavy lock-in clunk. */
  weaponSwap(): void {
    const ctx = this.gate('weaponSwap', 0.15);
    if (!ctx) return;
    this.tone(ctx, 'square', 180, 420, 0.3, 0.05);
    this.noise(ctx, 0.12, 0.25, 'lowpass', 600, 120, 0, 2);
    this.tone(ctx, 'triangle', 120, 60, 0.15, 0.15, 0, 0.35);
  }

  /** Scatter battery: a wide, bassy blast. */
  scatter(pan: number): void {
    const ctx = this.gate('scatter', 0.12);
    if (!ctx) return;
    this.noise(ctx, 0.3, 0.5, 'lowpass', 2400, 180, pan);
    this.tone(ctx, 'square', 110, 45, 0.18, 0.14, pan);
  }

  /** Lance beam hum, re-triggered while the beam is held; pitch rises with charge. */
  beam(pan: number, charge: number): void {
    const ctx = this.gate('beam', 0.09);
    if (!ctx) return;
    const f = 220 + charge * 260;
    this.tone(ctx, 'sawtooth', f, f * 1.04, 0.11, 0.03 + charge * 0.03, pan);
    this.noise(ctx, 0.1, 0.03 + charge * 0.03, 'bandpass', 2600, 2400, pan, 3);
  }

  /** Shot absorbed by a shield dome: a bright electric crackle. */
  shieldHit(pan: number): void {
    const ctx = this.gate('shieldHit', 0.06);
    if (!ctx) return;
    this.noise(ctx, 0.12, 0.12, 'bandpass', 4200, 1800, pan, 4);
    this.tone(ctx, 'sine', 1300, 700, 0.12, 0.05, pan);
  }

  shieldDown(pan: number): void {
    const ctx = this.gate('shieldDown', 0.3);
    if (!ctx) return;
    this.tone(ctx, 'sawtooth', 900, 80, 0.6, 0.12, pan);
    this.noise(ctx, 0.5, 0.2, 'lowpass', 3000, 200, pan);
  }

  shieldUp(pan: number): void {
    const ctx = this.gate('shieldUp', 0.3);
    if (!ctx) return;
    this.tone(ctx, 'sine', 220, 880, 0.45, 0.08, pan);
    this.tone(ctx, 'triangle', 330, 1320, 0.45, 0.04, pan, 0.05);
  }

  /** Enemy rocket leaving its rack. */
  rocketLaunch(pan: number): void {
    const ctx = this.gate('rocketLaunch', 0.08);
    if (!ctx) return;
    this.noise(ctx, 0.35, 0.18, 'bandpass', 900, 2600, pan, 1.5);
    this.tone(ctx, 'sawtooth', 160, 90, 0.2, 0.05, pan);
  }

  /** Falling bomb whistle. */
  bombWhistle(pan: number): void {
    const ctx = this.gate('bombWhistle', 0.25);
    if (!ctx) return;
    this.tone(ctx, 'sine', 1500, 500, 0.75, 0.05, pan);
  }

  /** Rail lance discharge: a sharp downward zip over a crackle. */
  rail(pan: number): void {
    const ctx = this.gate('rail', 0.08);
    if (!ctx) return;
    this.tone(ctx, 'sawtooth', 1800, 160, 0.28, 0.08, pan);
    this.noise(ctx, 0.2, 0.15, 'highpass', 3000, 900, pan);
  }

  /** Squad warping in: a quick rising chord. */
  deploy(): void {
    const ctx = this.gate('deploy', 0.2);
    if (!ctx) return;
    this.tone(ctx, 'triangle', 330, 660, 0.18, 0.12);
    this.tone(ctx, 'triangle', 495, 990, 0.18, 0.08, 0, 0.08);
    this.noise(ctx, 0.25, 0.08, 'bandpass', 800, 3000, 0, 2);
  }

  /** Falling scream into a chasm, or a deep glug into brine. */
  hazardFall(liquid: boolean, pan: number): void {
    const ctx = this.gate('hazardFall', 0.12);
    if (!ctx) return;
    if (liquid) {
      this.noise(ctx, 0.35, 0.22, 'lowpass', 900, 120, pan, 3);
      this.tone(ctx, 'sine', 220, 70, 0.3, 0.12, pan);
    } else {
      this.tone(ctx, 'sawtooth', 620, 90, 0.7, 0.07, pan);
      this.noise(ctx, 0.5, 0.1, 'bandpass', 1400, 300, pan, 2);
    }
  }

  coreHit(): void {
    const ctx = this.gate('coreHit', 0.25);
    if (!ctx) return;
    this.tone(ctx, 'triangle', 200, 90, 0.2, 0.2);
  }

  build(): void {
    const ctx = this.gate('build', 0.05);
    if (!ctx) return;
    this.tone(ctx, 'triangle', 330, 660, 0.1, 0.18);
    this.tone(ctx, 'triangle', 660, 990, 0.1, 0.12, 0, 0.07);
  }

  sell(): void {
    const ctx = this.gate('sell', 0.05);
    if (!ctx) return;
    this.tone(ctx, 'triangle', 700, 300, 0.15, 0.15);
  }

  click(): void {
    const ctx = this.gate('click', 0.03);
    if (!ctx) return;
    this.tone(ctx, 'sine', 1500, 1200, 0.04, 0.08);
  }

  deny(): void {
    const ctx = this.gate('deny', 0.15);
    if (!ctx) return;
    this.tone(ctx, 'square', 150, 120, 0.14, 0.1);
  }

  waveStart(): void {
    const ctx = this.gate('waveStart', 1);
    if (!ctx) return;
    for (let i = 0; i < 3; i++) this.tone(ctx, 'sawtooth', 440, 330, 0.28, 0.1, 0, i * 0.35);
  }

  waveClear(): void {
    const ctx = this.gate('waveClear', 1);
    if (!ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(ctx, 'triangle', f, f, 0.22, 0.14, 0, i * 0.09));
  }

  victory(): void {
    const ctx = this.gate('victory', 2);
    if (!ctx) return;
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(ctx, 'triangle', f, f, 0.5, 0.16, 0, i * 0.14));
  }

  defeat(): void {
    const ctx = this.gate('defeat', 2);
    if (!ctx) return;
    [392, 330, 262, 196].forEach((f, i) => this.tone(ctx, 'sawtooth', f, f * 0.98, 0.5, 0.1, 0, i * 0.22));
  }
}
