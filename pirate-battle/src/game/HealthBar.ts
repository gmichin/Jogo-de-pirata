import { Container, Graphics, Sprite, Texture } from 'pixi.js';

export interface HealthBarOptions {
  frame: Texture;
  green: Texture;
  amber: Texture;
  red: Texture;
  targetWidth: number;
  greenThreshold: number;
  amberThreshold: number;
  /** Se true, quando ratio = 0 some a barra inteira. */
  hideOnZero?: boolean;
}

export class HealthBar {
  readonly container: Container;
  private fill: Sprite;
  private maskGfx: Graphics;
  private maxWidth: number;
  private maxHeight: number;
  private offsetX: number;
  private offsetY: number;
  private texGreen: Texture;
  private texAmber: Texture;
  private texRed: Texture;
  private greenThreshold: number;
  private amberThreshold: number;
  private hideOnZero: boolean;
  private lastRatio = -1;
  private lastColor: 'g' | 'a' | 'r' | '' = '';

  constructor(opts: HealthBarOptions) {
    this.texGreen = opts.green;
    this.texAmber = opts.amber;
    this.texRed = opts.red;
    this.greenThreshold = opts.greenThreshold;
    this.amberThreshold = opts.amberThreshold;
    this.hideOnZero = opts.hideOnZero ?? true;

    this.container = new Container();

    const frame = new Sprite(opts.frame);
    frame.anchor.set(0.5);
    const frameScale = opts.targetWidth / frame.texture.width;
    frame.scale.set(frameScale);
    this.container.addChild(frame);

    const fw = frame.texture.width * frameScale;
    const fh = frame.texture.height * frameScale;

    const padX = Math.max(2, fw * 0.06);
    const padY = Math.max(2, fh * 0.22);
    this.maxWidth = fw - padX * 2;
    this.maxHeight = fh - padY * 2;
    this.offsetX = -fw / 2 + padX;
    this.offsetY = -this.maxHeight / 2;

    this.fill = new Sprite(opts.green);
    this.fill.anchor.set(0, 0);
    this.fill.x = this.offsetX;
    this.fill.y = this.offsetY;
    this.fill.width = this.maxWidth;
    this.fill.height = this.maxHeight;
    this.container.addChild(this.fill);

    this.maskGfx = new Graphics();
    this.container.addChild(this.maskGfx);
    this.fill.mask = this.maskGfx;

    this.setRatio(1);
  }

  setRatio(ratio: number): void {
    const clamped = Math.max(0, Math.min(1, ratio));

    if (this.hideOnZero && clamped <= 0) {
      this.container.visible = false;
      this.lastRatio = clamped;
      return;
    }
    this.container.visible = true;

    const color: 'g' | 'a' | 'r' =
      clamped > this.greenThreshold ? 'g'
      : clamped > this.amberThreshold ? 'a'
      : 'r';

    if (clamped === this.lastRatio && color === this.lastColor) return;
    this.lastRatio = clamped;
    this.lastColor = color;

    this.maskGfx.clear();
    this.maskGfx
      .rect(this.offsetX, this.offsetY, this.maxWidth * clamped, this.maxHeight)
      .fill(0xffffff);

    const tex = color === 'g' ? this.texGreen : color === 'a' ? this.texAmber : this.texRed;
    if (this.fill.texture !== tex) {
      this.fill.texture = tex;
      this.fill.width = this.maxWidth;
      this.fill.height = this.maxHeight;
    }
  }

  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  setVisible(v: boolean): void { this.container.visible = v; }

  destroy(): void { this.container.destroy({ children: true }); }
}