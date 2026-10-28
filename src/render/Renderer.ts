import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SanitizeShader } from './SanitizeShader';
import { RENDER } from '../config/graphics';

/**
 * Owns the WebGL renderer and the post-processing chain.
 * Scene is rendered into an HDR multisampled target so emissive colours above 1.0 drive the bloom.
 *
 * Only the scene pass is multisampled. Bloom blends its result back into its input buffer, and
 * drawing into a multisampled buffer that already has content makes tile-based GPUs (Apple Silicon)
 * reload every sample from memory, so the resolved scene is copied into a single-sample buffer first.
 * That copy also scrubs NaNs and caps brightness, so a stray bad pixel can't blow up in the bloom.
 */
export class Renderer {
  readonly webgl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  /** Governor multiplier on top of the pixel-budget cap. */
  private scale = 1;
  private pixelRatio = 1;

  constructor(container: HTMLElement, private readonly camera: THREE.PerspectiveCamera) {
    this.webgl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.1;
    container.appendChild(this.webgl.domElement);

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: RENDER.msaaSamples });
    this.composer = new EffectComposer(this.webgl, target);
    // RenderPass draws into the read buffer, so that one keeps MSAA. Two buffer swaps per frame
    // (copy + output) mean the roles never change: the scene always lands in the multisampled
    // target, and bloom and output always run on the single-sample one.
    this.composer.readBuffer.samples = RENDER.msaaSamples;
    this.composer.writeBuffer.samples = 0;
    this.composer.addPass(new RenderPass(this.scene, camera));
    this.composer.addPass(new ShaderPass(SanitizeShader));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.5, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get canvas(): HTMLCanvasElement {
    return this.webgl.domElement;
  }

  /** Per-level bloom: bright daylight ground needs a higher threshold than a dark level. */
  setBloom(threshold: number, strength: number): void {
    this.bloom.threshold = threshold;
    this.bloom.strength = strength;
  }

  /** Device pixels per CSS pixel the scene is currently rendered at. */
  get resolution(): number {
    return this.pixelRatio;
  }

  /** Scales resolution down by `factor`. Returns false once already at the minimum. */
  lowerResolution(factor: number): boolean {
    if (this.pixelRatio <= RENDER.minPixelRatio) return false;
    this.scale *= factor;
    this.resize();
    return true;
  }

  /** Native density, capped so the drawing buffer stays within the pixel budget. */
  private targetPixelRatio(w: number, h: number): number {
    const budgetRatio = Math.sqrt(RENDER.pixelBudget / (w * h));
    const cap = Math.min(window.devicePixelRatio, RENDER.maxPixelRatio, budgetRatio);
    return Math.max(RENDER.minPixelRatio, Math.round(cap * this.scale * 100) / 100);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.pixelRatio = this.targetPixelRatio(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.webgl.setPixelRatio(this.pixelRatio);
    this.webgl.setSize(w, h);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    // Bloom is sized in CSS pixels: the glow looks the same at any pixel ratio and costs far less on Retina.
    this.bloom.setSize(w, h);
  }

  render(): void {
    this.composer.render();
  }
}
