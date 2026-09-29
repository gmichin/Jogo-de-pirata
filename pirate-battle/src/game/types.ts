import type { Graphics } from 'pixi.js';

export type EnemyKind = 'chaser' | 'shooter';
export type ProjectileOwner = 'player' | 'enemy';
export type EndReason = 'time' | 'death' | 'abandoned' | null;
export type PlayerId = 1 | 2;

export interface Entity {
  gfx: Graphics;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface Player extends Entity {
  id: PlayerId;
  rotation: number;
  frontTimer: number;
  sideTimer: number;
  // Charge state (0..1) per weapon slot
  chargeFront: number;
  chargeLeft: number;
  chargeRight: number;
}

export interface Enemy extends Entity {
  kind: EnemyKind;
  rotation: number;
  speed: number;
  attackTimer: number;
}

export interface Turret extends Entity {
  rotation: number;
  attackTimer: number;
  islandIndex: number;
}

export interface Projectile {
  gfx: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  owner: ProjectileOwner;
  ownerId: PlayerId | null;
  // Distance traveled and total range before "falling"
  traveled: number;
  range: number;
  alive: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GameSnapshot {
  score: number;
  players: { id: PlayerId; hp: number; maxHp: number }[];
  timeLeft: number;
  running: boolean;
  paused: boolean;
  ended: boolean;
  endReason: EndReason;
}

export interface RunConfig {
  sessionTime: number;
  spawnInterval: number;
  players: 1 | 2;
}