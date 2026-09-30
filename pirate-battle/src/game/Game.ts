import {
  Application, Container, Graphics, Rectangle, Sprite, Text, TextStyle, Texture, TilingSprite,
} from 'pixi.js';
import { GAME_CONFIG as C, getIslands, SHIP_INDEX, SHIP_ROTATION_OFFSET } from './config';
import { HealthBar } from './HealthBar';
import type {
  Enemy, Entity, GameSnapshot, Player, PlayerId,
  Projectile, Rect, RunConfig, Turret,
} from './types';

type OnEnd = (snapshot: GameSnapshot) => void;

const FIRE_OFFSETS = [
  { x: -0.45, y: -0.15 },
  { x:  0.45, y:  0.15 },
  { x:  0.05, y:  0.50 },
  { x: -0.15, y: -0.55 },
];

const HUD_STYLE = new TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize: 22,
  fontWeight: '700',
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 3 },
});

const TIMER_STYLE = new TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize: 20,
  fontWeight: '700',
  fill: 0xffe400,
  stroke: { color: 0x000000, width: 3 },
});

const MENU_TITLE_STYLE = new TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize: 26,
  fontWeight: '700',
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 3 },
});

const MENU_BUTTON_STYLE = new TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize: 18,
  fontWeight: '700',
  fill: 0x10263a,
});

interface Scheduled { delay: number; action: () => void; done: boolean; }
interface Wreck {
  sprite: Sprite;
  vx: number; vy: number;
  baseScale: number;
  scaleFrom: number; scaleTo: number;
  elapsed: number; maxLife: number; dead: boolean;
}

export class Game {
  private app: Application;
  private world: Container;
  private hudLayer: Container;
  private menuLayer: Container;
  private host: HTMLElement;
  private onEnd: OnEnd;
  private onQuit: () => void;
  private onRestart: () => void;

  private arenaW = C.arena.width;
  private arenaH = C.arena.height;

  private textures: {
    explosionLarge: Texture; explosionMedium: Texture; explosionSmall: Texture;
    fireLarge: Texture; fireSmall: Texture;
    cannonBall: Texture; cannon: Texture; ships: Texture[];
    tileCannonPlatform: Texture; tileWater: Texture;
    healthFrame: Texture;
    healthFillGreen: Texture; healthFillAmber: Texture; healthFillRed: Texture;
    counterPanel: Texture;
    enemyHealthFillGreen: Texture; enemyHealthFillRed: Texture;
    iconHeart: Texture;
    iconTime: Texture;
    buttonPrimaryDisabled: Texture;
    buttonRoundNormal: Texture; buttonRoundHover: Texture; iconPause: Texture;
    panelMenu: Texture;
    buttonPrimaryNormal: Texture; buttonPrimaryHover: Texture; buttonPrimaryPressed: Texture;
    iconPlay: Texture; iconRestart: Texture; iconHome: Texture;
  };

  private player: Player | null = null;
  private enemies: Enemy[] = [];
  private turrets: Turret[] = [];
  private projectiles: Projectile[] = [];
  private islands: Rect[] = [];
  private wrecks: Wreck[] = [];

  private enemyBars = new Map<string, HealthBar>();
  private turretBars = new Map<string, HealthBar>();

  private playerBar: HealthBar | null = null;
  private playerHpText: Text | null = null;
  private scoreText: Text | null = null;
  private timeText: Text | null = null;
  private pauseButton: Container | null = null;

  private pauseMenu: Container | null = null;
  private menuMode: 'pause' | 'death' | null = null;

  private aimGfx = new Map<string, Graphics>();
  private projectileAimGfx: Graphics;

  private keys: Record<string, boolean> = {};

  private snapshot: GameSnapshot;
  private runConfig: RunConfig;
  private elapsed = 0;
  private spawnAccumulator = 0;
  private destroyed = false;
  private ended = false;

  private scheduled: Scheduled[] = [];

  constructor(
    host: HTMLElement,
    runConfig: RunConfig,
    textures: Game['textures'],
    onEnd: OnEnd,
    onQuit: () => void,
    onRestart: () => void,
  ) {
    this.host = host;
    this.runConfig = runConfig;
    this.textures = textures;
    this.onEnd = onEnd;
    this.onQuit = onQuit;
    this.onRestart = onRestart;
    this.app = new Application();
    this.world = new Container();
    this.hudLayer = new Container();
    this.menuLayer = new Container();
    this.projectileAimGfx = new Graphics();

    this.snapshot = {
      score: 0,
      players: [{ id: 1, hp: C.player.hp, maxHp: C.player.hp }],
      timeLeft: runConfig.sessionTime,
      running: true, paused: false, ended: false, endReason: null,
    };
  }

  async init() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.arenaW = w;
    this.arenaH = h;

    await this.app.init({
      background: '#0b2a45',
      width: w,
      height: h,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    this.host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.app.stage.addChild(this.hudLayer);
    this.app.stage.addChild(this.menuLayer);

    this.drawWater();
    this.spawnIslandsAndTurrets();
    this.spawnPlayer();

    this.world.addChild(this.projectileAimGfx);
    this.createHud();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.app.ticker.add(this.update);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    try {
      this.app.ticker.remove(this.update);
      this.app.destroy(true, { children: true });
    } catch { /* ignore */ }
  }

  getSnapshot(): GameSnapshot {
    return { ...this.snapshot, players: this.snapshot.players.map(p => ({ ...p })) };
  }

  togglePause() {
    if (this.menuMode === 'death' || this.ended) return;
    if (this.menuMode === 'pause') this.closeMenu();
    else this.openMenu('pause');
  }

  // ---------- Input ----------

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.code === 'Space') e.preventDefault();
    this.keys[e.key] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys[e.key] = false; };
  private onBlur = () => {
    if (this.ended || this.menuMode !== null) return;
    this.openMenu('pause');
  };
  private onVisibility = () => {
    if (document.hidden && !this.ended && this.menuMode === null) this.openMenu('pause');
  };

  // ---------- Setup ----------

  private drawWater() {
    const bg = new TilingSprite({
      texture: this.textures.tileWater,
      width: this.arenaW,
      height: this.arenaH,
    });
    this.world.addChild(bg);
    const border = new Graphics();
    border.rect(0, 0, this.arenaW, this.arenaH)
      .stroke({ width: 4, color: '#0a2440' });
    this.world.addChild(border);
  }

  private spawnIslandsAndTurrets() {
    const islands = getIslands(this.arenaW, this.arenaH);
    for (let i = 0; i < islands.length; i++) {
      const isl = islands[i];
      this.islands.push({ ...isl });

      const g = new Graphics();
      g.rect(isl.x, isl.y, isl.w, isl.h)
        .fill('#c9b27a').stroke({ width: 4, color: '#6f5a2a' });
      this.world.addChild(g);

      const corners = [
        { x: isl.x,         y: isl.y         },
        { x: isl.x + isl.w, y: isl.y + isl.h },
      ];
      corners.forEach((c, idx) => this.spawnTurret(i, idx, c.x, c.y));
    }
  }

  private buildShipContainer(shipIndex: number, radius: number) {
    const container = new Container();
    const ship = new Sprite(this.textures.ships[shipIndex]);
    ship.anchor.set(0.5);
    this.fitSprite(ship, radius * 2.6);
    container.addChild(ship);

    const fires: Sprite[] = [];
    for (let i = 0; i < 4; i++) {
      const fire = new Sprite(this.textures.fireSmall);
      fire.anchor.set(0.5);
      this.fitSprite(fire, radius * 1.1);
      const off = FIRE_OFFSETS[i];
      fire.x = off.x * radius;
      fire.y = off.y * radius;
      fire.visible = false;
      container.addChild(fire);
      fires.push(fire);
    }
    return { container, ship, fires };
  }

  private fitSprite(sprite: Sprite, maxSize: number): number {
    const w = sprite.texture.width || 1;
    const h = sprite.texture.height || 1;
    const scale = maxSize / Math.max(w, h);
    sprite.scale.set(scale);
    return scale;
  }

  private applyScale(s: Sprite, targetW: number, targetH: number) {
    const w = s.texture.width || 1;
    const h = s.texture.height || 1;
    s.scale.set(targetW / w, targetH / h);
  }

  private spawnPlayer() {
    const spawn = { x: this.arenaW / 2, y: this.arenaH - 80 };
    const shipIndex = SHIP_INDEX.playerHealthy;
    const container = new Container();
    const ship = new Sprite(this.textures.ships[shipIndex]);
    ship.anchor.set(0.5);
    this.fitSprite(ship, C.player.radius * 2.6);
    container.addChild(ship);
    container.x = spawn.x;
    container.y = spawn.y;
    this.world.addChild(container);

    this.player = {
      id: 1, gfx: container, ship, fires: [],
      x: container.x, y: container.y, radius: C.player.radius,
      hp: C.player.hp, maxHp: C.player.hp,
      rotation: 0,
      frontTimer: 0, sideTimer: 0,
      chargeFront: 0, chargeLeft: 0, chargeRight: 0,
      alive: true, shipIndex,
    };

    this.ensureAimGfx('player-1');
  }

  private spawnTurret(islandIndex: number, cornerIndex: number, x: number, y: number) {
    const container = new Container();
    const r = C.turret.radius;

    const platform = new Sprite(this.textures.tileCannonPlatform);
    platform.anchor.set(0.5);
    this.fitSprite(platform, r * 2.2);
    container.addChild(platform);

    const cannon = new Sprite(this.textures.cannon);
    cannon.anchor.set(0.1, 0.5);
    this.fitSprite(cannon, r * 1.15);
    container.addChild(cannon);

    container.x = x;
    container.y = y;
    this.world.addChild(container);

    const key = `turret-${islandIndex}-${cornerIndex}`;
    this.turrets.push({
      gfx: container, x, y, radius: r,
      hp: C.turret.hp, maxHp: C.turret.hp, alive: true,
      aimDirection: 0,
      attackTimer: Math.random() * C.turret.attackCooldown,
      islandIndex, cornerIndex, key,
    });

    const bar = new HealthBar({
      frame: this.textures.healthFrame,
      green: this.textures.healthFillGreen,
      amber: this.textures.healthFillAmber,
      red: this.textures.healthFillRed,
      targetWidth: C.healthBar.turretWidth,
      greenThreshold: C.healthBar.greenThreshold,
      amberThreshold: C.healthBar.amberThreshold,
    });
    bar.setPosition(x, y - r - C.healthBar.turretYOffset);
    this.world.addChild(bar.container);
    this.turretBars.set(key, bar);

    this.ensureAimGfx(key);
  }

  private spawnEnemy() {
    const kind = Math.random() < 0.55 ? 'chaser' : 'shooter';
    const spec = kind === 'chaser' ? C.chaser : C.shooter;
    const shipIndex = kind === 'chaser' ? SHIP_INDEX.chaserShip : SHIP_INDEX.shooterShip;

    let x = 0, y = 0, found = false;
    for (let i = 0; i < C.spawn.maxAttempts; i++) {
      x = 40 + Math.random() * Math.max(40, this.arenaW - 80);
      y = 40 + Math.random() * Math.max(40, this.arenaH - 80);
      if (this.minDistanceToPlayer(x, y) < C.spawn.minDistanceFromPlayer) continue;
      if (this.isInsideAnyIsland(x, y, spec.radius + 10)) continue;
      found = true; break;
    }
    if (!found) return;

    const { container, ship, fires } = this.buildShipContainer(shipIndex, spec.radius);
    container.x = x; container.y = y;
    this.world.addChild(container);

    const key = `enemy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const enemy: Enemy = {
      key, gfx: container, ship, fires,
      x, y, radius: spec.radius,
      hp: spec.hp, maxHp: spec.hp, alive: true,
      kind, rotation: 0, speed: spec.speed,
      attackTimer: Math.random() * C.shooter.attackCooldown,
      aimDirection: 0,
      shipIndex,
    };
    this.enemies.push(enemy);

    const bar = new HealthBar({
      frame: this.textures.healthFrame,
      green: this.textures.healthFillGreen,
      amber: this.textures.healthFillAmber,
      red: this.textures.healthFillRed,
      targetWidth: C.healthBar.enemyWidth,
      greenThreshold: C.healthBar.greenThreshold,
      amberThreshold: C.healthBar.amberThreshold,
    });
    bar.setPosition(x, y - spec.radius - C.healthBar.enemyYOffset);
    this.world.addChild(bar.container);
    this.enemyBars.set(key, bar);

    this.ensureAimGfx(key);
  }

  // ---------- HUD ----------

  private createHud() {
    const m = C.healthBar.hudMargin;
    const barW = C.healthBar.hudWidth;

    const left = new Container();
    left.x = m;
    left.y = m;
    this.hudLayer.addChild(left);

    this.playerBar = new HealthBar({
      frame: this.textures.healthFrame,
      green: this.textures.enemyHealthFillGreen,
      amber: this.textures.enemyHealthFillGreen,
      red: this.textures.enemyHealthFillRed,
      targetWidth: barW,
      greenThreshold: C.healthBar.playerRedThreshold,
      amberThreshold: C.healthBar.playerRedThreshold - 0.001,
      hideOnZero: true,
    });
    this.playerBar.setPosition(barW / 2, C.healthBar.hudHeight / 2);
    left.addChild(this.playerBar.container);

    // ícone de coração removido

    this.playerHpText = new Text({ text: '100', style: HUD_STYLE });
    this.playerHpText.anchor.set(0, 0.5);
    this.playerHpText.x = barW + 8;
    this.playerHpText.y = C.healthBar.hudHeight / 2;
    this.playerHpText.style.fill = 0x35e06b;
    left.addChild(this.playerHpText);

    this.scoreText = new Text({ text: 'Score: 0', style: HUD_STYLE });
    this.scoreText.anchor.set(0, 0);
    this.scoreText.x = m;
    this.scoreText.y = m + C.healthBar.hudHeight + 6;
    this.hudLayer.addChild(this.scoreText);

    const panelH = 44;
    const panelW = 110;
    const gap = 6;
    const iconSize = 34;
    const totalW = iconSize + gap + panelW;
    const startX = this.arenaW / 2 - totalW / 2;

    const icon = new Sprite(this.textures.iconTime);
    icon.anchor.set(0.5);
    this.applyScale(icon, iconSize, iconSize);
    icon.x = startX + iconSize / 2;
    icon.y = m + panelH / 2;
    this.hudLayer.addChild(icon);

    const panel = new Sprite(this.textures.buttonPrimaryDisabled);
    panel.anchor.set(0.5);
    this.applyScale(panel, panelW, panelH);
    panel.x = startX + iconSize + gap + panelW / 2;
    panel.y = m + panelH / 2;
    this.hudLayer.addChild(panel);

    this.timeText = new Text({ text: String(Math.ceil(this.snapshot.timeLeft)), style: TIMER_STYLE });
    this.timeText.anchor.set(0.5);
    this.timeText.x = panel.x;
    this.timeText.y = panel.y;
    this.hudLayer.addChild(this.timeText);

    this.createPauseButton();
  }

  private createPauseButton() {
    const m = C.healthBar.hudMargin;
    const size = 48;
    const c = new Container();
    c.x = this.arenaW - m - size / 2;
    c.y = m + size / 2;
    this.hudLayer.addChild(c);
    this.pauseButton = c;

    const bg = new Sprite(this.textures.buttonRoundNormal);
    bg.anchor.set(0.5);
    this.applyScale(bg, size, size);
    c.addChild(bg);

    const icon = new Sprite(this.textures.iconPause);
    icon.anchor.set(0.5);
    this.applyScale(icon, size * 0.45, size * 0.45);
    c.addChild(icon);

    bg.eventMode = 'static';
    bg.cursor = 'pointer';
    bg.on('pointerover', () => { bg.texture = this.textures.buttonRoundHover; this.applyScale(bg, size, size); });
    bg.on('pointerout',  () => { bg.texture = this.textures.buttonRoundNormal; this.applyScale(bg, size, size); });
    bg.on('pointerdown', () => { this.applyScale(bg, size * 0.94, size * 0.94); });
    bg.on('pointerup',   () => {
      bg.texture = this.textures.buttonRoundHover;
      this.applyScale(bg, size, size);
      if (this.menuMode === null && !this.ended) this.openMenu('pause');
    });
    bg.on('pointerupoutside', () => { bg.texture = this.textures.buttonRoundNormal; this.applyScale(bg, size, size); });
  }

  private updateHud() {
    if (this.player && this.playerBar && this.playerHpText) {
      const ratio = this.player.hp / this.player.maxHp;
      this.playerBar.setRatio(ratio);
      this.playerHpText.text = String(this.player.hp);
      this.playerHpText.style.fill = ratio > C.healthBar.playerRedThreshold ? 0x35e06b : 0xff4040;
      this.playerHpText.visible = ratio > 0;
    }
    if (this.scoreText) this.scoreText.text = `Score: ${this.snapshot.score}`;
    if (this.timeText) this.timeText.text = String(Math.max(0, Math.ceil(this.snapshot.timeLeft)));
  }

  // ---------- Menu ----------

  private openMenu(mode: 'pause' | 'death') {
    if (this.pauseMenu) return;
    this.menuMode = mode;
    this.snapshot.paused = true;
    if (this.pauseButton) this.pauseButton.visible = false;

    const layer = new Container();
    this.pauseMenu = layer;
    this.menuLayer.addChild(layer);

    const overlay = new Graphics();
    overlay.rect(0, 0, this.arenaW, this.arenaH).fill({ color: 0x000000, alpha: 0.55 });
    overlay.eventMode = 'static';
    overlay.hitArea = new Rectangle(0, 0, this.arenaW, this.arenaH);
    layer.addChild(overlay);

    const cx = this.arenaW / 2;
    const cy = this.arenaH / 2;

    const panelW = 380;
    const panelH = mode === 'pause' ? 380 : 320;

    const panel = new Sprite(this.textures.panelMenu);
    panel.anchor.set(0.5);
    this.applyScale(panel, panelW, panelH);
    panel.x = cx;
    panel.y = cy;
    layer.addChild(panel);

    const title = new Text({
      text: mode === 'pause' ? 'PAUSED' : 'GAME OVER',
      style: MENU_TITLE_STYLE,
    });
    title.anchor.set(0.5);
    title.x = cx;
    title.y = cy - panelH / 2 + 52;
    layer.addChild(title);

    const buttons: { label: string; icon: Texture; onClick: () => void }[] = [];
    if (mode === 'pause') {
      buttons.push({
        label: 'Resume',
        icon: this.textures.iconPlay,
        onClick: () => this.closeMenu(),
      });
    }
    buttons.push({
      label: 'Restart',
      icon: this.textures.iconRestart,
      onClick: () => { this.closeMenu(); this.onRestart(); },
    });
    buttons.push({
      label: 'Main Menu',
      icon: this.textures.iconHome,
      onClick: () => { this.closeMenu(); this.onQuit(); },
    });

    const btnW = 260;
    const btnH = 54;
    const gap = 14;
    const totalH = buttons.length * btnH + (buttons.length - 1) * gap;
    const startY = cy - totalH / 2 + 24 + btnH / 2;

    buttons.forEach((b, i) => {
      const y = startY + i * (btnH + gap);
      const btn = this.makeMenuButton({
        x: cx, y,
        width: btnW, height: btnH,
        label: b.label, icon: b.icon, onClick: b.onClick,
      });
      layer.addChild(btn);
    });
  }

  private makeMenuButton(opts: {
    x: number; y: number;
    width: number; height: number;
    label: string;
    icon: Texture;
    onClick: () => void;
  }): Container {
    const c = new Container();
    c.x = opts.x;
    c.y = opts.y;

    const bg = new Sprite(this.textures.buttonPrimaryNormal);
    bg.anchor.set(0.5);
    this.applyScale(bg, opts.width, opts.height);
    c.addChild(bg);

    const iconSize = opts.height * 0.5;
    const icon = new Sprite(opts.icon);
    icon.anchor.set(0.5);
    this.applyScale(icon, iconSize, iconSize);
    icon.x = -opts.width / 2 + opts.height * 0.7;
    c.addChild(icon);

    const txt = new Text({ text: opts.label, style: MENU_BUTTON_STYLE });
    txt.anchor.set(0.5);
    txt.x = opts.height * 0.2;
    c.addChild(txt);

    const setTex = (tex: Texture) => {
      bg.texture = tex;
      this.applyScale(bg, opts.width, opts.height);
    };

    bg.eventMode = 'static';
    bg.cursor = 'pointer';
    bg.on('pointerover', () => setTex(this.textures.buttonPrimaryHover));
    bg.on('pointerout',  () => setTex(this.textures.buttonPrimaryNormal));
    bg.on('pointerdown', () => setTex(this.textures.buttonPrimaryPressed));
    bg.on('pointerup',   () => { setTex(this.textures.buttonPrimaryHover); opts.onClick(); });
    bg.on('pointerupoutside', () => setTex(this.textures.buttonPrimaryNormal));

    return c;
  }

  private closeMenu() {
    if (!this.pauseMenu) return;
    this.pauseMenu.destroy({ children: true });
    this.pauseMenu = null;
    this.menuMode = null;
    this.snapshot.paused = false;
    if (this.pauseButton) this.pauseButton.visible = true;
  }

  // ---------- Projectiles ----------

  private spawnProjectile(
    owner: Projectile['owner'],
    ownerId: PlayerId | null,
    x: number, y: number,
    rotation: number, range: number, flightTime: number,
    damageOverride?: number,
  ) {
    const speed = range / flightTime;
    const container = new Container();
    const ball = new Sprite(this.textures.cannonBall);
    ball.anchor.set(0.5);
    this.fitSprite(ball, C.projectile.radius * 2.2);
    container.addChild(ball);
    container.x = x; container.y = y;
    this.world.addChild(container);

    this.projectiles.push({
      gfx: container, x, y,
      vx: Math.cos(rotation) * speed,
      vy: Math.sin(rotation) * speed,
      radius: C.projectile.radius,
      damage: damageOverride ?? (owner === 'player' ? C.projectile.damage : C.projectile.enemyDamage),
      owner, ownerId,
      traveled: 0, range, flightTime, alive: true,
    });
  }

  private firePlayerWeapon(p: Player, slot: 'front' | 'left' | 'right') {
    const charge = slot === 'front' ? p.chargeFront : slot === 'left' ? p.chargeLeft : p.chargeRight;
    const clamped = Math.max(0, Math.min(1, charge));
    const range = C.projectile.minRange + (C.projectile.maxRange - C.projectile.minRange) * clamped;
    const baseDir = p.rotation - Math.PI / 2;
    const muzzle = p.radius * C.player.muzzleOffset;

    if (slot === 'front') {
      this.spawnProjectile('player', p.id,
        p.x + Math.cos(baseDir) * muzzle,
        p.y + Math.sin(baseDir) * muzzle,
        baseDir, range, C.projectile.playerFlightTime);
    } else {
      const side = slot === 'left' ? -1 : 1;
      const dir = baseDir + side * (Math.PI / 2);
      const sideX = Math.cos(p.rotation) * side;
      const sideY = Math.sin(p.rotation) * side;
      for (let i = -1; i <= 1; i++) {
        const perpX = Math.cos(p.rotation);
        const perpY = Math.sin(p.rotation);
        const ox = sideX * muzzle + perpX * i * 10;
        const oy = sideY * muzzle + perpY * i * 10;
        this.spawnProjectile('player', p.id, p.x + ox, p.y + oy, dir, range, C.projectile.playerFlightTime);
      }
    }
  }

  // ---------- Update loop ----------

  private update = () => {
    if (this.destroyed) return;
    if (this.ended) return;
    if (this.menuMode !== null) return;
    if (!this.snapshot.running || this.snapshot.paused) return;

    const dt = this.app.ticker.deltaMS / 1000;
    this.elapsed += dt;

    this.snapshot.timeLeft -= dt;
    if (this.snapshot.timeLeft <= 0) {
      this.snapshot.timeLeft = 0;
      this.end('time');
      return;
    }

    this.updateScheduled(dt);
    if (this.player) {
      this.updatePlayer(this.player, dt);
      this.updatePlayerShipSprite(this.player);
      this.updateShipFires(this.player);
    }
    this.updateEnemies(dt);
    this.updateTurrets(dt);
    this.updateProjectiles(dt);
    this.updateWrecks(dt);
    this.updateSpawns(dt);
    this.updateEnemyBars();
    this.updateAimPreviews();
    this.updateHud();
  };

  private schedule(delay: number, action: () => void) {
    this.scheduled.push({ delay, action, done: false });
  }
  private updateScheduled(dt: number) {
    for (const s of this.scheduled) {
      if (s.done) continue;
      s.delay -= dt;
      if (s.delay <= 0) { s.done = true; s.action(); }
    }
    this.scheduled = this.scheduled.filter(s => !s.done);
  }

  private updatePlayer(p: Player, dt: number) {
    if (!p.alive) return;
    const k = this.keys;

    const left  = k['a'] || k['A'];
    const right = k['d'] || k['D'];
    const fwd   = k['w'] || k['W'];
    const back  = k['s'] || k['S'];

    if (left)  p.rotation -= C.player.rotationSpeed * dt;
    if (right) p.rotation += C.player.rotationSpeed * dt;
    if (fwd) {
      const dir = p.rotation - Math.PI / 2;
      p.x += Math.cos(dir) * C.player.speed * dt;
      p.y += Math.sin(dir) * C.player.speed * dt;
    }
    if (back) {
      const dir = p.rotation - Math.PI / 2;
      p.x -= Math.cos(dir) * C.player.speed * 0.6 * dt;
      p.y -= Math.sin(dir) * C.player.speed * 0.6 * dt;
    }

    p.x = Math.max(p.radius, Math.min(this.arenaW - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(this.arenaH - p.radius, p.y));
    this.resolveIslandCollisionEntity(p);

    p.frontTimer -= dt;
    p.sideTimer -= dt;

    const frontKey = k[' '];
    const leftKey  = k['q'] || k['Q'];
    const rightKey = k['e'] || k['E'];
    const chargeStep = dt / C.charge.maxTime;

    if (frontKey) p.chargeFront = Math.min(1, p.chargeFront + chargeStep);
    else if (p.chargeFront > 0) {
      if (p.frontTimer <= 0) { p.frontTimer = C.player.frontCooldown; this.firePlayerWeapon(p, 'front'); }
      p.chargeFront = 0;
    }
    if (leftKey) p.chargeLeft = Math.min(1, p.chargeLeft + chargeStep);
    else if (p.chargeLeft > 0) {
      if (p.sideTimer <= 0) { p.sideTimer = C.player.sideCooldown; this.firePlayerWeapon(p, 'left'); }
      p.chargeLeft = 0;
    }
    if (rightKey) p.chargeRight = Math.min(1, p.chargeRight + chargeStep);
    else if (p.chargeRight > 0) {
      if (p.sideTimer <= 0) { p.sideTimer = C.player.sideCooldown; this.firePlayerWeapon(p, 'right'); }
      p.chargeRight = 0;
    }

    p.gfx.x = p.x; p.gfx.y = p.y; p.gfx.rotation = p.rotation;
  }

  private updatePlayerShipSprite(p: Player) {
    if (!p.alive) return;
    const ratio = p.hp / p.maxHp;
    let target: number;
    if (ratio > 0.5)       target = SHIP_INDEX.playerHealthy;
    else if (ratio > 0.15) target = SHIP_INDEX.playerDamaged;
    else                   target = SHIP_INDEX.playerCritical;

    if (p.shipIndex !== target) {
      p.shipIndex = target;
      p.ship.texture = this.textures.ships[target];
      this.fitSprite(p.ship, C.player.radius * 2.6);
    }
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const target = this.player && this.player.alive ? this.player : null;

      if (target) {
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (e.kind === 'chaser') {
          e.aimDirection = Math.atan2(dy, dx);
          e.x += (dx / dist) * e.speed * dt;
          e.y += (dy / dist) * e.speed * dt;
        } else {
          if (dist > C.shooter.attackRange * 0.8) {
            e.x += (dx / dist) * e.speed * dt;
            e.y += (dy / dist) * e.speed * dt;
          }
          e.attackTimer -= dt;
          if (dist <= C.shooter.attackRange) {
            e.aimDirection = Math.atan2(dy, dx);
            if (e.attackTimer <= 0) {
              e.attackTimer = C.shooter.attackCooldown + Math.random() * C.shooter.cooldownJitter;
              this.spawnProjectile('enemy', null,
                e.x + Math.cos(e.aimDirection) * (e.radius + 4),
                e.y + Math.sin(e.aimDirection) * (e.radius + 4),
                e.aimDirection, dist, C.projectile.enemyFlightTime);
            }
          } else {
            if (e.attackTimer < 0) e.attackTimer = 0;
          }
        }
      }

      e.x = Math.max(e.radius, Math.min(this.arenaW - e.radius, e.x));
      e.y = Math.max(e.radius, Math.min(this.arenaH - e.radius, e.y));
      this.resolveIslandCollisionEntity(e);

      // Contato com o player: chaser e shooter morrem ao encostar
      if (target && Math.hypot(e.x - target.x, e.y - target.y) < e.radius + target.radius) {
        const dmg = e.kind === 'chaser' ? C.chaser.contactDamage : C.shooter.contactDamage;
        this.spawnExplosion(e.x, e.y, 'small');
        this.destroyEnemy(e, false);
        this.damagePlayer(target, dmg);
      }

      if (e.alive) {
        e.rotation = e.aimDirection + Math.PI / 2;
        e.gfx.x = e.x; e.gfx.y = e.y;
        e.gfx.rotation = e.rotation;
      }
    }
  }

  private updateTurrets(dt: number) {
    for (const t of this.turrets) {
      if (!t.alive) continue;
      const target = this.player && this.player.alive ? this.player : null;
      if (!target) continue;
      const dx = target.x - t.x;
      const dy = target.y - t.y;
      const dist = Math.hypot(dx, dy) || 1;

      t.attackTimer -= dt;

      if (dist <= C.turret.range) {
        t.aimDirection = Math.atan2(dy, dx);
        if (t.attackTimer <= 0) {
          t.attackTimer = C.turret.attackCooldown + Math.random() * C.turret.cooldownJitter;
          this.spawnProjectile('enemy', null,
            t.x + Math.cos(t.aimDirection) * (t.radius + 4),
            t.y + Math.sin(t.aimDirection) * (t.radius + 4),
            t.aimDirection, dist, C.projectile.enemyFlightTime,
            C.turret.projectileDamage);
        }
      } else {
        if (t.attackTimer < 0) t.attackTimer = 0;
      }
      t.gfx.rotation = t.aimDirection;
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.alive) continue;

      const step = Math.hypot(p.vx, p.vy) * dt;
      p.traveled += step;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.gfx.x = p.x;
      p.gfx.y = p.y;

      const t = Math.max(0, Math.min(1, p.traveled / p.range));
      const arc = Math.sin(t * Math.PI);
      p.gfx.scale.set(1 + arc * C.projectile.arcScale);

      if (p.traveled >= p.range) {
        this.onProjectileLand(p);
        p.alive = false;
        p.gfx.destroy();
        continue;
      }

      if (p.x < -80 || p.y < -80 || p.x > this.arenaW + 80 || p.y > this.arenaH + 80) {
        p.alive = false;
        p.gfx.destroy();
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);
  }

  private onProjectileLand(p: Projectile) {
    const r = C.projectile.landingRadius;

    if (p.owner === 'player') {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) <= e.radius + r) {
          this.spawnExplosion(p.x, p.y, 'small');
          this.damageEnemy(e, p.damage);
          return;
        }
      }
      for (const t of this.turrets) {
        if (!t.alive) continue;
        if (Math.hypot(p.x - t.x, p.y - t.y) <= t.radius + r) {
          this.spawnExplosion(p.x, p.y, 'small');
          this.damageTurret(t, p.damage);
          return;
        }
      }
    } else {
      const pl = this.player;
      if (pl && pl.alive && Math.hypot(p.x - pl.x, p.y - pl.y) <= pl.radius + r) {
        this.spawnExplosion(p.x, p.y, 'small');
        this.damagePlayer(pl, p.damage);
      }
    }
  }

  private updateWrecks(dt: number) {
    for (const w of this.wrecks) {
      if (w.dead) continue;
      w.elapsed += dt;
      const t = Math.min(1, w.elapsed / w.maxLife);
      w.sprite.x += w.vx * dt;
      w.sprite.y += w.vy * dt;
      const s = w.baseScale * (w.scaleFrom + (w.scaleTo - w.scaleFrom) * t);
      w.sprite.scale.set(s);
      w.sprite.alpha = 1 - t * 0.65;
      if (t >= 1) { w.dead = true; w.sprite.destroy(); }
    }
    this.wrecks = this.wrecks.filter(w => !w.dead);
  }

  private updateSpawns(dt: number) {
    const interval = Math.max(
      C.spawn.minInterval,
      C.spawn.baseInterval - this.elapsed * C.spawn.accelPerSec
    );
    this.spawnAccumulator += dt;
    if (this.spawnAccumulator >= interval) {
      this.spawnAccumulator = 0;
      this.spawnEnemy();
    }
  }

  private updateEnemyBars() {
    for (const e of this.enemies) {
      const bar = this.enemyBars.get(e.key);
      if (!bar) continue;
      bar.setPosition(e.x, e.y - e.radius - C.healthBar.enemyYOffset);
      bar.setRatio(e.hp / e.maxHp);
    }
    for (const t of this.turrets) {
      const bar = this.turretBars.get(t.key);
      if (!bar) continue;
      bar.setPosition(t.x, t.y - t.radius - C.healthBar.turretYOffset);
      bar.setRatio(t.hp / t.maxHp);
    }
  }

  // ---------- Damage / death ----------

  private damageEnemy(e: Enemy, dmg: number) {
    e.hp = Math.max(0, e.hp - dmg);
    if (e.hp <= 0 && e.alive) {
      this.snapshot.score += 1;
      this.destroyEnemy(e, true);
    }
  }

  private damageTurret(t: Turret, dmg: number) {
    t.hp = Math.max(0, t.hp - dmg);
    if (t.hp <= 0 && t.alive) {
      t.alive = false;
      this.snapshot.score += 1;
      this.turretBars.get(t.key)?.destroy();
      this.turretBars.delete(t.key);
      this.aimGfx.get(t.key)?.destroy();
      this.aimGfx.delete(t.key);
      t.gfx.destroy();
    }
  }

  private damagePlayer(p: Player, dmg: number) {
    p.hp = Math.max(0, p.hp - dmg);
    const snap = this.snapshot.players.find(s => s.id === p.id);
    if (snap) snap.hp = p.hp;
    if (p.hp <= 0 && p.alive) {
      p.alive = false;
      this.spawnPlayerWreck(p);
      this.die();
    }
  }

  private destroyEnemy(e: Enemy, byPlayer: boolean) {
    if (!e.alive) return;
    e.alive = false;

    this.enemyBars.get(e.key)?.destroy();
    this.enemyBars.delete(e.key);
    this.aimGfx.get(e.key)?.destroy();
    this.aimGfx.delete(e.key);

    const { x, y } = e;
    const finalRotation = e.rotation;
    const baseSize = e.radius * 2.6;

    const wreckIndex = e.kind === 'chaser' ? SHIP_INDEX.chaserWreck : SHIP_INDEX.shooterWreck;
    const rotationOffset = e.kind === 'chaser'
      ? SHIP_ROTATION_OFFSET.chaserWreck
      : SHIP_ROTATION_OFFSET.shooterWreck;

    e.ship.destroy();
    e.fires.forEach(f => f.destroy());
    e.gfx.destroy();

    if (!byPlayer) return;

    const med = new Sprite(this.textures.explosionMedium);
    med.anchor.set(0.5); med.x = x; med.y = y;
    this.fitSprite(med, baseSize * 1.0);
    this.world.addChild(med);

    this.schedule(C.destruction.mediumExplosionDuration, () => {
      med.destroy();
      const lg = new Sprite(this.textures.explosionLarge);
      lg.anchor.set(0.5); lg.x = x; lg.y = y;
      this.fitSprite(lg, baseSize * 1.3);
      this.world.addChild(lg);

      this.schedule(C.destruction.largeExplosionDuration, () => {
        lg.destroy();
        const wreck = new Sprite(this.textures.ships[wreckIndex]);
        wreck.anchor.set(0.5);
        wreck.x = x; wreck.y = y;
        wreck.rotation = finalRotation + rotationOffset;
        const baseScale = this.fitSprite(wreck, baseSize);
        this.world.addChild(wreck);

        this.wrecks.push({
          sprite: wreck,
          vx: C.destruction.wreckDriftX,
          vy: C.destruction.wreckDriftY,
          baseScale,
          scaleFrom: 1,
          scaleTo: C.destruction.wreckScaleTo,
          elapsed: 0,
          maxLife: C.destruction.wreckDuration,
          dead: false,
        });
      });
    });
  }

  private spawnPlayerWreck(p: Player) {
    const x = p.x, y = p.y;
    const finalRotation = p.rotation;
    p.ship.visible = false;

    const wreck = new Sprite(this.textures.ships[SHIP_INDEX.playerWreck]);
    wreck.anchor.set(0.5);
    wreck.x = x; wreck.y = y;
    wreck.rotation = finalRotation + SHIP_ROTATION_OFFSET.playerWreck;
    const baseScale = this.fitSprite(wreck, p.radius * 2.6);
    this.world.addChild(wreck);

    this.wrecks.push({
      sprite: wreck,
      vx: C.destruction.wreckDriftX,
      vy: C.destruction.wreckDriftY,
      baseScale,
      scaleFrom: 1,
      scaleTo: C.destruction.wreckScaleTo,
      elapsed: 0,
      maxLife: C.destruction.wreckDuration,
      dead: false,
    });
  }

  private spawnExplosion(x: number, y: number, kind: 'small' | 'medium' | 'large') {
    const tex = kind === 'small' ? this.textures.explosionSmall
             : kind === 'medium' ? this.textures.explosionMedium
             : this.textures.explosionLarge;
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5); sprite.x = x; sprite.y = y;
    this.fitSprite(sprite, 30);
    this.world.addChild(sprite);
    const life = kind === 'small' ? 0.18 : kind === 'medium' ? 0.25 : 0.35;
    this.schedule(life, () => sprite.destroy());
  }

  // ---------- Fires ----------

  private updateShipFires(entity: Entity) {
    if (!entity.alive) return;
    if (entity.fires.length === 0) return;
    const ratio = entity.hp / entity.maxHp;
    let fires = 0;
    for (const t of C.damageStates) {
      if (ratio <= t.maxHpRatio) fires = Math.max(fires, t.fires);
    }
    for (let i = 0; i < entity.fires.length; i++) {
      entity.fires[i].visible = i < fires;
    }
  }

  // ---------- Aim previews ----------

  private ensureAimGfx(key: string) {
    if (this.aimGfx.has(key)) return this.aimGfx.get(key)!;
    const g = new Graphics();
    this.world.addChild(g);
    this.aimGfx.set(key, g);
    return g;
  }

  private projectileLandingPoint(p: Projectile): { x: number; y: number } {
    const speed = Math.hypot(p.vx, p.vy) || 1;
    const remaining = Math.max(0, (p.range - p.traveled) / speed);
    return { x: p.x + p.vx * remaining, y: p.y + p.vy * remaining };
  }

  private updateAimPreviews() {
    this.projectileAimGfx.clear();
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      const { x, y } = this.projectileLandingPoint(p);
      const color = p.owner === 'player' ? C.aim.lineColor : C.aim.lineColorEnemy;
      this.drawAimMarker(this.projectileAimGfx, x, y, color);
    }

    if (this.player) {
      const p = this.player;
      const g = this.aimGfx.get('player-1');
      if (g) {
        g.clear();
        if (p.alive) {
          const baseDir = p.rotation - Math.PI / 2;
          if (p.chargeFront > 0) {
            const range = C.projectile.minRange + (C.projectile.maxRange - C.projectile.minRange) * Math.min(1, p.chargeFront);
            this.drawAimMarker(g, p.x + Math.cos(baseDir) * range, p.y + Math.sin(baseDir) * range, C.aim.lineColor);
          }
          if (p.chargeLeft > 0) {
            const range = C.projectile.minRange + (C.projectile.maxRange - C.projectile.minRange) * Math.min(1, p.chargeLeft);
            const d = baseDir - Math.PI / 2;
            this.drawAimMarker(g, p.x + Math.cos(d) * range, p.y + Math.sin(d) * range, C.aim.lineColor);
          }
          if (p.chargeRight > 0) {
            const range = C.projectile.minRange + (C.projectile.maxRange - C.projectile.minRange) * Math.min(1, p.chargeRight);
            const d = baseDir + Math.PI / 2;
            this.drawAimMarker(g, p.x + Math.cos(d) * range, p.y + Math.sin(d) * range, C.aim.lineColor);
          }
        }
      }
    }

    for (const e of this.enemies) {
      const g = this.aimGfx.get(e.key);
      if (!g) continue;
      g.clear();
      if (!e.alive || e.kind !== 'shooter') continue;
      const target = this.player && this.player.alive ? this.player : null;
      if (!target) continue;
      const dist = Math.hypot(target.x - e.x, target.y - e.y);
      if (dist > C.shooter.attackRange) continue;
      if (e.attackTimer > C.shooter.aimDuration || e.attackTimer <= 0) continue;
      const progress = 1 - e.attackTimer / C.shooter.aimDuration;
      const range = dist * progress;
      this.drawAimMarker(g,
        e.x + Math.cos(e.aimDirection) * range,
        e.y + Math.sin(e.aimDirection) * range,
        C.aim.lineColorEnemy);
    }

    for (const t of this.turrets) {
      const g = this.aimGfx.get(t.key);
      if (!g) continue;
      g.clear();
      if (!t.alive) continue;
      const target = this.player && this.player.alive ? this.player : null;
      if (!target) continue;
      const dist = Math.hypot(target.x - t.x, target.y - t.y);
      if (dist > C.turret.range) continue;
      if (t.attackTimer > C.turret.aimDuration || t.attackTimer <= 0) continue;
      const progress = 1 - t.attackTimer / C.turret.aimDuration;
      const range = dist * progress;
      this.drawAimMarker(g,
        t.x + Math.cos(t.aimDirection) * range,
        t.y + Math.sin(t.aimDirection) * range,
        C.aim.lineColorEnemy);
    }
  }

  private drawAimMarker(g: Graphics, x: number, y: number, color: number) {
    g.circle(x, y, C.aim.markerRadius).stroke({ width: 2, color, alpha: 0.95 });
    g.circle(x, y, 2).fill({ color, alpha: 1 });
  }

  // ---------- Helpers ----------

  private minDistanceToPlayer(x: number, y: number): number {
    if (!this.player || !this.player.alive) return 0;
    return Math.hypot(x - this.player.x, y - this.player.y);
  }

  private resolveIslandCollisionEntity(e: { x: number; y: number; radius: number }) {
    for (const isl of this.islands) {
      const nx = Math.max(isl.x, Math.min(isl.x + isl.w, e.x));
      const ny = Math.max(isl.y, Math.min(isl.y + isl.h, e.y));
      const dx = e.x - nx, dy = e.y - ny;
      const d = Math.hypot(dx, dy);
      if (d < e.radius) {
        if (d === 0) {
          const left = e.x - isl.x, right = isl.x + isl.w - e.x;
          const top = e.y - isl.y, bottom = isl.y + isl.h - e.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) e.x = isl.x - e.radius;
          else if (m === right) e.x = isl.x + isl.w + e.radius;
          else if (m === top) e.y = isl.y - e.radius;
          else e.y = isl.y + isl.h + e.radius;
        } else {
          const push = (e.radius - d) / d;
          e.x += dx * push; e.y += dy * push;
        }
      }
    }
  }

  private isInsideAnyIsland(x: number, y: number, padding: number): boolean {
    return this.islands.some(i =>
      x >= i.x - padding && x <= i.x + i.w + padding &&
      y >= i.y - padding && y <= i.y + i.h + padding);
  }

  private end(reason: 'time' | 'death') {
    if (this.ended) return;
    this.ended = true;
    this.snapshot.ended = true;
    this.snapshot.running = false;
    this.snapshot.endReason = reason;
    this.onEnd(this.getSnapshot());
  }

  private die() {
    if (this.ended) return;
    this.end('death');
  }
}