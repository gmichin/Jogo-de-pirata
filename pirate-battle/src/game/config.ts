export const GAME_CONFIG = {
  arena: { width: 900, height: 600 },

  player: {
    radius: 22,
    speed: 140,
    rotationSpeed: 2.6,
    hp: 100,
    frontCooldown: 0.25,
    sideCooldown: 0.6,
  },

  projectile: {
    radius: 5,
    speed: 340,
    damage: 12,
    enemyDamage: 10,
    arcScale: 0.9,
    minRange: 80,
    maxRange: 380,
    // Radius of the "landing" hit test — must land on/near the target
    landingRadius: 12,
  },

  charge: {
    // Seconds to reach full charge
    maxTime: 1.0,
  },

  chaser: {
    radius: 18,
    hp: 20,
    speed: 80,
    contactDamage: 25,
  },

  shooter: {
    radius: 18,
    hp: 30,
    speed: 55,
    attackRange: 280,
    attackCooldown: 1.0,      // fixo, 1s
    cooldownJitter: 0.15,     // dessincroniza
    projectileRange: 300,
  },

  turret: {
    radius: 14,
    hp: 40,
    range: 320,
    attackCooldown: 1.0,
    cooldownJitter: 0.2,
    projectileDamage: 12,
    projectileRange: 320,
  },

  spawn: {
    defaultInterval: 3.0,
    minDistanceFromPlayer: 220,
    maxAttempts: 12,
  },

  session: {
    minDuration: 60,
    maxDuration: 180,
    defaultDuration: 90,
  },

  aim: {
    lineColor: 0xfff6b0,
    lineColorEnemy: 0xff9a6b,
    maxDots: 12,
    dotSpacing: 18,
    targetCircleRadius: 8,
  },

  // HP-ratio thresholds for fire overlays (fires appear below the threshold)
  damageStates: [
    { maxHpRatio: 0.5,  fires: 1 },
    { maxHpRatio: 0.25, fires: 2 },
    { maxHpRatio: 0.1,  fires: 4 },
  ],

  destruction: {
    mediumExplosionDuration: 0.18,
    largeExplosionDuration: 0.28,
    wreckDuration: 0.5,
  },
} as const;

export const ISLANDS = [
  { x: 180, y: 140, w: 160, h: 120 },
  { x: 620, y: 380, w: 180, h: 140 },
  { x: 400, y: 260, w: 120, h: 90 },
] as const;

export const SHIP_COUNT = 24;