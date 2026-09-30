import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '../queryClient';
import { submitMatch } from '../api/client';
import Ranking from './Ranking';
import MatchHistory from './MatchHistory';
import type { GameSnapshot, RunConfig } from '../game/types';

interface Props {
  snapshot: GameSnapshot;
  runConfig: RunConfig;
  onPlayAgain: () => void;
  onMenu: () => void;
}

type Tab = 'ranking' | 'history';

export default function DeathScreen({ snapshot, runConfig, onPlayAgain, onMenu }: Props) {
  const [tab, setTab] = useState<Tab>('ranking');
  const submittedRef = useRef(false);

  const mutation = useMutation({
    mutationFn: () =>
      submitMatch({
        playerId: 'local',
        playerName: runConfig.playerName,
        score: snapshot.score,
        durationSec: Math.round(runConfig.sessionTime - snapshot.timeLeft),
        endReason: snapshot.endReason === 'time' ? 'time' : 'death',
        config: {
          sessionTime: runConfig.sessionTime,
          spawnInterval: runConfig.spawnInterval,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ranking'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="death-screen">
      <img
        src="/assets/png/default/ui/menu/title_pirate_battle.png"
        alt="Pirate Battle"
        className="death-logo"
      />

      <div className="death-panel">
        <div className="death-tabs">
          <button
            type="button"
            className={`tab-btn ${tab === 'ranking' ? 'active' : ''}`}
            onClick={() => setTab('ranking')}
          >
            Ranking
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            Match History
          </button>
        </div>

        <div className="death-tab-content">
          {tab === 'ranking' ? <Ranking /> : <MatchHistory />}
        </div>

        <div className="death-actions">
          <button className="btn-primary" onClick={onPlayAgain}>Play Again</button>
          <button className="btn-primary" onClick={onMenu}>Main Menu</button>
        </div>
      </div>
    </div>
  );
}