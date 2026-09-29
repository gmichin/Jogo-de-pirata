import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_CONFIG as C, ISLANDS } from './config';
import type {
  Enemy,
  GameSnapshot,
  Player,
  PlayerId,
  Projectile,
  Rect,
  RunConfig,
  Turret,
} from './types';

type OnEnd = (snapshot: GameSnapshot) => void;

const P1_COLOR = 0xf2e2b6;
const P2_COLOR = 0x8fd6ff;
const ENEMY_COLORS: Record<'chaser' | 'shooter', number> = {
  chaser: 0xc0392b,
  shooter: 0x8e44ad,
};

const HP_STYLE = new TextStyle({
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 2 },
});

export class Game {
  private app: Application;
  private world: Container;
  private host: HTMLElement;
  private onEnd: OnEnd;

  private players: Player[] = [];
  private enemies: Enemy[] = [];
  private turrets: Turret[] = [];
  private projectiles: Projectile[] = [];
  private islands: Rect[] = [];

  // Aim preview graphics per entity
  private aimGfx = new Map<number | PlayerId | string, Graphics>();
  private hpTexts = new Map<number | PlayerId | string, Text>();

  private keys: Record<string, boolean> = {};
  private justPressed: Record<string, boolean> = {};
  private justReleased: Record<string, boolean> = {};

  private snapshot: GameSnapshot;
  private runConfig: RunConfig;
  private spawnAccumulator = 0;
  private destroyed = false;
  private ended = false;

  constructor(host: HTMLElement, runConfig: RunConfig, onEnd: OnEnd) {
    this.host = host;
    this.runConfig = runConfig;
    this.onEnd = onEnd;
    this.app = new Application();
    this.world = new Container();

    const playersSnapshot = Array.from({ length: runConfig.players }, (_, i) => ({
      id: (i + 1) as PlayerId,
      hp: C.player.hp,
      maxHp: C.player.hp,
    }));

    this.snapshot = {
      score: 0,
      players: playersSnapshot,
      timeLeft: runConfig.sessionTime,
      running: true,
      paused: false,
      ended: false,
      endReason: null,
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
    this.spawnPlayers();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    this.app.ticker.add(this.update);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);

    try {
      this.app.ticker.remove(this.update);
      this.app.destroy(true, { children: true });
    } catch {
      // ignore
    }
  }

  getSnapshot(): GameSnapshot {
    return {
      ...this.snapshot,
      players: this.snapshot.players.map((p) => ({ ...p })),
    };
  }

  togglePause() {
    if (this.snapshot.ended) return;
    this.snapshot.paused = !this.snapshot.paused;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.keys[e.key]) this.justPressed[e.key] = true;
    this.keys[e.key] = true;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (this.keys[e.key]) this.justReleased[e.key] = true;
    this.keys[e.key] = false;
  };

  private onBlur = () => {
    if (!this.snapshot.ended) this.snapshot.paused = true;
  };

  private drawWater() {
    const g = new Graphics();
    g.rect(0, 0, C.arena.width, C.arena.height).fill('#1a4b7a');
    g.rect(0, 0, C.arena.width, C.arena.height).stroke({ width: 4, color: '#0a2440' });
    this.world.addChild(g);
  }

  private spawnIslandsAndTurrets() {
    for (let i = 0; i < ISLANDS.length; i++) {
      const isl = ISLANDS[i];
      this.islands.push({ ...isl });

      const g = new Graphics();
      g.rect(isl.x, isl.y, isl.w, isl.h)
        .fill('#c9b27a')
        .stroke({ width: 4, color: '#6f5a2a' });
      this.world.addChild(g);

      this.spawnTurret(i, isl.x + isl.w / 2, isl.y + isl.h / 2);
    }
  }

  private keyFor(id: number | PlayerId | string) {
    return id;
  }

  private ensureHpText(key: number | PlayerId | string, initialHp: number) {
    if (this.hpTexts.has(key)) return;
    const t = new Text({ text: String(initialHp), style: HP_STYLE });
    t.anchor.set(0.5);
    this.world.addChild(t);
    this.hpTexts.set(key, t);
  }

  private ensureAimGfx(key: number | PlayerId | string) {
    if (this.aimGfx.has(key)) return this.aimGfx.get(key)!;
    const g = new Graphics();
    this.world.addChild(g);
    this.aimGfx.set(key, g);
    return g;
  }

  private spawnTurret(islandIndex: number, x: number, y: number) {
    const g = new Graphics();
    const r = C.turret.radius;
    g.circle(0, 0, r).fill('#7a5c3a').stroke({ width: 3, color: '#2c1810' });
    g.rect(-3, -r - 6, 6, r + 6).fill('#2c1810');
    g.x = x;
    g.y = y;
    this.world.addChild(g);

    const turret: Turret = {
      gfx: g,
      x,
      y,
      radius: r,
      hp: C.turret.hp,
      maxHp: C.turret.hp,
      alive: true,
      rotation: 0,
      attackTimer: 0,
      islandIndex,
    };
    this.turrets.push(turret);

    const key = `turret-${islandIndex}`;
    this.ensureHpText(key, turret.hp);
    this.ensureAimGfx(key);
  }

  private spawnPlayers() {
    const spawns: { x: number; y: number }[] = [
      { x: C.arena.width / 2 - 60, y: C.arena.height - 80 },
      { x: C.arena.width / 2 + 60, y: C.arena.height - 80 },
    ];

    for (let i = 0; i < this.runConfig.players; i++) {
      const id = (i + 1) as PlayerId;
      const color = id === 1 ? P1_COLOR : P2_COLOR;
      const g = new Graphics();
      const r = C.player.radius;
      g.poly([0, -r, r, r, -r, r]).fill(color).stroke({ width: 2, color: '#5c4a20' });
      g.x = spawns[i].x;
      g.y = spawns[i].y;
      this.world.addChild(g);

      this.players.push({
        id,
        gfx: g,
        x: g.x,
        y: g.y,
        radius: r,
        hp: C.player.hp,
        maxHp: C.player.hp,
        rotation: 0,
        frontTimer: 0,
        sideTimer: 0,
        chargeFront: 0,
        chargeLeft: 0,
        chargeRight: 0,
        alive: true,
      });

      this.ensureHpText(id, C.player.hp);
      this.ensureAimGfx(id);
    }
  }

  private spawnEnemy() {
    const kind = Math.random() < 0.55 ? 'chaser' : 'shooter';
    const spec = kind === 'chaser' ? C.chaser : C.shooter;

    let x = 0;
    let y = 0;
    let found = false;
    for (let i = 0; i < C.spawn.maxAttempts; i++) {
      x = 40 + Math.random() * (C.arena.width - 80);
      y = 40 + Math.random() * (C.arena.height - 80);
      if (this.minDistanceToAnyPlayer(x, y) < C.spawn.minDistanceFromPlayer) continue;
      if (this.isInsideAnyIsland(x, y, spec.radius + 10)) continue;
      found = true;
      break;
    }
    if (!found) return;

    const g = new Graphics();
    g.poly([0, -spec.radius, spec.radius, spec.radius, -spec.radius, spec.radius])
      .fill(ENEMY_COLORS[kind])
      .stroke({ width: 2, color: '#2c1810' });
    g.x = x;
    g.y = y;
    this.world.addChild(g);

    const enemy: Enemy = {
      gfx: g,
      x,
      y,
      radius: spec.radius,
      hp: spec.hp,
      maxHp: spec.hp,
      alive: true,
      kind,
      rotation: 0,
      speed: spec.speed,
      attackTimer: 0,
    };
    this.enemies.push(enemy);

    const key = `enemy-${this.enemies.length}-${Math.random()}`;
    // store key on enemy via WeakMap-like: attach to gfx as property
    (enemy as any).__key = key;
    this.ensureHpText(key, enemy.hp);
    this.ensureAimGfx(key);
  }

  private spawnProjectile(
    owner: Projectile['owner'],
    ownerId: PlayerId | null,
    x: number,
    y: number,
    rotation: number,
    range: number,
    damageOverride?: number
  ) {
    const r = C.projectile.radius;
    const g = new Graphics();
    const color = owner === 'player' ? (ownerId === 2 ? '#9be3ff' : '#ffe066') : '#ff7043';
    g.circle(0, 0, r).fill(color);
    g.x = x;
    g.y = y;
    this.world.addChild(g);

    this.projectiles.push({
      gfx: g,
      x,
      y,
      vx: Math.cos(rotation) * C.projectile.speed,
      vy: Math.sin(rotation) * C.projectile.speed,
      radius: r,
      damage:
        damageOverride ?? (owner === 'player' ? C.projectile.damage : C.projectile.enemyDamage),
      owner,
      ownerId,
      traveled: 0,
      range,
      alive: true,
    });
  }

  private firePlayerWeapon(p: Player, slot: 'front' | 'left' | 'right') {
    const charge =
      slot === 'front' ? p.chargeFront : slot === 'left' ? p.chargeLeft : p.chargeRight;
    const clamped = Math.max(0, Math.min(1, charge));
    const range =
      C.projectile.minRange + (C.projectile.maxRange - C.projectile.minRange) * clamped;

    const baseDir = p.rotation - Math.PI / 2;
    if (slot === 'front') {
      this.spawnProjectile(
        'player',
        p.id,
        p.x + Math.cos(baseDir) * (p.radius + 6),
        p.y + Math.sin(baseDir) * (p.radius + 6),
        baseDir,
        range
      );
    } else {
      const side = slot === 'left' ? -1 : 1;
      const dir = baseDir + side * (Math.PI / 2);
      const sideX = Math.cos(p.rotation) * side;
      const sideY = Math.sin(p.rotation) * side;
      for (let i = -1; i <= 1; i++) {
        const perpX = Math.cos(p.rotation);
        const perpY = Math.sin(p.rotation);
        const ox = sideX * (p.radius + 6) + perpX * i * 10;
        const oy = sideY * (p.radius + 6) + perpY * i * 10;
        this.spawnProjectile('player', p.id, p.x + ox, p.y + oy, dir, range);
      }
    }
  }

  private update = () => {
    if (this.destroyed || this.ended) return;
    if (!this.snapshot.running || this.snapshot.paused) return;

    const dt = this.app.ticker.deltaMS / 1000;
    this.snapshot.timeLeft -= dt;
    if (this.snapshot.timeLeft <= 0) {
      this.snapshot.timeLeft = 0;
      this.end('time');
      return;
    }

    for (const p of this.players) this.updatePlayer(p, dt);
    this.updateEnemies(dt);
    this.updateTurrets(dt);
    this.updateProjectiles(dt);
    this.updateSpawns(dt);
    this.checkCollisions();
    this.updateAimPreviews();
    this.updateHpTexts();

    // Clear edge-triggered flags
    this.justPressed = {};
    this.justReleased = {};
  };

  private updatePlayer(p: Player, dt: number) {
    if (!p.alive) return;

    // Player 1: W A S D + 2 for front shot, Q/E for sides
    // Player 2: I J L + 9 for front shot, U/O for sides
    const k = this.keys;

    const left = p.id === 1 ? k['a'] || k['A'] : k['j'] || k['J'];
    const right = p.id === 1 ? k['d'] || k['D'] : k['l'] || k['L'];
    const fwd = p.id === 1 ? k['w'] || k['W'] : k['i'] || k['I'];
    const back = p.id === 1 ? k['s'] || k['S'] : k['k'] || k['K'];

    if (left) p.rotation -= C.player.rotationSpeed * dt;
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

    // Charge inputs
    const frontKey = p.id === 1 ? k['2'] : k['9'];
    const leftKey = p.id === 1 ? k['q'] || k['Q'] : k['u'] || k['U'];
    const rightKey = p.id === 1 ? k['e'] || k['E'] : k['o'] || k['O'];

    const chargeStep = dt / C.charge.maxTime;

    // Front
    if (frontKey) {
      p.chargeFront = Math.min(1, p.chargeFront + chargeStep);
    } else if (p.chargeFront > 0) {
      // Released: fire
      if (p.frontTimer <= 0) {
        p.frontTimer = C.player.frontCooldown;
        this.firePlayerWeapon(p, 'front');
      }
      p.chargeFront = 0;
    }

    // Left
    if (leftKey) {
      p.chargeLeft = Math.min(1, p.chargeLeft + chargeStep);
    } else if (p.chargeLeft > 0) {
      if (p.sideTimer <= 0) {
        p.sideTimer = C.player.sideCooldown;
        this.firePlayerWeapon(p, 'left');
      }
      p.chargeLeft = 0;
    }

    // Right
    if (rightKey) {
      p.chargeRight = Math.min(1, p.chargeRight + chargeStep);
    } else if (p.chargeRight > 0) {
      if (p.sideTimer <= 0) {
        p.sideTimer = C.player.sideCooldown;
        this.firePlayerWeapon(p, 'right');
      }
      p.chargeRight = 0;
    }

    p.gfx.x = p.x;
    p.gfx.y = p.y;
    p.gfx.rotation = p.rotation;
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const target = this.nearestPlayer(e.x, e.y);
      if (!target) continue;
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.rotation = Math.atan2(dy, dx);

      if (e.kind === 'chaser') {
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
      } else {
        if (dist > C.shooter.attackRange * 0.8) {
          e.x += (dx / dist) * e.speed * dt;
          e.y += (dy / dist) * e.speed * dt;
        }
        e.attackTimer -= dt;
        if (dist <= C.shooter.attackRange && e.attackTimer <= 0) {
          e.attackTimer = C.shooter.attackCooldown;
          this.spawnProjectile(
            'enemy',
            null,
            e.x,
            e.y,
            e.rotation,
            C.shooter.projectileRange
          );
        }
      }

      e.x = Math.max(e.radius, Math.min(C.arena.width - e.radius, e.x));
      e.y = Math.max(e.radius, Math.min(C.arena.height - e.radius, e.y));
      this.resolveIslandCollisionEntity(e);

      e.gfx.x = e.x;
      e.gfx.y = e.y;
      e.gfx.rotation = e.rotation + Math.PI / 2;
    }
  }

  private updateTurrets(dt: number) {
    for (const t of this.turrets) {
      if (!t.alive) continue;
      const target = this.nearestPlayer(t.x, t.y);
      if (!target) continue;
      const dx = target.x - t.x;
      const dy = target.y - t.y;
      const dist = Math.hypot(dx, dy) || 1;
      t.rotation = Math.atan2(dy, dx);
      t.gfx.rotation = t.rotation + Math.PI / 2;

      t.attackTimer -= dt;
      if (dist <= C.turret.range && t.attackTimer <= 0) {
        t.attackTimer = C.turret.attackCooldown;
        this.spawnProjectile(
          'enemy',
          null,
          t.x + Math.cos(t.rotation) * (t.radius + 6),
          t.y + Math.sin(t.rotation) * (t.radius + 6),
          t.rotation,
          C.turret.projectileRange,
          C.turret.projectileDamage
        );
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

      // Visual arc: scale up toward midpoint, back down at end
      const t = Math.max(0, Math.min(1, p.traveled / p.range));
      const arc = Math.sin(t * Math.PI);
      const s = 1 + arc * C.projectile.arcScale;
      p.gfx.scale.set(s);

      // Fall when range is reached, hit island, or leave arena
      const hitIsland = this.pointHitsAnyIsland(p.x, p.y, p.radius);
      const outOfArena =
        p.x < 0 || p.y < 0 || p.x > C.arena.width || p.y > C.arena.height;

      if (p.traveled >= p.range || hitIsland || outOfArena) {
        p.alive = false;
        p.gfx.destroy();
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private updateSpawns(dt: number) {
    this.spawnAccumulator += dt;
    if (this.spawnAccumulator >= this.runConfig.spawnInterval) {
      this.spawnAccumulator = 0;
      this.spawnEnemy();
    }
  }

  private checkCollisions() {
    // Player projectiles vs enemies and turrets
    for (const p of this.projectiles) {
      if (!p.alive || p.owner !== 'player') continue;

      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
          p.alive = false;
          p.gfx.destroy();
          e.hp -= p.damage;
          if (e.hp <= 0) {
            e.alive = false;
            e.gfx.destroy();
            const key = (e as any).__key;
            if (key) {
              this.hpTexts.get(key)?.destroy();
              this.hpTexts.delete(key);
              this.aimGfx.get(key)?.destroy();
              this.aimGfx.delete(key);
            }
            this.snapshot.score += 1;
          }
          break;
        }
      }
      if (!p.alive) continue;

      for (const t of this.turrets) {
        if (!t.alive) continue;
        if (Math.hypot(p.x - t.x, p.y - t.y) < p.radius + t.radius) {
          p.alive = false;
          p.gfx.destroy();
          t.hp -= p.damage;
          if (t.hp <= 0) {
            t.alive = false;
            t.gfx.destroy();
            const key = `turret-${t.islandIndex}`;
            this.hpTexts.get(key)?.destroy();
            this.hpTexts.delete(key);
            this.aimGfx.get(key)?.destroy();
            this.aimGfx.delete(key);
            this.snapshot.score += 1;
          }
          break;
        }
      }
    }

    // Enemy projectiles vs players
    for (const p of this.projectiles) {
      if (!p.alive || p.owner !== 'enemy') continue;
      for (const pl of this.players) {
        if (!pl.alive) continue;
        if (Math.hypot(p.x - pl.x, p.y - pl.y) < p.radius + pl.radius) {
          p.alive = false;
          p.gfx.destroy();
          this.damagePlayer(pl, p.damage);
          break;
        }
      }
    }

    // Chasers vs players
    for (const e of this.enemies) {
      if (!e.alive || e.kind !== 'chaser') continue;
      for (const pl of this.players) {
        if (!pl.alive) continue;
        if (Math.hypot(e.x - pl.x, e.y - pl.y) < e.radius + pl.radius) {
          e.alive = false;
          e.gfx.destroy();
          const key = (e as any).__key;
          if (key) {
            this.hpTexts.get(key)?.destroy();
            this.hpTexts.delete(key);
            this.aimGfx.get(key)?.destroy();
            this.aimGfx.delete(key);
          }
          this.damagePlayer(pl, C.chaser.contactDamage);
          break;
        }
      }
    }

    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private damagePlayer(p: Player, dmg: number) {
    p.hp = Math.max(0, p.hp - dmg);
    const snap = this.snapshot.players.find((s) => s.id === p.id);
    if (snap) snap.hp = p.hp;

    if (p.hp <= 0 && p.alive) {
      p.alive = false;
      p.gfx.alpha = 0.25;
    }

    if (this.players.every((pl) => !pl.alive)) this.end('death');
  }

  private updateHpTexts() {
    for (const p of this.players) {
      const t = this.hpTexts.get(p.id);
      if (!t) continue;
      t.text = `${p.hp}`;
      t.x = p.x;
      t.y = p.y - p.radius - 12;
      t.visible = p.alive;
    }
    for (const e of this.enemies) {
      const key = (e as any).__key;
      if (!key) continue;
      const t = this.hpTexts.get(key);
      if (!t) continue;
      t.text = `${e.hp}`;
      t.x = e.x;
      t.y = e.y - e.radius - 10;
    }
    for (const t of this.turrets) {
      const key = `turret-${t.islandIndex}`;
      const text = this.hpTexts.get(key);
      if (!text) continue;
      text.text = `${t.hp}`;
      text.x = t.x;
      text.y = t.y - t.radius - 10;
      text.visible = t.alive;
    }
  }

  private updateAimPreviews() {
    // Player aim previews
    for (const p of this.players) {
      const g = this.aimGfx.get(p.id);
      if (!g) continue;
      g.clear();
      if (!p.alive) continue;

      const baseDir = p.rotation - Math.PI / 2;

      if (p.chargeFront > 0) {
        const clamped = Math.min(1, p.chargeFront);
        const range = C.projectile.minRange + (C.projectile.maxRange - C.projectile.minRange) * clamped;
        this.drawAimLine(g, p.x, p.y, baseDir, range, C.aim.lineColor);
      }
      if (p.chargeLeft > 0) {
        const clamped = Math.min(1, p.chargeLeft);
        const range = C.projectile.minRange + (C.projectile.maxRange - C.projectile.minRange) * clamped;
        this.drawAimLine(g, p.x, p.y, baseDir - Math.PI / 2, range, C.aim.lineColor);
      }
      if (p.chargeRight > 0) {
        const clamped = Math.min(1, p.chargeRight);
        const range = C.projectile.minRange + (C.projectile.maxRange - C.projectile.minRange) * clamped;
        this.drawAimLine(g, p.x, p.y, baseDir + Math.PI / 2, range, C.aim.lineColor);
      }
    }

    // Enemy aim previews (shooters and turrets)
    for (const e of this.enemies) {
      const key = (e as any).__key;
      if (!key) continue;
      const g = this.aimGfx.get(key);
      if (!g) continue;
      g.clear();
      if (!e.alive || e.kind !== 'shooter') continue;
      const target = this.nearestPlayer(e.x, e.y);
      if (!target) continue;
      const dist = Math.hypot(target.x - e.x, target.y - e.y);
      if (dist > C.shooter.attackRange) continue;
      const rot = Math.atan2(target.y - e.y, target.x - e.x);
      this.drawAimLine(g, e.x, e.y, rot, C.shooter.projectileRange, C.aim.lineColorEnemy);
    }

    for (const t of this.turrets) {
      const key = `turret-${t.islandIndex}`;
      const g = this.aimGfx.get(key);
      if (!g) continue;
      g.clear();
      if (!t.alive) continue;
      const target = this.nearestPlayer(t.x, t.y);
      if (!target) continue;
      const dist = Math.hypot(target.x - t.x, target.y - t.y);
      if (dist > C.turret.range) continue;
      const rot = Math.atan2(target.y - t.y, target.x - t.x);
      this.drawAimLine(g, t.x, t.y, rot, C.turret.projectileRange, C.aim.lineColorEnemy);
    }
  }

  private drawAimLine(
    g: Graphics,
    x: number,
    y: number,
    rotation: number,
    range: number,
    color: number
  ) {
    const dx = Math.cos(rotation);
    const dy = Math.sin(rotation);

    // Dotted trail
    const dots = Math.min(C.aim.maxDots, Math.max(3, Math.floor(range / C.aim.dotSpacing)));
    for (let i = 1; i <= dots; i++) {
      const t = i / dots;
      const px = x + dx * range * t;
      const py = y + dy * range * t;
      g.circle(px, py, 2).fill({ color, alpha: 0.55 });
    }

    // Target ring
    const tx = x + dx * range;
    const ty = y + dy * range;
    g.circle(tx, ty, C.aim.targetCircleRadius).stroke({ width: 2, color, alpha: 0.9 });
  }

  private minDistanceToAnyPlayer(x: number, y: number): number {
    let min = Infinity;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < min) min = d;
    }
    return min === Infinity ? 0 : min;
  }

  private nearestPlayer(x: number, y: number): Player | null {
    let best: Player | null = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private resolveIslandCollisionEntity(e: { x: number; y: number; radius: number }) {
    for (const isl of this.islands) {
      const nx = Math.max(isl.x, Math.min(isl.x + isl.w, e.x));
      const ny = Math.max(isl.y, Math.min(isl.y + isl.h, e.y));
      const dx = e.x - nx;
      const dy = e.y - ny;
      const d = Math.hypot(dx, dy);
      if (d < e.radius) {
        if (d === 0) {
          const left = e.x - isl.x;
          const right = isl.x + isl.w - e.x;
          const top = e.y - isl.y;
          const bottom = isl.y + isl.h - e.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) e.x = isl.x - e.radius;
          else if (m === right) e.x = isl.x + isl.w + e.radius;
          else if (m === top) e.y = isl.y - e.radius;
          else e.y = isl.y + isl.h + e.radius;
        } else {
          const push = (e.radius - d) / d;
          e.x += dx * push;
          e.y += dy * push;
        }
      }
    }
  }

  private isInsideAnyIsland(x: number, y: number, padding: number): boolean {
    return this.islands.some(
      (i) =>
        x >= i.x - padding &&
        x <= i.x + i.w + padding &&
        y >= i.y - padding &&
        y <= i.y + i.h + padding
    );
  }

  private pointHitsAnyIsland(x: number, y: number, radius: number): boolean {
    return this.islands.some((i) => {
      const nx = Math.max(i.x, Math.min(i.x + i.w, x));
      const ny = Math.max(i.y, Math.min(i.y + i.h, y));
      return Math.hypot(x - nx, y - ny) < radius;
    });
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