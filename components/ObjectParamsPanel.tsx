import React from 'react';
import { ThreeDObject } from '../types';
import { X, Copy, Trash2, Box, RefreshCw, Move3d } from 'lucide-react';

interface ObjectParamsPanelProps {
  object: ThreeDObject;
  onUpdate: (updated: ThreeDObject) => void;
  onDelete: (id: number) => void;
  onDuplicate: (obj: ThreeDObject) => void;
  onClose: () => void;
}

const ObjectParamsPanel: React.FC<ObjectParamsPanelProps> = ({ object, onUpdate, onDelete, onDuplicate, onClose }) => {
  
  const handleChange = (key: keyof ThreeDObject, value: any) => {
    onUpdate({ ...object, [key]: value });
  };

  const AxisInput = ({ label, val, k, step = 1 }: { label: string, val: number, k: keyof ThreeDObject, step?: number }) => (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[10px] text-cyan-500 font-mono w-4">{label}</span>
      <input 
        type="range" min={-200} max={200} step={step} value={val} 
        onChange={(e) => handleChange(k, parseFloat(e.target.value))}
        className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
      />
      <input 
         type="number" value={Math.round(val)} 
         onChange={(e) => handleChange(k, parseFloat(e.target.value))}
         className="w-10 bg-slate-900 border border-slate-700 text-[10px] text-right text-cyan-300 px-1"
      />
    </div>
  );

  return (
    <div className="absolute top-20 left-4 w-64 bg-slate-950/90 border border-cyan-500/30 backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.1)] p-3 rounded-lg z-[60] pointer-events-auto flex flex-col gap-3 font-mono animate-slide-right">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-cyan-900 pb-2">
        <div className="flex items-center gap-2 text-cyan-400">
           <Box size={14} />
           <span className="text-xs font-bold tracking-widest">OBJ_PARAM</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-red-400 transition-colors"><X size={14}/></button>
      </div>

      {/* TRANSFORM */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-wider mb-1"><Move3d size={10}/> Position</div>
        <AxisInput label="X" val={object.x} k="x" />
        <AxisInput label="Y" val={object.y} k="y" />
        <AxisInput label="Z" val={object.z} k="z" />
      </div>

      <div className="space-y-1 border-t border-cyan-900/50 pt-2">
        <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-wider mb-1"><RefreshCw size={10}/> Rotation</div>
        <AxisInput label="X" val={object.rotX} k="rotX" step={0.1} />
        <AxisInput label="Y" val={object.rotY} k="rotY" step={0.1} />
        <AxisInput label="Z" val={object.rotZ} k="rotZ" step={0.1} />
      </div>

      {/* COLOR */}
      <div className="border-t border-cyan-900/50 pt-2">
         <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Material</div>
         <div className="flex gap-2">
            {['#F43F5E', '#FACC15', '#34D399', '#22D3EE', '#A855F7', '#FFFFFF'].map(c => (
                <div 
                  key={c} 
                  onClick={() => handleChange('color', c)}
                  className={`w-6 h-6 rounded border cursor-pointer ${object.color === c ? 'border-white scale-110' : 'border-transparent opacity-60'}`}
                  style={{ backgroundColor: c }}
                />
            ))}
            <input type="color" value={object.color} onChange={(e) => handleChange('color', e.target.value)} className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer" />
         </div>
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-cyan-900/50">
        <button onClick={() => onDuplicate(object)} className="flex items-center justify-center gap-1 bg-slate-900 hover:bg-cyan-900/30 text-cyan-400 text-[10px] py-1.5 rounded border border-cyan-900 transition-colors">
            <Copy size={10} /> DUPLICATE
        </button>
        <button onClick={() => onDelete(object.id)} className="flex items-center justify-center gap-1 bg-slate-900 hover:bg-red-900/30 text-red-400 text-[10px] py-1.5 rounded border border-red-900 transition-colors">
            <Trash2 size={10} /> DELETE
        </button>
      </div>

    </div>
  );
};

export default ObjectParamsPanel;