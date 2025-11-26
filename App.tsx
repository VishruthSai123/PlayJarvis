
import React, { useState, useRef } from 'react';
import GestureCanvas, { GestureCanvasRef } from './components/GestureCanvas';
import Instructions from './components/Instructions';
import BrowseScreen from './components/BrowseScreen';
import ObjectParamsPanel from './components/ObjectParamsPanel';
import { GameState, ScreenMode, CursorData, PlaygroundActivity, MechaObjectType, ThreeDObject } from './types';
import { LayoutGrid, Globe, Power, Loader2, Camera, AlertTriangle, ChevronDown, Bot, Shapes, Plus, Box, Sword, GlassWater, Circle, Cuboid } from 'lucide-react';

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.LOADING_MODEL);
  const [screenMode, setScreenMode] = useState<ScreenMode>('PLAYGROUND');
  const [playgroundActivity, setPlaygroundActivity] = useState<PlaygroundActivity>('SHAPES');
  const [isActivityMenuOpen, setIsActivityMenuOpen] = useState(false);
  const [isSpawnerOpen, setIsSpawnerOpen] = useState(false);
  const [selected3DObject, setSelected3DObject] = useState<ThreeDObject | null>(null);
  
  const [cursorData, setCursorData] = useState<CursorData | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  
  const canvasRef = useRef<GestureCanvasRef>(null);

  const spawn = (type: MechaObjectType) => {
      if (canvasRef.current) canvasRef.current.spawnMechaObject(type);
      setIsSpawnerOpen(false);
  };

  const handle3DUpdate = (obj: ThreeDObject) => {
      setSelected3DObject(obj);
      if (canvasRef.current) canvasRef.current.update3DObject(obj);
  };

  const handle3DDelete = (id: number) => {
      setSelected3DObject(null);
      if (canvasRef.current) canvasRef.current.delete3DObject(id);
  };

  const handle3DDuplicate = (obj: ThreeDObject) => {
      if (canvasRef.current) canvasRef.current.duplicate3DObject(obj);
  };

  const onSelectionChange = (id: number | null) => {
      if (id === null) setSelected3DObject(null);
      else {
          if (id) setSelected3DObject({ id, type: 'CUBE', x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1, color: '#F43F5E' });
          else setSelected3DObject(null);
      }
  };

  if (!hasStarted) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center text-cyan-500 font-mono">
        <div className="mb-8 relative">
           <div className="absolute inset-0 bg-cyan-500 blur-2xl opacity-20 animate-pulse"></div>
           <Power size={64} className="relative z-10" />
        </div>
        <h1 className="text-4xl font-bold tracking-tighter mb-2 text-white">NEURAL LINK</h1>
        <p className="text-slate-400 mb-8 text-sm uppercase tracking-widest">Gesture Interface System</p>
        <button onClick={() => setHasStarted(true)} className="group relative px-8 py-3 bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold tracking-wider hover:bg-cyan-900 transition-all overflow-hidden">
          <span className="relative z-10 group-hover:text-white transition-colors">INITIALIZE SYSTEM</span>
          <div className="absolute inset-0 bg-cyan-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        </button>
      </div>
    );
  }

  if (gameState === GameState.ERROR) {
    return (
      <div className="w-screen h-screen bg-red-950/20 flex flex-col items-center justify-center text-red-500 font-mono p-4 text-center">
        <AlertTriangle size={48} className="mb-4" />
        <h2 className="text-2xl font-bold mb-2">SYSTEM FAILURE</h2>
        <p className="max-w-md text-slate-300 mb-6">Could not access camera or load neural models.</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2 border border-red-500 hover:bg-red-900/50 text-red-300 transition-colors">REBOOT SYSTEM</button>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden select-none font-mono relative">
      {gameState !== GameState.RUNNING && (
        <div className="absolute inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center font-mono">
           {gameState === GameState.LOADING_MODEL && ( <><Loader2 size={40} className="text-cyan-400 animate-spin mb-4" /><p className="text-cyan-200 text-sm tracking-widest animate-pulse">LOADING NEURAL MODELS...</p></> )}
           {gameState === GameState.WAITING_PERMISSIONS && ( <><Camera size={40} className="text-yellow-400 animate-bounce mb-4" /><p className="text-yellow-200 text-sm tracking-widest">WAITING FOR CAMERA ACCESS...</p></> )}
        </div>
      )}

      <div className="absolute inset-0 z-0 pointer-events-none">
        {screenMode === 'PLAYGROUND' && (<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black opacity-100 transition-opacity duration-500"></div>)}
        {screenMode === 'BROWSE' && (<div className="absolute inset-0 bg-slate-950 transition-opacity duration-500"></div>)}
      </div>

      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-cyan-900/20 to-transparent pointer-events-none z-10"></div>
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-cyan-900/10 to-transparent pointer-events-none z-10"></div>
      
      {gameState === GameState.RUNNING && (
        <>
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex gap-4 bg-slate-900/80 p-1 rounded-full border border-cyan-500/30 backdrop-blur-md shadow-lg pointer-events-auto">
            <button onClick={() => setScreenMode('PLAYGROUND')} className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${screenMode === 'PLAYGROUND' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-cyan-300'}`}><LayoutGrid size={16} /><span className="text-xs font-bold tracking-wide">PLAYGROUND</span></button>
            <button onClick={() => setScreenMode('BROWSE')} className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${screenMode === 'BROWSE' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-cyan-300'}`}><Globe size={16} /><span className="text-xs font-bold tracking-wide">BROWSE</span></button>
          </div>

          {screenMode === 'PLAYGROUND' && (
              <div className="absolute top-4 right-20 z-40">
                  <button onClick={() => setIsActivityMenuOpen(!isActivityMenuOpen)} className="flex items-center gap-2 bg-cyan-950/50 backdrop-blur p-2 border border-cyan-500/50 text-cyan-300 hover:text-cyan-100 hover:bg-cyan-900/80 transition-all pointer-events-auto">
                     {playgroundActivity === 'SHAPES' ? <Shapes size={18}/> : (playgroundActivity === 'ROBOT' ? <Bot size={18}/> : <Cuboid size={18}/>)}
                     <span className="text-xs font-bold font-mono">
                         {playgroundActivity === 'SHAPES' ? 'GRAVITY' : (playgroundActivity === 'ROBOT' ? 'MECHA' : '3D STUDIO')}
                     </span>
                     <ChevronDown size={14} className={`transition-transform ${isActivityMenuOpen ? 'rotate-180' : ''}`}/>
                  </button>

                  {isActivityMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-40 bg-slate-950/90 border border-cyan-500/30 shadow-xl backdrop-blur-md flex flex-col p-1 gap-1 pointer-events-auto">
                          <button onClick={() => { setPlaygroundActivity('SHAPES'); setIsActivityMenuOpen(false); }} className={`flex items-center gap-2 p-2 text-xs font-mono font-bold hover:bg-cyan-900/50 text-left transition-colors ${playgroundActivity === 'SHAPES' ? 'text-cyan-300 bg-cyan-950' : 'text-slate-400'}`}><Shapes size={14} /> GRAVITY SHAPES</button>
                          <button onClick={() => { setPlaygroundActivity('ROBOT'); setIsActivityMenuOpen(false); }} className={`flex items-center gap-2 p-2 text-xs font-mono font-bold hover:bg-cyan-900/50 text-left transition-colors ${playgroundActivity === 'ROBOT' ? 'text-cyan-300 bg-cyan-950' : 'text-slate-400'}`}><Bot size={14} /> MECHA HAND</button>
                          <button onClick={() => { setPlaygroundActivity('STUDIO_3D'); setIsActivityMenuOpen(false); }} className={`flex items-center gap-2 p-2 text-xs font-mono font-bold hover:bg-cyan-900/50 text-left transition-colors ${playgroundActivity === 'STUDIO_3D' ? 'text-cyan-300 bg-cyan-950' : 'text-slate-400'}`}><Cuboid size={14} /> 3D STUDIO</button>
                      </div>
                  )}
              </div>
          )}

          {/* OBJECT PARAMS PANEL */}
          {screenMode === 'PLAYGROUND' && playgroundActivity === 'STUDIO_3D' && selected3DObject && (
              <ObjectParamsPanel 
                  object={selected3DObject} 
                  onUpdate={handle3DUpdate} 
                  onDelete={handle3DDelete} 
                  onDuplicate={handle3DDuplicate}
                  onClose={() => setSelected3DObject(null)}
              />
          )}
          
          {screenMode === 'PLAYGROUND' && playgroundActivity === 'ROBOT' && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex flex-col items-center gap-2">
                  {isSpawnerOpen && (
                      <div className="flex items-center gap-2 bg-slate-900/90 p-2 rounded-xl border border-cyan-500/50 backdrop-blur-md mb-2 animate-slide-up shadow-2xl">
                          <button onClick={() => spawn('KATANA')} className="p-3 hover:bg-cyan-900/50 rounded-lg flex flex-col items-center gap-1 group"><Sword className="text-pink-400 group-hover:scale-110 transition-transform" size={20}/><span className="text-[10px] text-pink-200 font-bold">KATANA</span></button>
                          <button onClick={() => spawn('BOTTLE')} className="p-3 hover:bg-cyan-900/50 rounded-lg flex flex-col items-center gap-1 group"><GlassWater className="text-blue-400 group-hover:scale-110 transition-transform" size={20}/><span className="text-[10px] text-blue-200 font-bold">BOTTLE</span></button>
                          <button onClick={() => spawn('BUCKET')} className="p-3 hover:bg-cyan-900/50 rounded-lg flex flex-col items-center gap-1 group"><Box className="text-yellow-400 group-hover:scale-110 transition-transform" size={20}/><span className="text-[10px] text-yellow-200 font-bold">BUCKET</span></button>
                          <button onClick={() => spawn('BALL')} className="p-3 hover:bg-cyan-900/50 rounded-lg flex flex-col items-center gap-1 group"><Circle className="text-green-400 group-hover:scale-110 transition-transform" size={20}/><span className="text-[10px] text-green-200 font-bold">BALL</span></button>
                      </div>
                  )}
                  <button onClick={() => setIsSpawnerOpen(!isSpawnerOpen)} className="w-14 h-14 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.6)] flex items-center justify-center transition-all hover:scale-110">
                      <Plus size={32} className={`transition-transform ${isSpawnerOpen ? 'rotate-45' : ''}`} />
                  </button>
              </div>
          )}

          <div className="absolute inset-0 z-20 pointer-events-none">
            {screenMode === 'PLAYGROUND' && <Instructions />}
            {screenMode === 'BROWSE' && <BrowseScreen cursorData={cursorData} />}
          </div>
        </>
      )}

      <div className="absolute inset-0 z-[100] pointer-events-none">
        <GestureCanvas 
          ref={canvasRef}
          onStateChange={setGameState} 
          mode={screenMode}
          playgroundActivity={playgroundActivity}
          onCursorUpdate={setCursorData}
          onSelectionChange={onSelectionChange}
        />
      </div>
    </div>
  );
}

export default App;