import { Application, Container, Graphics, Text } from 'pixi.js';
import { GAME_CONFIG as C } from './config';
import type {
  Enemy,
  GameSnapshot,
  Player,
  Projectile,
  RunConfig,
} from './types';

type OnEnd = (snapshot: GameSnapshot) => void;

export class Game {
  private app: Application;
  private world: Container;
  private host: HTMLElement;
  private onEnd: OnEnd;

  private player!: Player;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private islands: { x: number; y: number; r: number }[] = [];

  private keys: Record<string, boolean> = {};
  private snapshot: GameSnapshot;
  private runConfig: RunConfig;
  private spawnAccumulator = 0;
  private destroyed = false;

  constructor(host: HTMLElement, runConfig: RunConfig, onEnd: OnEnd) {
    this.host = host;
    this.runConfig = runConfig;
    this.onEnd = onEnd;
    this.app = new Application();
    this.world = new Container();

    this.snapshot = {
      score: 0,
      hp: C.player.hp,
      maxHp: C.player.hp,
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
    this.spawnIslands();
    this.spawnPlayer();

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
      // ignore double-destroy in strict mode
    }
  }

  getSnapshot(): GameSnapshot {
    return { ...this.snapshot };
  }

  togglePause() {
    if (this.snapshot.ended) return;
    this.snapshot.paused = !this.snapshot.paused;
  }

  resume() {
    if (this.snapshot.ended) return;
    this.snapshot.paused = false;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.key] = true;
    if (e.key === ' ') e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key] = false;
  };

  private onBlur = () => {
    if (!this.snapshot.ended) this.snapshot.paused = true;
  };

  private drawWater() {
    const g = new Graphics();
    g.rect(0, 0, C.arena.width, C.arena.height).fill('#1a4b7a');
    g.rect(0, 0, C.arena.width, C.arena.height).stroke({
      width: 4,
      color: '#0a2440',
    });
    this.world.addChild(g);
  }

  private spawnIslands() {
    const layout = [
      { x: 220, y: 180, r: 60 },
      { x: 680, y: 420, r: 70 },
      { x: 450, y: 300, r: 40 },
    ];
    for (const island of layout) {
      this.islands.push(island);
      const g = new Graphics();
      g.circle(island.x, island.y, island.r)
        .fill('#c9b27a')
        .stroke({ width: 4, color: '#6f5a2a' });
      this.world.addChild(g);
    }
  }

  private spawnPlayer() {
    const g = new Graphics();
    g.poly([0, -C.player.radius, C.player.radius, C.player.radius, -C.player.radius, C.player.radius])
      .fill('#f2e2b6')
      .stroke({ width: 2, color: '#5c4a20' });
    g.x = C.arena.width / 2;
    g.y = C.arena.height / 2;
    this.world.addChild(g);

    this.player = {
      gfx: g,
      x: g.x,
      y: g.y,
      radius: C.player.radius,
      hp: C.player.hp,
      maxHp: C.player.hp,
      rotation: 0,
      frontTimer: 0,
      sideTimer: 0,
      alive: true,
    };
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
      const dPlayer = Math.hypot(x - this.player.x, y - this.player.y);
      if (dPlayer < C.spawn.minDistanceFromPlayer) continue;
      const hitsIsland = this.islands.some(
        (is) => Math.hypot(x - is.x, y - is.y) < is.r + spec.radius + 10
      );
      if (hitsIsland) continue;
      found = true;
      break;
    }
    if (!found) return;

    const g = new Graphics();
    g.poly([0, -spec.radius, spec.radius, spec.radius, -spec.radius, spec.radius])
      .fill(kind === 'chaser' ? '#c0392b' : '#8e44ad')
      .stroke({ width: 2, color: '#2c1810' });
    g.x = x;
    g.y = y;
    this.world.addChild(g);

    this.enemies.push({
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
    });
  }

  private spawnProjectile(owner: 'player' | 'enemy', x: number, y: number, rotation: number, offset = 0) {
    const g = new Graphics();
    const r = C.projectile.radius;
    g.circle(0, 0, r).fill(owner === 'player' ? '#ffe066' : '#ff7043');
    g.x = x;
    g.y = y;
    this.world.addChild(g);

    const dirX = Math.cos(rotation);
    const dirY = Math.sin(rotation);
    this.projectiles.push({
      gfx: g,
      x,
      y,
      vx: dirX * C.projectile.speed,
      vy: dirY * C.projectile.speed,
      radius: r,
      damage: owner === 'player' ? C.projectile.damage : C.projectile.enemyDamage,
      owner,
      life: C.projectile.lifetime,
      alive: true,
    });
  }

  private fireFront() {
    const dir = this.player.rotation - Math.PI / 2;
    this.spawnProjectile(
      'player',
      this.player.x + Math.cos(dir) * (this.player.radius + 6),
      this.player.y + Math.sin(dir) * (this.player.radius + 6),
      dir
    );
  }

  private fireSide(side: 'left' | 'right') {
    const dir = this.player.rotation - Math.PI / 2 + (side === 'left' ? -Math.PI / 2 : Math.PI / 2);
    const sideX = Math.cos(this.player.rotation) * (side === 'right' ? 1 : -1);
    const sideY = Math.sin(this.player.rotation) * (side === 'right' ? 1 : -1);
    for (let i = -1; i <= 1; i++) {
      const perpX = Math.cos(this.player.rotation);
      const perpY = Math.sin(this.player.rotation);
      const ox = sideX * (this.player.radius + 6) + perpX * i * 10;
      const oy = sideY * (this.player.radius + 6) + perpY * i * 10;
      this.spawnProjectile('player', this.player.x + ox, this.player.y + oy, dir);
    }
  }

  private update = () => {
    if (this.destroyed) return;
    if (!this.snapshot.running || this.snapshot.paused || this.snapshot.ended) return;

    const dt = this.app.ticker.deltaMS / 1000;
    this.snapshot.timeLeft -= dt;
    if (this.snapshot.timeLeft <= 0) {
      this.snapshot.timeLeft = 0;
      this.end('time');
      return;
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateSpawns(dt);
    this.checkCollisions();
    this.syncHudAnchors();
  };

  private updatePlayer(dt: number) {
    const p = this.player;
    if (this.keys['ArrowLeft'] || this.keys['a']) p.rotation -= C.player.rotationSpeed * dt;
    if (this.keys['ArrowRight'] || this.keys['d']) p.rotation += C.player.rotationSpeed * dt;

    if (this.keys['ArrowUp'] || this.keys['w']) {
      const dir = p.rotation - Math.PI / 2;
      p.x += Math.cos(dir) * C.player.speed * dt;
      p.y += Math.sin(dir) * C.player.speed * dt;
    }
    if (this.keys['ArrowDown'] || this.keys['s']) {
      const dir = p.rotation - Math.PI / 2;
      p.x -= Math.cos(dir) * C.player.speed * 0.6 * dt;
      p.y -= Math.sin(dir) * C.player.speed * 0.6 * dt;
    }

    p.x = Math.max(p.radius, Math.min(C.arena.width - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(C.arena.height - p.radius, p.y));
    this.resolveIslandCollision(p);

    p.frontTimer -= dt;
    p.sideTimer -= dt;
    if ((this.keys[' '] || this.keys['f']) && p.frontTimer <= 0) {
      p.frontTimer = C.player.frontCooldown;
      this.fireFront();
    }
    if ((this.keys['q'] || this.keys['Shift']) && p.sideTimer <= 0) {
      p.sideTimer = C.player.sideCooldown;
      this.fireSide('left');
    }
    if (this.keys['e'] && p.sideTimer <= 0) {
      p.sideTimer = C.player.sideCooldown;
      this.fireSide('right');
    }

    p.gfx.x = p.x;
    p.gfx.y = p.y;
    p.gfx.rotation = p.rotation;
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
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
          this.spawnProjectile('enemy', e.x, e.y, e.rotation);
        }
      }

      e.x = Math.max(e.radius, Math.min(C.arena.width - e.radius, e.x));
      e.y = Math.max(e.radius, Math.min(C.arena.height - e.radius, e.y));
      this.resolveIslandCollision(e);

      e.gfx.x = e.x;
      e.gfx.y = e.y;
      e.gfx.rotation = e.rotation + Math.PI / 2;
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.gfx.x = p.x;
      p.gfx.y = p.y;
      if (
        p.life <= 0 ||
        p.x < 0 ||
        p.y < 0 ||
        p.x > C.arena.width ||
        p.y > C.arena.height
      ) {
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

  private resolveIslandCollision(e: { x: number; y: number; radius: number }) {
    for (const is of this.islands) {
      const dx = e.x - is.x;
      const dy = e.y - is.y;
      const d = Math.hypot(dx, dy);
      const min = is.r + e.radius;
      if (d < min && d > 0) {
        e.x = is.x + (dx / d) * min;
        e.y = is.y + (dy / d) * min;
      }
    }
  }

  private checkCollisions() {
    // player projectiles vs enemies
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
            this.snapshot.score += 1;
          }
          break;
        }
      }
    }

    // enemy projectiles vs player
    for (const p of this.projectiles) {
      if (!p.alive || p.owner !== 'enemy') continue;
      if (Math.hypot(p.x - this.player.x, p.y - this.player.y) < p.radius + this.player.radius) {
        p.alive = false;
        p.gfx.destroy();
        this.damagePlayer(p.damage);
      }
    }

    // chasers vs player
    for (const e of this.enemies) {
      if (!e.alive || e.kind !== 'chaser') continue;
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < e.radius + this.player.radius) {
        e.alive = false;
        e.gfx.destroy();
        this.damagePlayer(C.chaser.contactDamage);
      }
    }

    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private damagePlayer(dmg: number) {
    this.snapshot.hp = Math.max(0, this.snapshot.hp - dmg);
    if (this.snapshot.hp <= 0) this.end('death');
  }

  private syncHudAnchors() {
    // space reserved: you can move HP bars here
  }

  private end(reason: 'time' | 'death') {
    if (this.snapshot.ended) return;
    this.snapshot.ended = true;
    this.snapshot.running = false;
    this.snapshot.endReason = reason;
    this.onEnd(this.getSnapshot());
  }
}