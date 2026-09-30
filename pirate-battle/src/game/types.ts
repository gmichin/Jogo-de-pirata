import type { Container, Sprite } from 'pixi.js';

export type EnemyKind = 'chaser' | 'shooter';
export type ProjectileOwner = 'player' | 'enemy';
export type EndReason = 'time' | 'death' | 'abandoned' | null;
export type PlayerId = 1;

export interface Entity {
  gfx: Container;
  ship: Sprite;
  fires: Sprite[];
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  shipIndex: number;
  rotation: number;
}

export interface Player extends Entity {
  id: PlayerId;
  frontTimer: number;
  sideTimer: number;
  chargeFront: number;
  chargeLeft: number;
  chargeRight: number;
}

export interface Enemy extends Entity {
  kind: EnemyKind;
  speed: number;
  attackTimer: number;
  aimDirection: number;
  key: string;
}

export interface Turret {
  gfx: Container;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  aimDirection: number;
  attackTimer: number;
  islandIndex: number;
  cornerIndex: number;
  key: string;
}

export interface Projectile {
  gfx: Container;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  owner: ProjectileOwner;
  ownerId: PlayerId | null;
  traveled: number;
  range: number;
  flightTime: number;
  alive: boolean;
}

export interface Rect { x: number; y: number; w: number; h: number; }

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
  shipIndex: number;
  playerName: string;
}