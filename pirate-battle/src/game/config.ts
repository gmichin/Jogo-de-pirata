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
    projectileRange: 300,
    contactDamage: 10,
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
    enemyWidth: 48,
    enemyYOffset: 24,
    turretWidth: 48,
    turretYOffset: 24,
    hudWidth: 200,
    hudHeight: 48,
    hudMargin: 16,
    greenThreshold: 0.5,
    amberThreshold: 0.15,
    playerRedThreshold: 0.25,
  },
};

export interface IslandSpec {
  xFrac: number;
  yFrac: number;
  wFrac: number;
  textureKey: 'island1' | 'island2';
  turrets: { xFrac: number; yFrac: number }[];
}

export const ISLAND_SPECS: IslandSpec[] = [
  {
    // Ilha 1 — canto superior esquerdo.
    xFrac: -0.02,
    yFrac: -0.02,
    wFrac: 0.40,
    textureKey: 'island1',
    turrets: [
      { xFrac: 0.58, yFrac: 0.55 },
      { xFrac: 0.92, yFrac: 0.55 },
    ],
  },
  {
    // Ilha 2 — canto inferior direito.
    xFrac: 0.60,
    yFrac: 0.55,
    wFrac: 0.40,
    textureKey: 'island2',
    turrets: [
      { xFrac: 0.11, yFrac: 0.47 },
      { xFrac: 0.62, yFrac: 0.47 },
    ],
  },
];

export const SHIP_COUNT = 24;

export const SHIP_INDEX = {
  playerHealthy:  1,
  playerDamaged:  7,
  playerCritical: 13,
  playerWreck:    19,

  chaserShip:     2,
  chaserWreck:    20,

  shooterShip:    3,
  shooterWreck:   21,
} as const;

export const SHIP_ROTATION_OFFSET = {
  playerWreck: 0, chaserWreck: 0, shooterWreck: 0,
} as const;