import { useState } from 'react';
import MainMenu from './components/MainMenu';
import Options from './components/Options';
import GameCanvas from './components/GameCanvas';
import DeathScreen from './components/DeathScreen';
import { loadOptions, saveLastResult } from './storage';
import type { GameSnapshot, RunConfig } from './game/types';

type Screen = 'menu' | 'options' | 'game' | 'death';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [runConfig, setRunConfig] = useState<RunConfig>(() => loadOptions());
  const [result, setResult] = useState<GameSnapshot | null>(null);

  const startGame = (cfg: RunConfig) => {
    setRunConfig(cfg);
    setScreen('game');
  };

  const handleEnd = (snap: GameSnapshot) => {
    setResult(snap);
    saveLastResult(snap, runConfig);
    // Tanto vitória (time) quanto derrota (death) caem na mesma tela
    setScreen('death');
  };

  const handleRestart = () => {
    setRunConfig({ ...runConfig });
    setScreen('game');
  };

  return (
    <div className="app">
      {screen === 'menu' && (
        <MainMenu
          onPlay={() => startGame(loadOptions())}
          onOptions={() => setScreen('options')}
        />
      )}

      {screen === 'options' && (
        <Options
          initial={runConfig}
          onSave={(cfg) => { setRunConfig(cfg); setScreen('menu'); }}
          onCancel={() => setScreen('menu')}
        />
      )}

      {screen === 'game' && (
        <GameCanvas
          runConfig={runConfig}
          onEnd={handleEnd}
          onQuit={() => setScreen('menu')}
          onRestart={handleRestart}
        />
      )}

      {screen === 'death' && result && (
        <DeathScreen
          snapshot={result}
          runConfig={runConfig}
          onPlayAgain={() => startGame({ ...runConfig })}
          onMenu={() => setScreen('menu')}
        />
      )}

      <img
        src="/assets/logo_jungle_gaming.svg"
        alt="Jungle Gaming"
        className="app-logo"
      />
    </div>
  );
}