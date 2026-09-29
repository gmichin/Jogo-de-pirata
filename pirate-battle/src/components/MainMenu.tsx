import { useState } from 'react';
import Ranking from './Ranking';
import MatchHistory from './MatchHistory';

interface Props {
  onPlay: () => void;
  onOptions: () => void;
}

export default function MainMenu({ onPlay, onOptions }: Props) {
  const [tab, setTab] = useState<'ranking' | 'history'>('ranking');

  return (
    <div className="menu">
      <h1>Pirate Battle</h1>
      <div className="menu-actions">
        <button onClick={onPlay}>Play</button>
        <button onClick={onOptions}>Options</button>
      </div>

      <section className="controls-help">
        <h2>Controls</h2>
        <ul>
          <li><b>W</b>: forward</li>
          <li><b>S</b>: backward</li>
          <li><b>A</b> / <b>D</b>: rotate</li>
          <li><b>Space</b> (hold): front shot</li>
          <li><b>Q</b> (hold): left shot</li>
          <li><b>E</b> (hold): right shot</li>
        </ul>
        <p className="controls-note">
          Hold the shot key to increase range. Release to fire. <b>P</b> or <b>Esc</b> pauses.
        </p>
      </section>

      <div className="tabs">
        <button className={tab === 'ranking' ? 'active' : ''} onClick={() => setTab('ranking')}>
          Ranking
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          Match History
        </button>
      </div>

      {tab === 'ranking' ? <Ranking /> : <MatchHistory />}
    </div>
  );
}