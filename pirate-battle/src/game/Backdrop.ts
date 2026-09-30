import { Application, Container, Graphics, Texture, TilingSprite } from 'pixi.js';
import { GAME_CONFIG as C, ISLANDS } from './config';

/**
 * Cena de fundo: apenas água + ilhas + borda.
 * Nenhum navio, torreta, HUD ou interação.
 */
export class Backdrop {
  private app: Application;
  private host: HTMLElement;
  private water: Texture;
  private destroyed = false;

  constructor(host: HTMLElement, water: Texture) {
    this.host = host;
    this.water = water;
    this.app = new Application();
  }

  async init() {
    await this.app.init({
      background: '#0b2a45',
      width: C.arena.width,
      height: C.arena.height,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.host.appendChild(this.app.canvas);
    const world = new Container();
    this.app.stage.addChild(world);

    const bg = new TilingSprite({
      texture: this.water,
      width: C.arena.width,
      height: C.arena.height,
    });
    world.addChild(bg);

    for (const isl of ISLANDS) {
      const g = new Graphics();
      g.rect(isl.x, isl.y, isl.w, isl.h)
        .fill('#c9b27a').stroke({ width: 4, color: '#6f5a2a' });
      world.addChild(g);
    }

    const border = new Graphics();
    border.rect(0, 0, C.arena.width, C.arena.height)
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