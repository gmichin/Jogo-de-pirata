export const GAME_CONFIG = {
  arena: { width: 900, height: 600 },

  player: {
    radius: 27.5,
    speed: 140,
    rotationSpeed: 2.6,
    hp: 100,
    frontCooldown: 0.25,
    sideCooldown: 0.6,
    muzzleOffset: 0.25,      // antes 0.6 → tiro nasce mais colado
  },

  projectile: {
    radius: 3,
    damage: 12,
    enemyDamage: 10,
    playerFlightTime: 0.85,
    enemyFlightTime: 2.2,
    arcScale: 0.9,
    minRange: 35,            // antes 80 → mira começa perto do navio
    maxRange: 380,
    landingRadius: 10,
  },

  charge: { maxTime: 1.0 },

  chaser: {
    radius: 22.5,
    hp: 12,
    speed: 60,
    contactDamage: 25,
  },

  shooter: {
    radius: 22.5,
    hp: 36,
    speed: 45,
    attackRange: 280,
    attackCooldown: 2.0,
    cooldownJitter: 0.25,
    aimDuration: 1.0,
    projectileRange: 300,
  },

  turret: {
    radius: 22.5,
    hp: 24,
    range: 320,
    attackCooldown: 2.0,
    cooldownJitter: 0.25,
    aimDuration: 1.0,
    projectileDamage: 5,
    projectileRange: 320,
  },

  spawn: {
    baseInterval: 4.0,
    minInterval: 2.0,
    accelPerSec: 0.02,
    minDistanceFromPlayer: 220,
    maxAttempts: 12,
  },

  session: {
    minDuration: 60,
    maxDuration: 180,
    defaultDuration: 90,
  },

  aim: {
    lineColor: 0xffe400,        // amarelo vivo (player)
    lineColorEnemy: 0xff2020,   // vermelho bem vivo (inimigos)
    markerRadius: 11,
  },

  damageStates: [
    { maxHpRatio: 0.5,  fires: 1 },
    { maxHpRatio: 0.25, fires: 2 },
    { maxHpRatio: 0.1,  fires: 4 },
  ],

  destruction: {
    mediumExplosionDuration: 0.18,
    largeExplosionDuration: 0.28,
    wreckDuration: 1.0,        // 1s de naufrágio
    wreckDriftX: 14,           // px/s para a direita
    wreckDriftY: 9,            // px/s para baixo
    wreckScaleTo: 0.7,         // encolhe até 70%
  },
} as const;

export const ISLANDS = [
  { x: 180, y: 140, w: 160, h: 120 },
  { x: 620, y: 380, w: 180, h: 140 },
  { x: 400, y: 260, w: 120, h: 90 },
] as const;

export const SHIP_COUNT = 24;

// Índices 0-based das imagens que você indicou
export const SHIP_INDEX = {
  chaserShip:   8,   // ships/ship_9.png
  chaserWreck:  20,  // ships/ship_21.png
  shooterShip:  1,   // ships/ship_2.png
  shooterWreck: 19,  // ships/ship_20.png
} as const;