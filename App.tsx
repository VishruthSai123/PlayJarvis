import React, { useState } from 'react';
import GestureCanvas from './components/GestureCanvas';
import Instructions from './components/Instructions';
import { GameState } from './types';

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.LOADING_MODEL);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden select-none font-mono">
      
      {/* Main Canvas Layer */}
      <GestureCanvas onStateChange={setGameState} />
      
      {/* UI Overlay Layer */}
      {gameState === GameState.RUNNING && (
        <Instructions />
      )}
      
      {/* Decorative Background Elements */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-cyan-900/20 to-transparent pointer-events-none z-10"></div>
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-cyan-900/10 to-transparent pointer-events-none z-10"></div>
      
      <div className="absolute bottom-4 right-6 pointer-events-none opacity-40 z-10">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-t from-slate-800 to-slate-700 tracking-tighter uppercase opacity-20">
          NEURAL
        </h1>
      </div>
    </div>
  );
}

export default App;