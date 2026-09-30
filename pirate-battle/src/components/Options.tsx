import { useState } from 'react';
import { GAME_CONFIG } from '../game/config';
import type { RunConfig } from '../game/types';
import { saveOptions } from '../storage';

interface Props {
  initial: RunConfig;
  onSave: (cfg: RunConfig) => void;
  onCancel: () => void;
}

const TIME_OPTIONS = [60, 90, 120, 150, 180] as const;

export default function Options({ initial, onSave, onCancel }: Props) {
  const [sessionTime, setSessionTime] = useState(initial.sessionTime);
  const [spawnInterval, setSpawnInterval] = useState(initial.spawnInterval);
  const [playerName, setPlayerName] = useState(initial.playerName);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!TIME_OPTIONS.includes(sessionTime as (typeof TIME_OPTIONS)[number])) {
      setError(`Session time must be one of: ${TIME_OPTIONS.join(', ')} seconds.`);
      return;
    }
    if (spawnInterval <= 0) {
      setError('Spawn interval must be greater than zero.');
      return;
    }
    const trimmed = playerName.trim();
    if (trimmed.length === 0) {
      setError('Please enter a captain name.');
      return;
    }

    const cfg: RunConfig = {
      sessionTime,
      spawnInterval,
      shipIndex: initial.shipIndex,
      playerName: trimmed.slice(0, 20),
    };
    saveOptions(cfg);
    onSave(cfg);
  };

  return (
    <div className="options">
      <h1>Options</h1>

      <label className="option-field">
        <span>Captain name</span>
        <input
          type="text"
          className="option-input"
          maxLength={20}
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Your captain name"
        />
      </label>

      <div className="option-field">
        <span>Game session time (s)</span>
        <div className="time-picker">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              className={`btn-primary time-btn ${sessionTime === t ? 'selected' : ''}`}
              onClick={() => setSessionTime(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <label className="option-field">
        <span>Initial enemy spawn time (s)</span>
        <input
          type="number"
          className="option-input"
          min={0.5}
          step={0.5}
          value={spawnInterval}
          onChange={(e) => setSpawnInterval(Number(e.target.value))}
        />
      </label>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="options-actions">
        <button className="btn-primary" onClick={handleSave}>Save</button>
        <button className="btn-primary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}