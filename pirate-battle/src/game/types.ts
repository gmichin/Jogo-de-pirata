import type { Graphics } from 'pixi.js';

export type EnemyKind = 'chaser' | 'shooter';
export type ProjectileOwner = 'player' | 'enemy';
export type EndReason = 'time' | 'death' | 'abandoned' | null;

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
  rotation: number;
  frontTimer: number;
  sideTimer: number;
}

export interface Enemy extends Entity {
  kind: EnemyKind;
  rotation: number;
  speed: number;
  attackTimer: number;
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
  life: number;
  alive: boolean;
}

export interface GameSnapshot {
  score: number;
  hp: number;
  maxHp: number;
  timeLeft: number;
  running: boolean;
  paused: boolean;
  ended: boolean;
  endReason: EndReason;
}

export interface RunConfig {
  sessionTime: number;
  spawnInterval: number;
}