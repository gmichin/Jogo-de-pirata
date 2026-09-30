import { Application, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { ISLAND_SPECS } from './config';

/**
 * Cena de fundo: água + ilhas (usando as imagens reais) + borda.
 * Nenhum navio, torreta, HUD ou interação.
 */
export class Backdrop {
  private app: Application;
  private host: HTMLElement;
  private water: Texture;
  private island1: Texture;
  private island2: Texture;
  private destroyed = false;

  constructor(host: HTMLElement, water: Texture, island1: Texture, island2: Texture) {
    this.host = host;
    this.water = water;
    this.island1 = island1;
    this.island2 = island2;
    this.app = new Application();
  }

  async init() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    await this.app.init({
      background: '#0b2a45',
      width: w,
      height: h,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.host.appendChild(this.app.canvas);
    const world = new Container();
    this.app.stage.addChild(world);

    const bg = new TilingSprite({
      texture: this.water,
      width: w,
      height: h,
    });
    world.addChild(bg);

    // Desenha as ilhas reais mantendo a proporção original das imagens.
    for (const spec of ISLAND_SPECS) {
      const tex = spec.textureKey === 'island1' ? this.island1 : this.island2;
      const iw = spec.wFrac * w;
      const texW = tex.width || 1;
      const texH = tex.height || 1;
      const ih = iw * (texH / texW);
      const ix = spec.xFrac * w;
      const iy = spec.yFrac * h;

      const sprite = new Sprite(tex);
      sprite.x = ix;
      sprite.y = iy;
      sprite.width = iw;
      sprite.height = ih;
      world.addChild(sprite);
    }

    const border = new Graphics();
    border.rect(0, 0, w, h)
      .stroke({ width: 4, color: '#0a2440' });
    world.addChild(border);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      this.app.destroy(true, { children: true });
    } catch { /* ignore */ }
  }
}