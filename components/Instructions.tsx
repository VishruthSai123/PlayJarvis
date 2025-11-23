import React, { useState } from 'react';
import { Hand, X, MousePointer2, Move, Crosshair, Globe, Monitor } from 'lucide-react';

const Instructions: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="absolute top-4 right-4 z-40 bg-cyan-950/50 backdrop-blur p-2 rounded-none border border-cyan-500/50 text-cyan-300 hover:text-cyan-100 hover:bg-cyan-900/80 transition-all group"
      >
        <span className="sr-only">Help</span>
        <p className="font-mono font-bold px-2 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.5)]">INFO</p>
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-40 w-80 bg-slate-950/90 backdrop-blur-md border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] p-1 text-slate-100 transition-all duration-300 max-h-[90vh] overflow-y-auto">
      <div className="border border-cyan-500/20 p-4">
        <div className="flex justify-between items-start mb-6 border-b border-cyan-500/30 pb-2">
          <h3 className="text-lg font-bold font-mono text-cyan-400 tracking-wider">
            CONTROLS_V3.0
          </h3>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-cyan-700 hover:text-cyan-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 font-mono">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-cyan-950 border border-cyan-700 text-cyan-400">
              <Hand size={18} />
            </div>
            <div>
              <h4 className="font-bold text-xs text-cyan-200 uppercase tracking-wide">Tracking</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Cursor follows your <span className="text-white">palm</span>. Relax your fingers.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-cyan-950 border border-cyan-700 text-pink-400">
              <Crosshair size={18} />
            </div>
            <div>
              <h4 className="font-bold text-xs text-pink-300 uppercase tracking-wide">Grab & Move</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                <span className="text-pink-300">Pinch & Hold</span> to drag objects or windows.
              </p>
            </div>
          </div>
          
          <div className="p-3 bg-slate-900 border border-slate-700 rounded">
            <h4 className="font-bold text-xs text-yellow-300 uppercase tracking-wide mb-2 flex items-center gap-2">
                <Globe size={12}/> Browser Mode
            </h4>
            
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 bg-yellow-900/50 text-yellow-200 border border-yellow-700 rounded">TAP</span>
                    <p className="text-[10px] text-slate-400">Quickly pinch & release to click.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-200 border border-green-700 rounded">SCROLL</span>
                    <p className="text-[10px] text-slate-400">Tilt hand <span className="text-white">Up/Down</span> to scroll page.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/50 text-blue-200 border border-blue-700 rounded">TYPE</span>
                    <p className="text-[10px] text-slate-400">Tap anywhere on content to open Search Bar.</p>
                </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-3 border-t border-dashed border-cyan-900">
          <p className="text-[9px] text-cyan-700 text-center uppercase tracking-[0.2em]">
            System Ready // Neural Link Active
          </p>
        </div>
      </div>
    </div>
  );
};

export default Instructions;