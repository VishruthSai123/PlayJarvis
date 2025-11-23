import React, { useState } from 'react';
import { Hand, X, MousePointer2, Move, Crosshair } from 'lucide-react';

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
    <div className="absolute top-4 right-4 z-40 w-80 bg-slate-950/90 backdrop-blur-md border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] p-1 text-slate-100 transition-all duration-300">
      <div className="border border-cyan-500/20 p-4">
        <div className="flex justify-between items-start mb-6 border-b border-cyan-500/30 pb-2">
          <h3 className="text-lg font-bold font-mono text-cyan-400 tracking-wider">
            CONTROLS_V2.5
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
              <h4 className="font-bold text-xs text-cyan-200 uppercase tracking-wide">Stable Tracking</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Cursor follows your <span className="text-white">palm direction</span>. You can wiggle fingers without moving the cursor.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-cyan-950 border border-cyan-700 text-pink-400">
              <Crosshair size={18} />
            </div>
            <div>
              <h4 className="font-bold text-xs text-pink-300 uppercase tracking-wide">Rigid Lock</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                <span className="text-pink-300">Pinch to Grab.</span> The object is now rigidly attached. To release, you must <span className="text-green-400">OPEN FINGERS WIDE</span> for 1 second.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-cyan-950 border border-cyan-700 text-amber-400">
              <Move size={18} />
            </div>
            <div>
              <h4 className="font-bold text-xs text-amber-300 uppercase tracking-wide">Velocity Throw</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Move hand quickly and open fingers to fling objects.
              </p>
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