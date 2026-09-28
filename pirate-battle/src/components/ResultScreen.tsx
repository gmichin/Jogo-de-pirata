import { useMutation } from '@tanstack/react-query';
import { queryClient } from '../queryClient';
import { submitMatch } from '../api/client';
import type { GameSnapshot, RunConfig } from '../game/types';

interface Props {
  snapshot: GameSnapshot;
  runConfig: RunConfig;
  onPlayAgain: () => void;
  onMenu: () => void;
}

export default function ResultScreen({ snapshot, runConfig, onPlayAgain, onMenu }: Props) {
  const mutation = useMutation({
    mutationFn: () =>
      submitMatch({
        playerId: 'local',
        playerName: 'You',
        score: snapshot.score,
        durationSec: runConfig.sessionTime - Math.ceil(snapshot.timeLeft),
        endReason: snapshot.endReason === 'time' ? 'time' : 'death',
        config: runConfig,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ranking'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });

  return (
    <div className="result">
      <h1>Game Over</h1>
      <p>Score: {snapshot.score}</p>
      <p>Time played: {Math.round(runConfig.sessionTime - snapshot.timeLeft)}s</p>
      <p>Reason: {snapshot.endReason}</p>

      {!mutation.isSuccess && !mutation.isPending && (
        <button onClick={() => mutation.mutate()}>Submit to ranking</button>
      )}
      {mutation.isPending && <p>Submitting…</p>}
      {mutation.isSuccess && <p>Recorded!</p>}
      {mutation.isError && (
        <p className="error">
          Failed to submit. <button onClick={() => mutation.mutate()}>Retry</button>
        </p>
      )}

      <div className="result-actions">
        <button onClick={onPlayAgain}>Play Again</button>
        <button onClick={onMenu}>Main Menu</button>
      </div>
    </div>
  );
}