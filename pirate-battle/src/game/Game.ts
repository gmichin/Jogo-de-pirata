import { Application, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { GAME_CONFIG as C, ISLANDS } from './config';
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

// Offsets relativos ao "raio" do navio para posicionar foguinhos
const FIRE_OFFSETS = [
  { x: -0.45, y: -0.15 },
  { x:  0.45, y:  0.15 },
  { x:  0.05, y:  0.50 },
  { x: -0.15, y: -0.55 },
];

interface Scheduled { delay: number; action: () => void; done: boolean; }

export class Game {
  private app: Application;
  private world: Container;
  private host: HTMLElement;
  private onEnd: OnEnd;

  private textures: {
    explosionLarge: Texture; explosionMedium: Texture; explosionSmall: Texture;
    fireLarge: Texture; fireSmall: Texture;
    cannonBall: Texture; ships: Texture[]; destroyedShip: Texture;
  };

  private players: Player[] = [];
  private enemies: Enemy[] = [];
  private turrets: Turret[] = [];
  private projectiles: Projectile[] = [];
  private islands: Rect[] = [];

  private aimGfx = new Map<string, Graphics>();
  private hpTexts = new Map<string, Text>();

  private keys: Record<string, boolean> = {};

  private snapshot: GameSnapshot;
  private runConfig: RunConfig;
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

    this.snapshot = {
      score: 0,
      players: Array.from({ length: runConfig.players }, (_, i) => ({
        id: (i + 1) as PlayerId, hp: C.player.hp, maxHp: C.player.hp,
      })),
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
    this.spawnPlayers();

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
    this.snapshot.paused = !this.snapshot.paused;
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

  // ---------- World setup ----------

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
        .fill('#c9b27a').stroke({ width: 4, color: '#6f5a2a' });
      this.world.addChild(g);

      // Dois cantos opostos por ilha
      const corners = [
        { x: isl.x,                y: isl.y },
        { x: isl.x + isl.w,        y: isl.y + isl.h },
        { x: isl.x + isl.w,        y: isl.y },
      ];
      const chosen = [corners[0], corners[1]];
      chosen.forEach((c, idx) => this.spawnTurret(i, idx, c.x, c.y));
    }
  }

  private buildShipContainer(shipIndex: number, radius: number): { container: Container; ship: Sprite; fires: Sprite[] } {
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

  private fitSprite(sprite: Sprite, maxSize: number) {
    const w = sprite.texture.width || 1;
    const h = sprite.texture.height || 1;
    const scale = maxSize / Math.max(w, h);
    sprite.scale.set(scale);
  }

  private spawnPlayers() {
    const spawns = [
      { x: C.arena.width / 2 - 60, y: C.arena.height - 80 },
      { x: C.arena.width / 2 + 60, y: C.arena.height - 80 },
    ];

    for (let i = 0; i < this.runConfig.players; i++) {
      const id = (i + 1) as PlayerId;
      const shipIndex = i === 0 ? this.runConfig.shipIndex : this.pickRandomShipIndex([this.runConfig.shipIndex]);
      const { container, ship, fires } = this.buildShipContainer(shipIndex, C.player.radius);
      container.x = spawns[i].x;
      container.y = spawns[i].y;
      this.world.addChild(container);

      this.players.push({
        id, gfx: container, ship, fires,
        x: container.x, y: container.y, radius: C.player.radius,
        hp: C.player.hp, maxHp: C.player.hp,
        rotation: 0,
        frontTimer: 0, sideTimer: 0,
        chargeFront: 0, chargeLeft: 0, chargeRight: 0,
        alive: true, shipIndex,
      });

      this.ensureHpText(`player-${id}`, C.player.hp);
      this.ensureAimGfx(`player-${id}`);
    }
  }

  private pickRandomShipIndex(exclude: number[]): number {
    const all = Array.from({ length: this.textures.ships.length }, (_, i) => i);
    const pool = all.filter(i => !exclude.includes(i));
    if (pool.length === 0) return all[0];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private usedShipIndexes(): number[] {
    return [
      ...this.players.map(p => p.shipIndex),
      ...this.enemies.map(e => e.shipIndex),
    ];
  }

  private spawnTurret(islandIndex: number, cornerIndex: number, x: number, y: number) {
    const container = new Container();
    const r = C.turret.radius;

    // Canhão desenhado (não há PNG de canhão nos assets disponíveis).
    // Base circular + cano retangular apontando para "cima" (-y).
    const base = new Graphics();
    base.circle(0, 0, r).fill('#3a2a1c').stroke({ width: 2, color: '#1a1108' });
    base.rect(-4, -r - 8, 8, r + 8).fill('#5c4530').stroke({ width: 2, color: '#1a1108' });
    base.circle(0, 0, r * 0.55).fill('#8a6b46');
    container.addChild(base);
    container.x = x;
    container.y = y;
    this.world.addChild(container);

    const key = `turret-${islandIndex}-${cornerIndex}`;
    this.turrets.push({
      gfx: container, x, y, radius: r,
      hp: C.turret.hp, maxHp: C.turret.hp, alive: true,
      rotation: 0,
      attackTimer: Math.random() * C.turret.attackCooldown,
      islandIndex, cornerIndex, key,
    });
    this.ensureHpText(key, C.turret.hp);
    this.ensureAimGfx(key);
  }

  private spawnEnemy() {
    const kind = Math.random() < 0.55 ? 'chaser' : 'shooter';
    const spec = kind === 'chaser' ? C.chaser : C.shooter;

    let x = 0, y = 0, found = false;
    for (let i = 0; i < C.spawn.maxAttempts; i++) {
      x = 40 + Math.random() * (C.arena.width - 80);
      y = 40 + Math.random() * (C.arena.height - 80);
      if (this.minDistanceToAnyPlayer(x, y) < C.spawn.minDistanceFromPlayer) continue;
      if (this.isInsideAnyIsland(x, y, spec.radius + 10)) continue;
      found = true; break;
    }
    if (!found) return;

    const excludeShips = this.usedShipIndexes();
    const shipIndex = this.pickRandomShipIndex(excludeShips);
    const { container, ship, fires } = this.buildShipContainer(shipIndex, spec.radius);
    container.x = x; container.y = y;
    this.world.addChild(container);

    const key = `enemy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const enemy: Enemy = {
      key, gfx: container, ship, fires,
      x, y, radius: spec.radius,
      hp: spec.hp, maxHp: spec.hp, alive: true,
      kind, rotation: 0, speed: spec.speed,
      attackTimer: Math.random() * C.shooter.attackCooldown, // dessincroniza
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
    rotation: number, range: number,
    damageOverride?: number,
  ) {
    const container = new Container();
    const ball = new Sprite(this.textures.cannonBall);
    ball.anchor.set(0.5);
    this.fitSprite(ball, C.projectile.radius * 2.4);
    container.addChild(ball);
    container.x = x; container.y = y;
    this.world.addChild(container);

    this.projectiles.push({
      gfx: container, x, y,
      vx: Math.cos(rotation) * C.projectile.speed,
      vy: Math.sin(rotation) * C.projectile.speed,
      radius: C.projectile.radius,
      damage: damageOverride ?? (owner === 'player' ? C.projectile.damage : C.projectile.enemyDamage),
      owner, ownerId,
      traveled: 0, range, alive: true,
    });
  }

  private firePlayerWeapon(p: Player, slot: 'front' | 'left' | 'right') {
    const charge = slot === 'front' ? p.chargeFront : slot === 'left' ? p.chargeLeft : p.chargeRight;
    const clamped = Math.max(0, Math.min(1, charge));
    const range = C.projectile.minRange + (C.projectile.maxRange - C.projectile.minRange) * clamped;
    const baseDir = p.rotation - Math.PI / 2;

    if (slot === 'front') {
      this.spawnProjectile('player', p.id,
        p.x + Math.cos(baseDir) * (p.radius + 6),
        p.y + Math.sin(baseDir) * (p.radius + 6),
        baseDir, range);
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

  // ---------- Update loop ----------

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

    this.updateScheduled(dt);
    for (const p of this.players) this.updatePlayer(p, dt);
    this.updateEnemies(dt);
    this.updateTurrets(dt);
    this.updateProjectiles(dt);
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

    const left  = p.id === 1 ? k['a'] || k['A'] : k['j'] || k['J'];
    const right = p.id === 1 ? k['d'] || k['D'] : k['l'] || k['L'];
    const fwd   = p.id === 1 ? k['w'] || k['W'] : k['i'] || k['I'];
    const back  = p.id === 1 ? k['s'] || k['S'] : k['k'] || k['K'];

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

    const frontKey = p.id === 1 ? k['2'] : k['9'];
    const leftKey  = p.id === 1 ? k['q'] || k['Q'] : k['u'] || k['U'];
    const rightKey = p.id === 1 ? k['e'] || k['E'] : k['o'] || k['O'];
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
      const target = this.nearestPlayer(e.x, e.y);
      if (!target) continue;

      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.rotation = Math.atan2(dy, dx) + Math.PI / 2;

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
          e.attackTimer = C.shooter.attackCooldown + Math.random() * C.shooter.cooldownJitter;
          // Tiro também "carregado": usa alcance máximo variando levemente
          const range = C.projectile.minRange + Math.random() * (C.shooter.projectileRange - C.projectile.minRange);
          const dir = Math.atan2(dy, dx);
          this.spawnProjectile('enemy', null,
            e.x + Math.cos(dir) * (e.radius + 6),
            e.y + Math.sin(dir) * (e.radius + 6),
            dir, range);
        }
      }

      e.x = Math.max(e.radius, Math.min(C.arena.width - e.radius, e.x));
      e.y = Math.max(e.radius, Math.min(C.arena.height - e.radius, e.y));
      this.resolveIslandCollisionEntity(e);

      e.gfx.x = e.x; e.gfx.y = e.y;
      e.gfx.rotation = e.rotation; // já somamos PI/2 acima
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
        t.attackTimer = C.turret.attackCooldown + Math.random() * C.turret.cooldownJitter;
        const range = C.projectile.minRange + Math.random() * (C.turret.projectileRange - C.projectile.minRange);
        this.spawnProjectile('enemy', null,
          t.x + Math.cos(t.rotation) * (t.radius + 6),
          t.y + Math.sin(t.rotation) * (t.radius + 6),
          t.rotation, range, C.turret.projectileDamage);
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

      // Arco visual
      const t = Math.max(0, Math.min(1, p.traveled / p.range));
      const arc = Math.sin(t * Math.PI);
      const s = 1 + arc * C.projectile.arcScale;
      p.gfx.scale.set(s);

      // Aterrissou (range esgotado): resolve colisão UMA vez no ponto de queda
      if (p.traveled >= p.range) {
        this.onProjectileLand(p);
        p.alive = false;
        p.gfx.destroy();
        continue;
      }

      // Saiu muito longe da arena (segurança)
      if (p.x < -80 || p.y < -80 || p.x > C.arena.width + 80 || p.y > C.arena.height + 80) {
        p.alive = false;
        p.gfx.destroy();
      }
      // Projéteis passam POR CIMA das ilhas — nenhum teste com islands.
    }
    this.projectiles = this.projectiles.filter(p => p.alive);
  }

  private onProjectileLand(p: Projectile) {
    const r = C.projectile.landingRadius;

    if (p.owner === 'player') {
      // 1) inimigos
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) <= e.radius + r) {
          this.damageEnemy(e, p.damage);
          this.spawnExplosion(p.x, p.y, 'small');
          return;
        }
      }
      // 2) torretas
      for (const t of this.turrets) {
        if (!t.alive) continue;
        if (Math.hypot(p.x - t.x, p.y - t.y) <= t.radius + r) {
          this.damageTurret(t, p.damage);
          this.spawnExplosion(p.x, p.y, 'small');
          return;
        }
      }
      // Caiu no mar / na areia — sem dano.
    } else {
      // Tiro inimigo: só conta se cair SOBRE o jogador
      for (const pl of this.players) {
        if (!pl.alive) continue;
        if (Math.hypot(p.x - pl.x, p.y - pl.y) <= pl.radius + r) {
          this.damagePlayer(pl, p.damage);
          this.spawnExplosion(p.x, p.y, 'small');
          return;
        }
      }
    }
  }

  private updateSpawns(dt: number) {
    this.spawnAccumulator += dt;
    if (this.spawnAccumulator >= this.runConfig.spawnInterval) {
      this.spawnAccumulator = 0;
      this.spawnEnemy();
    }
  }

  // ---------- Damage / death ----------

  private damageEnemy(e: Enemy, dmg: number) {
    e.hp = Math.max(0, e.hp - dmg);
    if (e.hp <= 0 && e.alive) {
      e.alive = false;
      this.snapshot.score += 1;
      this.destroyEnemy(e);
    }
  }

  private damageTurret(t: Turret, dmg: number) {
    t.hp = Math.max(0, t.hp - dmg);
    if (t.hp <= 0 && t.alive) {
      t.alive = false;
      this.snapshot.score += 1;
      const key = t.key;
      this.hpTexts.get(key)?.destroy(); this.hpTexts.delete(key);
      this.aimGfx.get(key)?.destroy(); this.aimGfx.delete(key);
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
    }
    if (this.players.every(pl => !pl.alive)) this.end('death');
  }

  private destroyEnemy(e: Enemy) {
    const key = e.key;
    this.hpTexts.get(key)?.destroy(); this.hpTexts.delete(key);
    this.aimGfx.get(key)?.destroy(); this.aimGfx.delete(key);

    const { x, y } = e;
    const rot = e.rotation;
    const baseSize = e.radius * 3.2;

    // Some o navio original
    e.ship.destroy();
    e.fires.forEach(f => f.destroy());
    e.gfx.destroy();

    // Explosão média
    const med = new Sprite(this.textures.explosionMedium);
    med.anchor.set(0.5); med.x = x; med.y = y; med.rotation = rot;
    this.fitSprite(med, baseSize);
    this.world.addChild(med);

    this.schedule(C.destruction.mediumExplosionDuration, () => {
      med.destroy();
      const lg = new Sprite(this.textures.explosionLarge);
      lg.anchor.set(0.5); lg.x = x; lg.y = y;
      this.fitSprite(lg, baseSize * 1.4);
      this.world.addChild(lg);

      this.schedule(C.destruction.largeExplosionDuration, () => {
        lg.destroy();
        const wreck = new Sprite(this.textures.destroyedShip);
        wreck.anchor.set(0.5); wreck.x = x; wreck.y = y; wreck.rotation = rot;
        this.fitSprite(wreck, baseSize);
        this.world.addChild(wreck);

        this.schedule(C.destruction.wreckDuration, () => wreck.destroy());
      });
    });
  }

  private spawnExplosion(x: number, y: number, kind: 'small' | 'medium' | 'large') {
    const tex = kind === 'small' ? this.textures.explosionSmall
             : kind === 'medium' ? this.textures.explosionMedium
             : this.textures.explosionLarge;
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5); sprite.x = x; sprite.y = y;
    this.fitSprite(sprite, 48);
    this.world.addChild(sprite);
    const life = kind === 'small' ? 0.18 : kind === 'medium' ? 0.25 : 0.35;
    this.schedule(life, () => sprite.destroy());
  }

  // ---------- Fires by HP ----------

  private updateShipFiresAll() {
    for (const p of this.players) this.updateShipFires(p);
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
    for (const p of this.players) {
      const t = this.hpTexts.get(`player-${p.id}`);
      if (!t) continue;
      t.text = `${p.hp}`;
      t.x = p.x; t.y = p.y - p.radius - 12;
      t.visible = p.alive;
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

  private updateAimPreviews() {
    for (const p of this.players) {
      const g = this.aimGfx.get(`player-${p.id}`);
      if (!g) continue;
      g.clear();
      if (!p.alive) continue;
      const baseDir = p.rotation - Math.PI / 2;
      if (p.chargeFront > 0) {
        const range = C.projectile.minRange + (C.projectile.maxRange - C.projectile.minRange) * Math.min(1, p.chargeFront);
        this.drawAimLine(g, p.x, p.y, baseDir, range, C.aim.lineColor);
      }
      if (p.chargeLeft > 0) {
        const range = C.projectile.minRange + (C.projectile.maxRange - C.projectile.minRange) * Math.min(1, p.chargeLeft);
        this.drawAimLine(g, p.x, p.y, baseDir - Math.PI / 2, range, C.aim.lineColor);
      }
      if (p.chargeRight > 0) {
        const range = C.projectile.minRange + (C.projectile.maxRange - C.projectile.minRange) * Math.min(1, p.chargeRight);
        this.drawAimLine(g, p.x, p.y, baseDir + Math.PI / 2, range, C.aim.lineColor);
      }
    }
    for (const e of this.enemies) {
      const g = this.aimGfx.get(e.key);
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
      const g = this.aimGfx.get(t.key);
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

  private drawAimLine(g: Graphics, x: number, y: number, rotation: number, range: number, color: number) {
    const dx = Math.cos(rotation), dy = Math.sin(rotation);
    const dots = Math.min(C.aim.maxDots, Math.max(3, Math.floor(range / C.aim.dotSpacing)));
    for (let i = 1; i <= dots; i++) {
      const t = i / dots;
      g.circle(x + dx * range * t, y + dy * range * t, 2).fill({ color, alpha: 0.55 });
    }
    g.circle(x + dx * range, y + dy * range, C.aim.targetCircleRadius)
      .stroke({ width: 2, color, alpha: 0.9 });
  }

  // ---------- Helpers ----------

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
    let best: Player | null = null; let bestD = Infinity;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
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