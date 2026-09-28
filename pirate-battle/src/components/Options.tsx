import { useState } from 'react';
import { GAME_CONFIG } from '../game/config';
import type { RunConfig } from '../game/types';
import { saveOptions } from '../storage';

interface Props {
  initial: RunConfig;
  onSave: (cfg: RunConfig) => void;
  onCancel: () => void;
}

export default function Options({ initial, onSave, onCancel }: Props) {
  const [sessionTime, setSessionTime] = useState(initial.sessionTime);
  const [spawnInterval, setSpawnInterval] = useState(initial.spawnInterval);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (
      sessionTime < GAME_CONFIG.session.minDuration ||
      sessionTime > GAME_CONFIG.session.maxDuration
    ) {
      setError(`Session time must be between ${GAME_CONFIG.session.minDuration} and ${GAME_CONFIG.session.maxDuration} seconds.`);
      return;
    }
    if (spawnInterval <= 0) {
      setError('Spawn interval must be greater than zero.');
      return;
    }
    const cfg: RunConfig = { sessionTime, spawnInterval };
    saveOptions(cfg);
    onSave(cfg);
  };

  return (
    <div className="options">
      <h1>Options</h1>

      <label>
        Game session time (s)
        <input
          type="number"
          min={GAME_CONFIG.session.minDuration}
          max={GAME_CONFIG.session.maxDuration}
          value={sessionTime}
          onChange={(e) => setSessionTime(Number(e.target.value))}
        />
      </label>

      <label>
        Enemy spawn time (s)
        <input
          type="number"
          min={0.5}
          step={0.5}
          value={spawnInterval}
          onChange={(e) => setSpawnInterval(Number(e.target.value))}
        />
      </label>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="options-actions">
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}