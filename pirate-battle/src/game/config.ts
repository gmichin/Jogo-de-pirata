export const GAME_CONFIG = {
  arena: { width: 900, height: 600 },

  player: {
    radius: 18,
    speed: 140,
    rotationSpeed: 2.6,
    hp: 100,
    frontCooldown: 0.25,
    sideCooldown: 0.6,
  },

  projectile: {
    radius: 4,
    speed: 340,
    damage: 10,
    enemyDamage: 8,
    // Projectile travels a fixed range based on charge (see player.charge)
    arcScale: 0.9,
    minRange: 60,
    maxRange: 380,
  },

  charge: {
    // Seconds to reach full charge
    maxTime: 1.2,
    // At zero charge, the range is minRange; at full charge, maxRange
  },

  chaser: {
    radius: 16,
    hp: 20,
    speed: 80,
    contactDamage: 25,
  },

  shooter: {
    radius: 16,
    hp: 30,
    speed: 50,
    attackRange: 260,
    attackCooldown: 1.6,
    projectileRange: 300,
  },

  turret: {
    radius: 20,
    hp: 40,
    range: 320,
    attackCooldown: 2.2,
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
    // Draw a preview line and circle
    lineColor: 0xfff6b0,
    lineColorEnemy: 0xff9a6b,
    maxDots: 12,
    dotSpacing: 18,
    targetCircleRadius: 8,
  },
} as const;

export const ISLANDS = [
  { x: 180, y: 140, w: 160, h: 120 },
  { x: 620, y: 380, w: 180, h: 140 },
  { x: 400, y: 260, w: 120, h: 90 },
] as const;