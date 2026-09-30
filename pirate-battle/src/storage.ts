import type { GameSnapshot, RunConfig } from './game/types';
import { GAME_CONFIG } from './game/config';

const OPTS_KEY = 'pirate-battle:options';
const LAST_KEY = 'pirate-battle:last-result';

export function loadOptions(): RunConfig {
  const fallback: RunConfig = {
    sessionTime: GAME_CONFIG.session.defaultDuration,
    spawnInterval: GAME_CONFIG.spawn.baseInterval,
    shipIndex: 0,
    playerName: 'You',
  };
  try {
    const raw = localStorage.getItem(OPTS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);

    const name =
      typeof parsed.playerName === 'string' && parsed.playerName.trim().length > 0
        ? parsed.playerName.trim().slice(0, 20)
        : fallback.playerName;

    return {
      sessionTime: clamp(
        Number(parsed.sessionTime) || fallback.sessionTime,
        GAME_CONFIG.session.minDuration,
        GAME_CONFIG.session.maxDuration
      ),
      spawnInterval: Math.max(0.5, Number(parsed.spawnInterval) || fallback.spawnInterval),
      shipIndex: clamp(Math.floor(Number(parsed.shipIndex) || 0), 0, 23),
      playerName: name,
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