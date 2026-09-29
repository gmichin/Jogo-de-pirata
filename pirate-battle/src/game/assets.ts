import { Assets, Texture } from 'pixi.js';
import { SHIP_COUNT } from './config';

export interface GameTextures {
  // effects
  explosionLarge: Texture;
  explosionMedium: Texture;
  explosionSmall: Texture;
  fireLarge: Texture;
  fireSmall: Texture;
  // parts
  cannonBall: Texture;
  cannon: Texture;
  ships: Texture[];
  // tiles
  tileCannonPlatform: Texture;
  tileWater: Texture;
  // HUD
  healthFrame: Texture;
  healthFillGreen: Texture;
  healthFillAmber: Texture;
  healthFillRed: Texture;
  counterPanel: Texture;
  enemyHealthFillGreen: Texture;
  enemyHealthFillRed: Texture;
  iconHeart: Texture;
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
    explosionLarge:        '/assets/png/default/effects/explosion_1.png',
    explosionMedium:       '/assets/png/default/effects/explosion_2.png',
    explosionSmall:        '/assets/png/default/effects/explosion_3.png',
    fireLarge:             '/assets/png/default/effects/fire_1.png',
    fireSmall:             '/assets/png/default/effects/fire_2.png',
    cannonBall:            '/assets/png/default/ship_parts/cannon_ball.png',
    cannon:                '/assets/png/default/ship_parts/cannon.png',
    tileCannonPlatform:    '/assets/png/default/tiles/tile_13.png',
    tileWater:             '/assets/png/default/tiles/tile_73.png',
    healthFrame:           '/assets/png/default/ui/hud/health_frame.png',
    healthFillGreen:       '/assets/png/default/ui/hud/health_fill_green.png',
    healthFillAmber:       '/assets/png/default/ui/hud/health_fill_amber.png',
    healthFillRed:         '/assets/png/default/ui/hud/health_fill_red.png',
    counterPanel:          '/assets/png/default/ui/hud/counter_panel.png',
    enemyHealthFillGreen:  '/assets/png/default/ui/hud/enemy_health_fill_green.png',
    enemyHealthFillRed:    '/assets/png/default/ui/hud/enemy_health_fill_red.png',
    iconHeart:             '/assets/png/default/ui/hud/icon_heart.png',
  } as const;

  const all: Record<string, string> = { ...manifest };
  shipPaths.forEach((p, i) => { all[`ship_${i}`] = p; });

  const total = Object.keys(all).length;
  let loaded = 0;
  const loadedMap: Record<string, Texture> = {};

  inflight = (async () => {
    for (const [key, path] of Object.entries(all)) {
      try {
        loadedMap[key] = await Assets.load<Texture>(path);
      } catch (err) {
        console.error(`[assets] failed to load ${path}`, err);
        throw new Error(`Failed to load asset: ${path}`);
      }
      loaded++;
      onProgress?.(loaded, total);
    }

    cached = {
      explosionLarge:       loadedMap.explosionLarge,
      explosionMedium:      loadedMap.explosionMedium,
      explosionSmall:       loadedMap.explosionSmall,
      fireLarge:            loadedMap.fireLarge,
      fireSmall:            loadedMap.fireSmall,
      cannonBall:           loadedMap.cannonBall,
      cannon:               loadedMap.cannon,
      tileCannonPlatform:   loadedMap.tileCannonPlatform,
      tileWater:            loadedMap.tileWater,
      healthFrame:          loadedMap.healthFrame,
      healthFillGreen:      loadedMap.healthFillGreen,
      healthFillAmber:      loadedMap.healthFillAmber,
      healthFillRed:        loadedMap.healthFillRed,
      counterPanel:         loadedMap.counterPanel,
      enemyHealthFillGreen: loadedMap.enemyHealthFillGreen,
      enemyHealthFillRed:   loadedMap.enemyHealthFillRed,
      iconHeart:            loadedMap.iconHeart,
      ships: Array.from({ length: SHIP_COUNT }, (_, i) => loadedMap[`ship_${i}`]),
    };
    inflight = null;
    return cached;
  })();

  return inflight;
}