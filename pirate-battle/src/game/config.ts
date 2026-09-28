export const GAME_CONFIG = {
  arena: { width: 900, height: 600 },

  player: {
    radius: 18,
    speed: 140,
    rotationSpeed: 2.6,
    hp: 100,
    frontCooldown: 0.35,
    sideCooldown: 0.8,
  },

  projectile: {
    radius: 4,
    speed: 320,
    damage: 10,
    lifetime: 2.0,
    enemyDamage: 8,
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
} as const;