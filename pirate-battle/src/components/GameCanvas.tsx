import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/Game';
import type { GameSnapshot, RunConfig } from '../game/types';

interface Props {
  runConfig: RunConfig;
  onEnd: (snap: GameSnapshot) => void;
  onQuit: () => void;
}

export default function GameCanvas({ runConfig, onEnd, onQuit }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<GameSnapshot>({
    score: 0,
    players: Array.from({ length: runConfig.players }, (_, i) => ({
      id: (i + 1) as 1 | 2,
      hp: 100,
      maxHp: 100,
    })),
    timeLeft: runConfig.sessionTime,
    running: true,
    paused: false,
    ended: false,
    endReason: null,
  });
  const endedRef = useRef(false);

  useEffect(() => {
    if (!hostRef.current) return;
    let cancelled = false;

    const game = new Game(hostRef.current, runConfig, (snap) => {
      if (cancelled || endedRef.current) return;
      endedRef.current = true;
      onEnd(snap);
    });
    gameRef.current = game;

    game.init().catch((err) => console.error('Failed to init game', err));

    const interval = window.setInterval(() => {
      const g = gameRef.current;
      if (!g) return;
      setHud(g.getSnapshot());
    }, 200);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        gameRef.current?.togglePause();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('keydown', onKey);
      game.destroy();
      gameRef.current = null;
    };
  }, [runConfig, onEnd]);

  return (
    <div className="game-screen">
      <div className="hud" aria-live="polite">
        <span>Score: {hud.score}</span>
        {hud.players.map((p) => (
          <span key={p.id} className={`hp hp-p${p.id}`}>
            P{p.id} HP: {p.hp}
          </span>
        ))}
        <span>Time: {Math.ceil(hud.timeLeft)}s</span>
        {hud.paused && <span className="paused">PAUSED - press P to resume</span>}
      </div>

      <div className="arena-host" ref={hostRef} />

      <div className="touch-controls">
        <button
          aria-label="P1 rotate left"
          onPointerDown={() => dispatchKey('a', true)}
          onPointerUp={() => dispatchKey('a', false)}
          onPointerLeave={() => dispatchKey('a', false)}
        >↺</button>
        <button
          aria-label="P1 move forward"
          onPointerDown={() => dispatchKey('w', true)}
          onPointerUp={() => dispatchKey('w', false)}
          onPointerLeave={() => dispatchKey('w', false)}
        >▲</button>
        <button
          aria-label="P1 rotate right"
          onPointerDown={() => dispatchKey('d', true)}
          onPointerUp={() => dispatchKey('d', false)}
          onPointerLeave={() => dispatchKey('d', false)}
        >↻</button>
        <button
          aria-label="P1 front shot (hold to charge)"
          onPointerDown={() => dispatchKey('2', true)}
          onPointerUp={() => dispatchKey('2', false)}
        >Fire</button>
        <button
          aria-label="P1 left shot (hold to charge)"
          onPointerDown={() => dispatchKey('q', true)}
          onPointerUp={() => dispatchKey('q', false)}
        >L</button>
        <button
          aria-label="P1 right shot (hold to charge)"
          onPointerDown={() => dispatchKey('e', true)}
          onPointerUp={() => dispatchKey('e', false)}
        >R</button>
      </div>

      <button className="quit" onClick={onQuit}>Quit</button>
    </div>
  );
}

function dispatchKey(key: string, down: boolean) {
  const evt = new KeyboardEvent(down ? 'keydown' : 'keyup', { key });
  window.dispatchEvent(evt);
}