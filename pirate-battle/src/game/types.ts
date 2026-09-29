import type { Container, Sprite } from 'pixi.js';

export type EnemyKind = 'chaser' | 'shooter';
export type ProjectileOwner = 'player' | 'enemy';
export type EndReason = 'time' | 'death' | 'abandoned' | null;
export type PlayerId = 1 | 2;

export interface Entity {
  gfx: Container;      // container holding ship sprite + fires
  ship: Sprite;
  fires: Sprite[];
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  shipIndex: number;   // 0..23
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
  rotation: number;
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
  players: 1 | 2;
  shipIndex: number; // 0..23 — navio escolhido pelo jogador
}