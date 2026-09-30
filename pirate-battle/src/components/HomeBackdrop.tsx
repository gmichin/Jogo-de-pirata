import { useEffect, useRef } from 'react';
import { Backdrop } from '../game/Backdrop';
import { loadGameTextures } from '../game/assets';

/**
 * Monta a cena de fundo Pixi para a tela inicial.
 * Se as texturas falharem, apenas fica o fundo escuro.
 */
export default function HomeBackdrop() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let backdrop: Backdrop | null = null;

    loadGameTextures()
      .then((tex) => {
        if (cancelled || !hostRef.current) return;
        backdrop = new Backdrop(hostRef.current, tex.tileWater);
        backdrop.init().catch((err) => console.error('Backdrop init failed', err));
      })
      .catch((err) => {
        console.warn('Backdrop textures failed to load', err);
      });

    return () => {
      cancelled = true;
      backdrop?.destroy();
    };
  }, []);

  return <div className="home-backdrop" ref={hostRef} aria-hidden="true" />;
}