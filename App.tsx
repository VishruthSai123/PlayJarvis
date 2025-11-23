import React, { useState } from 'react';
import GestureCanvas from './components/GestureCanvas';
import Instructions from './components/Instructions';
import BrowseScreen from './components/BrowseScreen';
import { GameState, ScreenMode, CursorData } from './types';
import { LayoutGrid, Globe, Power, Loader2, Camera, AlertTriangle } from 'lucide-react';

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.LOADING_MODEL);
  const [screenMode, setScreenMode] = useState<ScreenMode>('PLAYGROUND');
  const [cursorData, setCursorData] = useState<CursorData | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // 1. START SCREEN (Browser Autoplay Policy)
  if (!hasStarted) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center text-cyan-500 font-mono">
        <div className="mb-8 relative">
           <div className="absolute inset-0 bg-cyan-500 blur-2xl opacity-20 animate-pulse"></div>
           <Power size={64} className="relative z-10" />
        </div>
        <h1 className="text-4xl font-bold tracking-tighter mb-2 text-white">NEURAL LINK</h1>
        <p className="text-slate-400 mb-8 text-sm uppercase tracking-widest">Gesture Interface System</p>
        
        <button 
          onClick={() => setHasStarted(true)}
          className="group relative px-8 py-3 bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold tracking-wider hover:bg-cyan-900 transition-all overflow-hidden"
        >
          <span className="relative z-10 group-hover:text-white transition-colors">INITIALIZE SYSTEM</span>
          <div className="absolute inset-0 bg-cyan-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        </button>
      </div>
    );
  }

  // 2. ERROR STATE
  if (gameState === GameState.ERROR) {
    return (
      <div className="w-screen h-screen bg-red-950/20 flex flex-col items-center justify-center text-red-500 font-mono p-4 text-center">
        <AlertTriangle size={48} className="mb-4" />
        <h2 className="text-2xl font-bold mb-2">SYSTEM FAILURE</h2>
        <p className="max-w-md text-slate-300 mb-6">
          Could not access camera or load neural models. Please ensure camera permissions are allowed and WebGL is supported.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 border border-red-500 hover:bg-red-900/50 text-red-300 transition-colors"
        >
          REBOOT SYSTEM
        </button>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden select-none font-mono relative">
      
      {/* 3. LOADING OVERLAYS */}
      {gameState !== GameState.RUNNING && (
        <div className="absolute inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center font-mono">
           {gameState === GameState.LOADING_MODEL && (
             <>
               <Loader2 size={40} className="text-cyan-400 animate-spin mb-4" />
               <p className="text-cyan-200 text-sm tracking-widest animate-pulse">LOADING NEURAL MODELS...</p>
             </>
           )}
           {gameState === GameState.WAITING_PERMISSIONS && (
             <>
               <Camera size={40} className="text-yellow-400 animate-bounce mb-4" />
               <p className="text-yellow-200 text-sm tracking-widest">WAITING FOR CAMERA ACCESS...</p>
               <p className="text-slate-500 text-xs mt-2">Please click "Allow" in your browser popup</p>
             </>
           )}
        </div>
      )}

      {/* 4. BACKGROUND LAYER */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {screenMode === 'PLAYGROUND' && (
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black opacity-100 transition-opacity duration-500"></div>
        )}
        {screenMode === 'BROWSE' && (
           <div className="absolute inset-0 bg-slate-950 transition-opacity duration-500"></div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-cyan-900/20 to-transparent pointer-events-none z-10"></div>
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-cyan-900/10 to-transparent pointer-events-none z-10"></div>
      
      {/* 5. UI CONTENT LAYER */}
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

          <div className="absolute inset-0 z-20">
            {screenMode === 'PLAYGROUND' && <Instructions />}
            {screenMode === 'BROWSE' && <BrowseScreen cursorData={cursorData} />}
          </div>
        </>
      )}

      {/* 6. CANVAS / CURSOR LAYER */}
      {/* Must be mounted to start camera, but z-index ensures it is on top */}
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