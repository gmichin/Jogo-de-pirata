import { Assets, Texture } from 'pixi.js';
import { SHIP_COUNT } from './config';

export interface GameTextures {
  explosionLarge: Texture;
  explosionMedium: Texture;
  explosionSmall: Texture;
  fireLarge: Texture;
  fireSmall: Texture;
  cannonBall: Texture;
  ships: Texture[];      // 24 navios — índice 0 = ship_1.png
  destroyedShip: Texture;
}

let cached: GameTextures | null = null;
let inflight: Promise<GameTextures> | null = null;

export function getCachedTextures(): GameTextures | null {
  return cached;
}

export async function loadGameTextures(
  onProgress?: (loaded: number, total: number) => void
): Promise<GameTextures> {
  if (cached) return cached;
  if (inflight) return inflight;

  const shipPaths = Array.from(
    { length: SHIP_COUNT },
    (_, i) => `/assets/png/default/ships/ship_${i + 1}.png`
  );

  const manifest = {
    explosionLarge:  '/assets/png/default/effects/explosion_1.png',
    explosionMedium: '/assets/png/default/effects/explosion_2.png',
    explosionSmall:  '/assets/png/default/effects/explosion_3.png',
    fireLarge:       '/assets/png/default/effects/fire_1.png',
    fireSmall:       '/assets/png/default/effects/fire_2.png',
    cannonBall:      '/assets/png/default/ship_parts/cannon_ball.png',
    destroyedShip:   '/assets/png/default/ship_parts/hull_large_4.png',
  } as const;

  const all: Record<string, string> = { ...manifest };
  shipPaths.forEach((p, i) => { all[`ship_${i}`] = p; });

  const total = Object.keys(all).length;
  let loaded = 0;
  const loadedMap: Record<string, Texture> = {};

  inflight = (async () => {
    // Load sequential so we can report progress
    for (const [key, path] of Object.entries(all)) {
      try {
        loadedMap[key] = await Assets.load<Texture>(path);
      } catch (err) {
        console.error(`[assets] failed to load ${path}`, err);
        throw err;
      }
      loaded++;
      onProgress?.(loaded, total);
    }

    cached = {
      explosionLarge:  loadedMap.explosionLarge,
      explosionMedium: loadedMap.explosionMedium,
      explosionSmall:  loadedMap.explosionSmall,
      fireLarge:       loadedMap.fireLarge,
      fireSmall:       loadedMap.fireSmall,
      cannonBall:      loadedMap.cannonBall,
      destroyedShip:   loadedMap.destroyedShip,
      ships: Array.from({ length: SHIP_COUNT }, (_, i) => loadedMap[`ship_${i}`]),
    };
    inflight = null;
    return cached;
  })();

  return inflight;
}