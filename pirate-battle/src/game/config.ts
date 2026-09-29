export const GAME_CONFIG = {
  arena: { width: 900, height: 600 },

  player: {
    radius: 27.5,
    speed: 140,
    rotationSpeed: 2.6,
    hp: 100,
    frontCooldown: 0.25,
    sideCooldown: 0.6,
    muzzleOffset: 0.25,
  },

  projectile: {
    radius: 3,
    damage: 12,
    enemyDamage: 10,
    playerFlightTime: 0.85,
    enemyFlightTime: 2.2,
    arcScale: 0.9,
    minRange: 35,
    maxRange: 380,
    landingRadius: 10,
  },

  charge: { maxTime: 1.4 },

  chaser: {
    radius: 22.5, hp: 12, speed: 60, contactDamage: 25,
  },

  shooter: {
    radius: 22.5, hp: 36, speed: 45,
    attackRange: 280,
    attackCooldown: 2.0,
    cooldownJitter: 0.25,
    aimDuration: 1.0,
    projectileRange: 300, // ignorado — range é dinâmico (= distância no disparo)
  },

  turret: {
    radius: 22.5, hp: 72,
    range: 320,
    attackCooldown: 2.0,
    cooldownJitter: 0.25,
    aimDuration: 1.0,
    projectileDamage: 5,
    projectileRange: 320,
  },

  spawn: {
    baseInterval: 4.0, minInterval: 2.0, accelPerSec: 0.02,
    minDistanceFromPlayer: 220, maxAttempts: 12,
  },

  session: { minDuration: 60, maxDuration: 180, defaultDuration: 90 },

  aim: {
    lineColor: 0xffe400,
    lineColorEnemy: 0xff2020,
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
    wreckDuration: 1.0,
    wreckDriftX: 14, wreckDriftY: 9, wreckScaleTo: 0.7,
  },

  healthBar: {
    // Inimigos / torretas
    enemyWidth: 48,
    enemyYOffset: 24,
    turretWidth: 48,
    turretYOffset: 24,
    // Player HUD (canto superior esquerdo)
    hudWidth: 200,
    hudHeight: 48,
    hudMargin: 16,
    // Limiares (razão de HP)
    greenThreshold: 0.5,      // inimigos/torretas: >50% verde
    amberThreshold: 0.15,     // 15–50% âmbar, <15% vermelho
    // Player: verde até 25%, vermelho de 25% a 1%, oculto em 0%
    playerRedThreshold: 0.25,
  },
} as const;

export const ISLANDS = [
  { x: 180, y: 140, w: 160, h: 120 },
  { x: 620, y: 380, w: 180, h: 140 },
  { x: 400, y: 260, w: 120, h: 90 },
] as const;

export const SHIP_COUNT = 24;

export const SHIP_INDEX = {
  playerHealthy:  1,   // ship_2.png
  playerDamaged:  7,   // ship_8.png
  playerCritical: 13,  // ship_14.png
  playerWreck:    19,  // ship_20.png

  chaserShip:     2,   // ship_3.png
  chaserWreck:    20,  // ship_21.png

  shooterShip:    3,   // ship_4.png
  shooterWreck:   21,  // ship_22.png
} as const;

export const SHIP_ROTATION_OFFSET = {
  playerWreck: 0, chaserWreck: 0, shooterWreck: 0,
} as const;