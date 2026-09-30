import { useState } from 'react';
import HomeBackdrop from './HomeBackdrop';
import Ranking from './Ranking';
import MatchHistory from './MatchHistory';

interface Props {
  onPlay: () => void;
  onOptions: () => void;
}

type Tab = 'main' | 'ranking' | 'history';

export default function MainMenu({ onPlay, onOptions }: Props) {
  const [tab, setTab] = useState<Tab>('main');

  return (
    <div className="home-screen">
      <HomeBackdrop />

      <div className="home-content">
        <img
          src="/assets/png/default/ui/menu/title_pirate_battle.png"
          alt="Pirate Battle"
          className="title-image"
        />

        <div className="menu-panel">
          {tab === 'main' ? (
            <>
              <button className="btn-primary" onClick={onPlay}>Play</button>
              <button className="btn-primary" onClick={onOptions}>Options</button>
              <button className="btn-primary" onClick={() => setTab('ranking')}>Ranking</button>
              <button className="btn-primary" onClick={() => setTab('history')}>Match History</button>
            </>
          ) : (
            <>
              <h2 className="menu-tab-title">
                {tab === 'ranking' ? 'Ranking' : 'Match History'}
              </h2>
              <div className="tab-content">
                {tab === 'ranking' ? <Ranking /> : <MatchHistory />}
              </div>
              <button className="btn-primary" onClick={() => setTab('main')}>Back</button>
            </>
          )}
        </div>

        <div className="home-controls">
          <h2>Controls</h2>
          <ul>
            <li><b>W</b>: forward</li>
            <li><b>S</b>: backward</li>
            <li><b>A</b> / <b>D</b>: rotate</li>
            <li><b>Space</b> (hold): front shot</li>
            <li><b>Q</b> (hold): left shot</li>
            <li><b>E</b> (hold): right shot</li>
            <li><b>P</b> / <b>Esc</b>: pause</li>
          </ul>
        </div>
      </div>
    </div>
  );
}