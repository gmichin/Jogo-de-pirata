import type { GameSnapshot, RunConfig } from './game/types';
import { GAME_CONFIG } from './game/config';

const OPTS_KEY = 'pirate-battle:options';
const LAST_KEY = 'pirate-battle:last-result';

export function loadOptions(): RunConfig {
  const fallback: RunConfig = {
    sessionTime: GAME_CONFIG.session.defaultDuration,
    spawnInterval: GAME_CONFIG.spawn.defaultInterval,
    players: 1,
  };
  try {
    const raw = localStorage.getItem(OPTS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      sessionTime: clamp(
        Number(parsed.sessionTime) || fallback.sessionTime,
        GAME_CONFIG.session.minDuration,
        GAME_CONFIG.session.maxDuration
      ),
      spawnInterval: Math.max(0.5, Number(parsed.spawnInterval) || fallback.spawnInterval),
      players: parsed.players === 2 ? 2 : 1,
    };
  } catch {
    return fallback;
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