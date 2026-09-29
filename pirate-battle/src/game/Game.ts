import {
  Application, Container, Graphics, Sprite, Text, TextStyle, Texture, TilingSprite,
} from 'pixi.js';
import { GAME_CONFIG as C, ISLANDS, SHIP_INDEX } from './config';
import type {
  Enemy, Entity, GameSnapshot, Player, PlayerId,
  Projectile, Rect, RunConfig, Turret,
} from './types';

type OnEnd = (snapshot: GameSnapshot) => void;

const HP_STYLE = new TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 2 },
});

const FIRE_OFFSETS = [
  { x: -0.45, y: -0.15 },
  { x:  0.45, y:  0.15 },
  { x:  0.05, y:  0.50 },
  { x: -0.15, y: -0.55 },
];

interface Scheduled { delay: number; action: () => void; done: boolean; }

interface Wreck {
  sprite: Sprite;
  vx: number;
  vy: number;
  baseScale: number;
  scaleFrom: number;
  scaleTo: number;
  elapsed: number;
  maxLife: number;
  dead: boolean;
}

export class Game {
  private app: Application;
  private world: Container;
  private host: HTMLElement;
  private onEnd: OnEnd;

  private textures: {
    explosionLarge: Texture; explosionMedium: Texture; explosionSmall: Texture;
    fireLarge: Texture; fireSmall: Texture;
    cannonBall: Texture; ships: Texture[];
    tileCannonPlatform: Texture; cannon: Texture; tileWater: Texture;
  };

  private player: Player | null = null;
  private enemies: Enemy[] = [];
  private turrets: Turret[] = [];
  private projectiles: Projectile[] = [];
  private islands: Rect[] = [];
  private wrecks: Wreck[] = [];

  private aimGfx = new Map<string, Graphics>();
  private projectileAimGfx: Graphics;
  private hpTexts = new Map<string, Text>();

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
  ) {
    this.host = host;
    this.runConfig = runConfig;
    this.textures = textures;
    this.onEnd = onEnd;
    this.app = new Application();
    this.world = new Container();
    this.projectileAimGfx = new Graphics();

    this.snapshot = {
      score: 0,
      players: [{ id: 1, hp: C.player.hp, maxHp: C.player.hp }],
      timeLeft: runConfig.sessionTime,
      running: true, paused: false, ended: false, endReason: null,
    };
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
    this.app.stage.addChild(this.world);

    this.drawWater();
    this.spawnIslandsAndTurrets();
    this.spawnPlayer();

    this.world.addChild(this.projectileAimGfx);

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
    if (this.snapshot.ended) return;
    const next = !this.snapshot.paused;
    this.snapshot.paused = next;
    if (next) this.keys = {};
  }

  // ---------- Input ----------

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.key] = true;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys[e.key] = false; };
  private onBlur = () => { if (!this.snapshot.ended) this.snapshot.paused = true; };
  private onVisibility = () => {
    if (document.hidden && !this.snapshot.ended) this.snapshot.paused = true;
  };

  // ---------- Setup ----------

  private drawWater() {
    const bg = new TilingSprite({
      texture: this.textures.tileWater,
      width: C.arena.width,
      height: C.arena.height,
    });
    this.world.addChild(bg);

    const border = new Graphics();
    border.rect(0, 0, C.arena.width, C.arena.height)
      .stroke({ width: 4, color: '#0a2440' });
    this.world.addChild(border);
  }

  private spawnIslandsAndTurrets() {
    for (let i = 0; i < ISLANDS.length; i++) {
      const isl = ISLANDS[i];
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

  private spawnPlayer() {
    const spawn = { x: C.arena.width / 2, y: C.arena.height - 80 };
    const shipIndex = this.runConfig.shipIndex;
    const { container, ship, fires } = this.buildShipContainer(shipIndex, C.player.radius);
    container.x = spawn.x;
    container.y = spawn.y;
    this.world.addChild(container);

    this.player = {
      id: 1, gfx: container, ship, fires,
      x: container.x, y: container.y, radius: C.player.radius,
      hp: C.player.hp, maxHp: C.player.hp,
      rotation: 0,
      frontTimer: 0, sideTimer: 0,
      chargeFront: 0, chargeLeft: 0, chargeRight: 0,
      alive: true, shipIndex,
    };

    this.ensureHpText('player-1', C.player.hp);
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
    this.ensureHpText(key, C.turret.hp);
    this.ensureAimGfx(key);
  }

  private spawnEnemy() {
    const kind = Math.random() < 0.55 ? 'chaser' : 'shooter';
    const spec = kind === 'chaser' ? C.chaser : C.shooter;
    // Navios fixos: chaser = ship_9, shooter = ship_2
    const shipIndex = kind === 'chaser' ? SHIP_INDEX.chaserShip : SHIP_INDEX.shooterShip;

    let x = 0, y = 0, found = false;
    for (let i = 0; i < C.spawn.maxAttempts; i++) {
      x = 40 + Math.random() * (C.arena.width - 80);
      y = 40 + Math.random() * (C.arena.height - 80);
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
    this.ensureHpText(key, enemy.hp);
    this.ensureAimGfx(key);
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
    const muzzle = p.radius * C.player.muzzleOffset;   // bem colado no casco

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
    if (this.destroyed || this.ended) return;
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
    if (this.player) this.updatePlayer(this.player, dt);
    this.updateEnemies(dt);
    this.updateTurrets(dt);
    this.updateProjectiles(dt);
    this.updateWrecks(dt);
    this.updateSpawns(dt);
    this.updateShipFiresAll();
    this.updateAimPreviews();
    this.updateHpTexts();
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

    p.x = Math.max(p.radius, Math.min(C.arena.width - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(C.arena.height - p.radius, p.y));
    this.resolveIslandCollisionEntity(p);

    p.frontTimer -= dt;
    p.sideTimer -= dt;

    const frontKey = k['2'];
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

          if (e.attackTimer > C.shooter.aimDuration) {
            e.aimDirection = Math.atan2(dy, dx);
          }

          if (dist <= C.shooter.attackRange && e.attackTimer <= 0) {
            e.attackTimer = C.shooter.attackCooldown + Math.random() * C.shooter.cooldownJitter;
            this.spawnProjectile('enemy', null,
              e.x + Math.cos(e.aimDirection) * (e.radius + 4),
              e.y + Math.sin(e.aimDirection) * (e.radius + 4),
              e.aimDirection, C.shooter.projectileRange, C.projectile.enemyFlightTime);
          }
        }
      }

      e.x = Math.max(e.radius, Math.min(C.arena.width - e.radius, e.x));
      e.y = Math.max(e.radius, Math.min(C.arena.height - e.radius, e.y));
      this.resolveIslandCollisionEntity(e);

      if (e.kind === 'chaser' && target) {
        if (Math.hypot(e.x - target.x, e.y - target.y) < e.radius + target.radius) {
          this.spawnExplosion(e.x, e.y, 'small');
          this.destroyEnemy(e, false);
          this.damagePlayer(target, C.chaser.contactDamage);
        }
      }

      if (e.alive) {
        e.gfx.x = e.x; e.gfx.y = e.y;
        e.gfx.rotation = e.aimDirection + Math.PI / 2;
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

      if (t.attackTimer > C.turret.aimDuration) {
        t.aimDirection = Math.atan2(dy, dx);
      }
      t.gfx.rotation = t.aimDirection;

      if (dist <= C.turret.range && t.attackTimer <= 0) {
        t.attackTimer = C.turret.attackCooldown + Math.random() * C.turret.cooldownJitter;
        this.spawnProjectile('enemy', null,
          t.x + Math.cos(t.aimDirection) * (t.radius + 4),
          t.y + Math.sin(t.aimDirection) * (t.radius + 4),
          t.aimDirection, C.turret.projectileRange, C.projectile.enemyFlightTime,
          C.turret.projectileDamage);
      }
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

      if (p.x < -80 || p.y < -80 || p.x > C.arena.width + 80 || p.y > C.arena.height + 80) {
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
      if (t >= 1) {
        w.dead = true;
        w.sprite.destroy();
      }
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
      this.hpTexts.get(t.key)?.destroy(); this.hpTexts.delete(t.key);
      this.aimGfx.get(t.key)?.destroy(); this.aimGfx.delete(t.key);
      t.gfx.destroy();
    }
  }

  private damagePlayer(p: Player, dmg: number) {
    p.hp = Math.max(0, p.hp - dmg);
    const snap = this.snapshot.players.find(s => s.id === p.id);
    if (snap) snap.hp = p.hp;
    if (p.hp <= 0 && p.alive) {
      p.alive = false;
      p.ship.alpha = 0.25;
      p.fires.forEach(f => f.visible = false);
      this.end('death');
    }
  }

  /**
   * Destrói inimigo. Se `byPlayer`, dispara a sequência:
   * explosão média → explosão grande → naufrágio (1s, afundando) → some.
   */
  private destroyEnemy(e: Enemy, byPlayer: boolean) {
    if (!e.alive) return;
    e.alive = false;

    this.hpTexts.get(e.key)?.destroy(); this.hpTexts.delete(e.key);
    this.aimGfx.get(e.key)?.destroy(); this.aimGfx.delete(e.key);

    const { x, y } = e;
    const finalRotation = e.gfx.rotation;
    const baseSize = e.radius * 3.2;

    // Texturas específicas por tipo
    const wreckIndex = e.kind === 'chaser' ? SHIP_INDEX.chaserWreck : SHIP_INDEX.shooterWreck;

    e.ship.destroy();
    e.fires.forEach(f => f.destroy());
    e.gfx.destroy();

    if (!byPlayer) return;

    // Explosão média
    const med = new Sprite(this.textures.explosionMedium);
    med.anchor.set(0.5); med.x = x; med.y = y;
    this.fitSprite(med, baseSize);
    this.world.addChild(med);

    this.schedule(C.destruction.mediumExplosionDuration, () => {
      med.destroy();

      // Explosão grande
      const lg = new Sprite(this.textures.explosionLarge);
      lg.anchor.set(0.5); lg.x = x; lg.y = y;
      this.fitSprite(lg, baseSize * 1.4);
      this.world.addChild(lg);

      this.schedule(C.destruction.largeExplosionDuration, () => {
        lg.destroy();

        // Navio afundando (drift leve p/ direita+baixo, encolhe, esmaece)
        const wreck = new Sprite(this.textures.ships[wreckIndex]);
        wreck.anchor.set(0.5);
        wreck.x = x; wreck.y = y;
        wreck.rotation = finalRotation;
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

  private spawnExplosion(x: number, y: number, kind: 'small' | 'medium' | 'large') {
    const tex = kind === 'small' ? this.textures.explosionSmall
             : kind === 'medium' ? this.textures.explosionMedium
             : this.textures.explosionLarge;
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5); sprite.x = x; sprite.y = y;
    this.fitSprite(sprite, 40);
    this.world.addChild(sprite);
    const life = kind === 'small' ? 0.18 : kind === 'medium' ? 0.25 : 0.35;
    this.schedule(life, () => sprite.destroy());
  }

  // ---------- Fires by HP ----------

  private updateShipFiresAll() {
    if (this.player) this.updateShipFires(this.player);
    for (const e of this.enemies) this.updateShipFires(e);
  }

  private updateShipFires(entity: Entity) {
    if (!entity.alive) return;
    const ratio = entity.hp / entity.maxHp;
    let fires = 0;
    for (const t of C.damageStates) {
      if (ratio <= t.maxHpRatio) fires = Math.max(fires, t.fires);
    }
    for (let i = 0; i < entity.fires.length; i++) {
      entity.fires[i].visible = i < fires;
    }
  }

  // ---------- HP text / aim previews ----------

  private ensureHpText(key: string, initialHp: number) {
    if (this.hpTexts.has(key)) return;
    const t = new Text({ text: String(initialHp), style: HP_STYLE });
    t.anchor.set(0.5);
    this.world.addChild(t);
    this.hpTexts.set(key, t);
  }
  private ensureAimGfx(key: string) {
    if (this.aimGfx.has(key)) return this.aimGfx.get(key)!;
    const g = new Graphics();
    this.world.addChild(g);
    this.aimGfx.set(key, g);
    return g;
  }

  private updateHpTexts() {
    if (this.player) {
      const p = this.player;
      const t = this.hpTexts.get('player-1');
      if (t) {
        t.text = `${p.hp}`;
        t.x = p.x; t.y = p.y - p.radius - 12;
        t.visible = p.alive;
      }
    }
    for (const e of this.enemies) {
      const t = this.hpTexts.get(e.key);
      if (!t) continue;
      t.text = `${e.hp}`;
      t.x = e.x; t.y = e.y - e.radius - 10;
    }
    for (const t of this.turrets) {
      const text = this.hpTexts.get(t.key);
      if (!text) continue;
      text.text = `${t.hp}`;
      text.x = t.x; text.y = t.y - t.radius - 10;
      text.visible = t.alive;
    }
  }

  private projectileLandingPoint(p: Projectile): { x: number; y: number } {
    const speed = Math.hypot(p.vx, p.vy) || 1;
    const remaining = Math.max(0, (p.range - p.traveled) / speed);
    return { x: p.x + p.vx * remaining, y: p.y + p.vy * remaining };
  }

  private updateAimPreviews() {
    // Marcadores de pouso dos projéteis em voo — ficam no ponto exato onde a bola cai
    this.projectileAimGfx.clear();
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      const { x, y } = this.projectileLandingPoint(p);
      const color = p.owner === 'player' ? C.aim.lineColor : C.aim.lineColorEnemy;
      this.drawAimMarker(this.projectileAimGfx, x, y, color);
    }

    // Mira do player durante o charge
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

    // Mira dos shooters (vermelho vivo)
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
      const range = C.shooter.projectileRange * progress;
      this.drawAimMarker(g,
        e.x + Math.cos(e.aimDirection) * range,
        e.y + Math.sin(e.aimDirection) * range,
        C.aim.lineColorEnemy);
    }

    // Mira das torretas (vermelho vivo)
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
      const range = C.turret.projectileRange * progress;
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
}