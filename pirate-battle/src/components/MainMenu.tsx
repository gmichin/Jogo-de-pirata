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
          <li><b>W / ArrowUp</b>: move forward</li>
          <li><b>A / D</b> or <b>ArrowLeft / ArrowRight</b>: rotate</li>
          <li><b>Space</b>: front shot</li>
          <li><b>Q</b>: left side shot (3 parallel)</li>
          <li><b>E</b>: right side shot (3 parallel)</li>
          <li><b>P</b> or blur: pause</li>
        </ul>
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