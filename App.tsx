import React, { useState } from 'react';
import GestureCanvas from './components/GestureCanvas';
import Instructions from './components/Instructions';
import BrowseScreen from './components/BrowseScreen';
import { GameState, ScreenMode, CursorData } from './types';
import { LayoutGrid, Globe } from 'lucide-react';

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.LOADING_MODEL);
  const [screenMode, setScreenMode] = useState<ScreenMode>('PLAYGROUND');
  const [cursorData, setCursorData] = useState<CursorData | null>(null);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden select-none font-mono relative">
      
      {/* 1. BACKGROUND LAYER (Lowest) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Playground Background: Dark Radial Gradient */}
        {screenMode === 'PLAYGROUND' && (
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black opacity-100 transition-opacity duration-500"></div>
        )}
        {/* Browse Background: Slate color */}
        {screenMode === 'BROWSE' && (
           <div className="absolute inset-0 bg-slate-950 transition-opacity duration-500"></div>
        )}
      </div>

      {/* Decorative Gradients (Visible on both) */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-cyan-900/20 to-transparent pointer-events-none z-10"></div>
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-cyan-900/10 to-transparent pointer-events-none z-10"></div>
      
      {/* 2. UI CONTENT LAYER (Middle) */}
      {gameState === GameState.RUNNING && (
        <>
          {/* Screen Switcher */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex gap-4 bg-slate-900/80 p-1 rounded-full border border-cyan-500/30 backdrop-blur-md shadow-lg shadow-cyan-500/10 pointer-events-auto">
            <button 
              onClick={() => setScreenMode('PLAYGROUND')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${screenMode === 'PLAYGROUND' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-cyan-300'}`}
            >
              <LayoutGrid size={16} />
              <span className="text-xs font-bold tracking-wide">PLAYGROUND</span>
            </button>
            <button 
              onClick={() => setScreenMode('BROWSE')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${screenMode === 'BROWSE' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-cyan-300'}`}
            >
              <Globe size={16} />
              <span className="text-xs font-bold tracking-wide">BROWSE</span>
            </button>
          </div>

          {/* Screens */}
          <div className="absolute inset-0 z-20">
            {screenMode === 'PLAYGROUND' && (
               <Instructions />
            )}

            {screenMode === 'BROWSE' && (
               <BrowseScreen cursorData={cursorData} />
            )}
          </div>
        </>
      )}

      {/* Background Branding */}
      <div className="absolute bottom-4 right-6 pointer-events-none opacity-40 z-10">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-t from-slate-800 to-slate-700 tracking-tighter uppercase opacity-20">
          NEURAL
        </h1>
      </div>

      {/* 3. CANVAS / CURSOR LAYER (Topmost) */}
      {/* pointer-events-none ensures the canvas doesn't block mouse interactions with the browser if mouse is used */}
      <div className="absolute inset-0 z-[100] pointer-events-none">
        <GestureCanvas 
          onStateChange={setGameState} 
          mode={screenMode}
          onCursorUpdate={setCursorData} 
        />
      </div>

    </div>
  );
}

export default App;