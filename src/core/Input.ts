import * as THREE from 'three';

/**
 * Polled input state. Pointer presses are only registered when they originate on the
 * game canvas, so clicking HUD buttons never fires the cannon.
 */
export class Input {
  /** Pointer position in normalized device coordinates (-1..1). */
  readonly pointer = new THREE.Vector2();
  readonly pointerClient = new THREE.Vector2();
  pointerOverCanvas = false;
  wheelDelta = 0;

  private readonly buttonsDown = new Set<number>();
  private readonly buttonsPressed = new Set<number>();
  private readonly keysDown = new Set<string>();
  private readonly keysPressed = new Set<string>();

  constructor(canvas: HTMLCanvasElement) {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      this.buttonsDown.add(e.button);
      this.buttonsPressed.add(e.button);
    });
    window.addEventListener('pointerup', (e) => this.buttonsDown.delete(e.button));
    window.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.pointerClient.set(e.clientX, e.clientY);
      this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.pointerOverCanvas = e.target === canvas;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheelDelta += Math.sign(e.deltaY);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      if (!this.keysDown.has(e.code)) this.keysPressed.add(e.code);
      this.keysDown.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.code));
    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.buttonsDown.clear();
    });
  }

  isButtonDown(button: number): boolean {
    return this.buttonsDown.has(button);
  }

  wasButtonPressed(button: number): boolean {
    return this.buttonsPressed.has(button);
  }

  isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  wasKeyPressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  /** Call once at the end of every frame. */
  endFrame(): void {
    this.buttonsPressed.clear();
    this.keysPressed.clear();
    this.wheelDelta = 0;
  }
}
