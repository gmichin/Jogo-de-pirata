import type { GameSnapshot, RunConfig } from './game/types';
import { GAME_CONFIG } from './game/config';

const OPTS_KEY = 'pirate-battle:options';
const LAST_KEY = 'pirate-battle:last-result';

export function loadOptions(): RunConfig {
  try {
    const raw = localStorage.getItem(OPTS_KEY);
    if (!raw) {
      return {
        sessionTime: GAME_CONFIG.session.defaultDuration,
        spawnInterval: GAME_CONFIG.spawn.defaultInterval,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      sessionTime: clamp(
        Number(parsed.sessionTime) || GAME_CONFIG.session.defaultDuration,
        GAME_CONFIG.session.minDuration,
        GAME_CONFIG.session.maxDuration
      ),
      spawnInterval: Math.max(0.5, Number(parsed.spawnInterval) || GAME_CONFIG.spawn.defaultInterval),
    };
  } catch {
    return {
      sessionTime: GAME_CONFIG.session.defaultDuration,
      spawnInterval: GAME_CONFIG.spawn.defaultInterval,
    };
  }
}

export function saveOptions(cfg: RunConfig) {
  localStorage.setItem(OPTS_KEY, JSON.stringify(cfg));
}

export function saveLastResult(snap: GameSnapshot, cfg: RunConfig) {
  localStorage.setItem(
    LAST_KEY,
    JSON.stringify({
      score: snap.score,
      timeLeft: snap.timeLeft,
      endReason: snap.endReason,
      cfg,
      at: new Date().toISOString(),
    })
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}