import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/Game';
import { loadGameTextures, type GameTextures } from '../game/assets';
import type { GameSnapshot, RunConfig } from '../game/types';

interface Props {
  runConfig: RunConfig;
  onEnd: (snap: GameSnapshot) => void;
  onQuit: () => void;
  onRestart: () => void;
}

export default function GameCanvas({ runConfig, onEnd, onQuit, onRestart }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const endedRef = useRef(false);

  // Refs para callbacks — evita recriar o Game a cada render do App
  const onEndRef = useRef(onEnd);
  const onQuitRef = useRef(onQuit);
  const onRestartRef = useRef(onRestart);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onQuitRef.current = onQuit; }, [onQuit]);
  useEffect(() => { onRestartRef.current = onRestart; }, [onRestart]);

  const [textures, setTextures] = useState<GameTextures | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setProgress(0);
    loadGameTextures((loaded, total) => {
      if (!cancelled) setProgress(loaded / total);
    })
      .then((t) => { if (!cancelled) setTextures(t); })
      .catch((err) => { if (!cancelled) setLoadError(String(err?.message ?? err)); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hostRef.current || !textures) return;
    let cancelled = false;
    endedRef.current = false;

    const game = new Game(
      hostRef.current,
      runConfig,
      textures,
      (snap) => {
        if (cancelled || endedRef.current) return;
        endedRef.current = true;
        onEndRef.current(snap);
      },
      () => onQuitRef.current(),
      () => onRestartRef.current(),
    );
    gameRef.current = game;

    game.init().catch((err) => console.error('Failed to init game', err));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        gameRef.current?.togglePause();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      game.destroy();
      gameRef.current = null;
    };
  }, [runConfig, textures]);

  if (loadError) {
    return (
      <div className="game-screen loading-screen">
        <p className="error" role="alert">Failed to load assets: {loadError}</p>
        <button onClick={onQuit}>Back to menu</button>
      </div>
    );
  }
  if (!textures) {
    return (
      <div className="game-screen loading-screen" aria-live="polite">
        <p>Loading assets… {Math.round(progress * 100)}%</p>
        <div className="progress"><div style={{ width: `${progress * 100}%` }} /></div>
      </div>
    );
  }

  return (
    <div className="game-screen">
      <div className="arena-host" ref={hostRef} />
    </div>
  );
}