import React, { useState, useRef, useEffect } from 'react';
import { CursorData } from '../types';
import { Plus, Maximize2, Minimize2, Mic, Search, Globe, X, Minus, RotateCw, Scaling } from 'lucide-react';

interface Tab {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  url: string;
  isMaximized: boolean;
  isCollapsed: boolean;
  zIndex: number;
  inputValue: string;
  isListening: boolean;
  renderKey: number;
}

interface BrowseScreenProps {
  cursorData: CursorData | null;
}

const BrowseScreen: React.FC<BrowseScreenProps> = ({ cursorData }) => {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: 1,
      x: window.innerWidth * 0.1,
      y: window.innerHeight * 0.2,
      width: 800,
      height: 500,
      title: 'Wikipedia',
      url: 'https://www.wikipedia.org',
      isMaximized: false,
      isCollapsed: false,
      zIndex: 1,
      inputValue: '',
      isListening: false,
      renderKey: 0
    }
  ]);
  
  const [maxZ, setMaxZ] = useState(1);
  const [ripples, setRipples] = useState<{id: number, x: number, y: number, double: boolean}[]>([]);
  const [isResizingState, setIsResizingState] = useState(false);
  
  const dragRef = useRef<{ tabId: number; startMouseX: number; startMouseY: number; initialTabX: number; initialTabY: number; isDragging: boolean; } | null>(null);
  const resizeRef = useRef<{ tabId: number; startX: number; startY: number; startW: number; startH: number; startTabY: number; } | null>(null);

  const pinchStateRef = useRef<{ 
    wasPinching: boolean; 
    pinchStartTime: number; 
    startX: number; 
    startY: number;
    lastClickTime: number;
  }>({
    wasPinching: false, pinchStartTime: 0, startX: 0, startY: 0, lastClickTime: 0
  });

  const createTab = () => {
    const newId = Date.now();
    setTabs(prev => [...prev, {
        id: newId,
        x: window.innerWidth * 0.15 + (prev.length * 40),
        y: window.innerHeight * 0.15 + (prev.length * 40),
        width: 800, height: 500,
        title: 'New Tab', url: 'https://www.wikipedia.org',
        isMaximized: false, isCollapsed: false, zIndex: maxZ + 1,
        inputValue: '', isListening: false, renderKey: 0
    }]);
    setMaxZ(z => z + 1);
  };

  const closeTab = (id: number) => setTabs(prev => prev.filter(t => t.id !== id));
  
  const toggleMaximize = (id: number) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, isMaximized: !t.isMaximized, isCollapsed: false, zIndex: maxZ + 1 } : t));
    setMaxZ(z => z + 1);
  };

  const toggleCollapse = (id: number) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, isCollapsed: !t.isCollapsed, isMaximized: false, zIndex: maxZ + 1 } : t));
    setMaxZ(z => z + 1);
  };

  const reloadTab = (id: number) => setTabs(prev => prev.map(t => t.id === id ? { ...t, renderKey: t.renderKey + 1 } : t));

  const startListening = (tabId: number) => {
    setTabs(t => t.map(ti => ti.id === tabId ? { ...ti, zIndex: maxZ + 1 } : ti));
    setMaxZ(z => z + 1);

    if (!('webkitSpeechRecognition' in window)) {
       const text = prompt("Enter Search Query / URL:");
       if (text) {
         // Wikipedia search fallback for better embed support
         const url = text.startsWith('http') ? text : `https://en.wikipedia.org/wiki/${encodeURIComponent(text)}`;
         setTabs(prev => prev.map(t => t.id === tabId ? { 
            ...t, inputValue: text, 
            url: url,
            renderKey: t.renderKey + 1
         } : t));
       }
       return;
    }

    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, isListening: true, inputValue: 'Listening...' } : t));
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(text)}`;
      setTabs(prev => prev.map(t => t.id === tabId ? { 
          ...t, inputValue: text, isListening: false,
          url: url,
          renderKey: t.renderKey + 1
      } : t));
    };
    recognition.onerror = () => setTabs(prev => prev.map(t => t.id === tabId ? { ...t, isListening: false, inputValue: 'Error' } : t));
    recognition.onend = () => setTabs(prev => prev.map(t => t.id === tabId && t.isListening ? { ...t, isListening: false } : t));
    recognition.start();
  };

  const scrollIntervalRef = useRef<number | null>(null);
  useEffect(() => {
    if (!cursorData) return;
    if (Math.abs(cursorData.tilt) > 0.6) {
        if (!scrollIntervalRef.current) {
            scrollIntervalRef.current = window.setInterval(() => {
                const speed = cursorData.tilt * 30;
                const el = document.elementFromPoint(cursorData.x, cursorData.y);
                if (el) {
                    el.scrollBy({ top: speed, behavior: 'auto' });
                    el.dispatchEvent(new WheelEvent('wheel', { deltaY: speed * 2, bubbles: true }));
                    if (el.tagName === 'IFRAME') (el as HTMLIFrameElement).contentWindow?.focus();
                }
                const key = speed > 0 ? 'ArrowDown' : 'ArrowUp';
                window.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true }));
            }, 50);
        }
    } else {
        if (scrollIntervalRef.current) { clearInterval(scrollIntervalRef.current); scrollIntervalRef.current = null; }
    }
    return () => { if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current); };
  }, [cursorData]);

  useEffect(() => {
    if (!cursorData) return;

    const { x, y, pinching, timestamp } = cursorData;
    const prev = pinchStateRef.current;
    let isClick = false;
    let isDoubleClick = false;

    if (prev.wasPinching && !pinching) {
      const duration = timestamp - prev.pinchStartTime;
      const moveDist = Math.hypot(x - prev.startX, y - prev.startY);
      
      if (duration < 800 && moveDist < 80) {
          if (!dragRef.current?.isDragging && !resizeRef.current) {
              isClick = true;
              if (timestamp - prev.lastClickTime < 500) {
                  isDoubleClick = true; isClick = false; 
              }
              prev.lastClickTime = timestamp;
          }
      }
      dragRef.current = null; resizeRef.current = null; setIsResizingState(false);
    }

    if (pinching && !prev.wasPinching) {
      pinchStateRef.current = { ...prev, wasPinching: true, pinchStartTime: timestamp, startX: x, startY: y };
      const sortedTabs = [...tabs].sort((a, b) => b.zIndex - a.zIndex);
      
      for (const tab of sortedTabs) {
        if (tab.isMaximized) continue;
        
        // RESIZE: Top Right Corner (60px hit area)
        const rx = tab.x + tab.width; const ry = tab.y;
        if (Math.hypot(x - rx, y - ry) < 60) {
             resizeRef.current = { tabId: tab.id, startX: x, startY: y, startW: tab.width, startH: tab.height, startTabY: tab.y };
             setIsResizingState(true);
             if(tab.zIndex !== maxZ) { setTabs(t => t.map(ti => ti.id === tab.id ? { ...ti, zIndex: maxZ + 1 } : ti)); setMaxZ(z => z + 1); }
             break; 
        }

        // DRAG: Header
        if (x >= tab.x && x <= tab.x + tab.width && y >= tab.y && y <= tab.y + 48) {
          dragRef.current = { tabId: tab.id, startMouseX: x, startMouseY: y, initialTabX: tab.x, initialTabY: tab.y, isDragging: false };
          if(tab.zIndex !== maxZ) { setTabs(t => t.map(ti => ti.id === tab.id ? { ...ti, zIndex: maxZ + 1 } : ti)); setMaxZ(z => z + 1); }
          break;
        }
      }
    } else if (!pinching) {
      pinchStateRef.current.wasPinching = false;
    }

    if (pinching && resizeRef.current) {
        const { tabId, startX, startY, startW, startH, startTabY } = resizeRef.current;
        const dx = x - startX;
        const dy = y - startY;
        // Dragging Top-Right: Width increases (dx), Height increases (dy inverted, actually Top decreases)
        const newWidth = Math.max(300, startW + dx);
        const newHeight = Math.max(200, startH - dy); 
        const newY = startTabY + dy; 
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, width: newWidth, height: newHeight, y: newY } : t));
    }

    if (pinching && dragRef.current) {
      const { tabId, startMouseX, startMouseY, initialTabX, initialTabY, isDragging } = dragRef.current;
      if (!isDragging && Math.hypot(x - startMouseX, y - startMouseY) > 40) dragRef.current.isDragging = true;
      if (dragRef.current.isDragging) {
          setTabs(prev => prev.map(t => t.id === tabId ? { ...t, x: initialTabX + (x - startMouseX), y: initialTabY + (y - startMouseY) } : t));
      }
    }

    if (isClick || isDoubleClick) {
      setRipples(prev => [...prev, { id: Date.now(), x, y, double: isDoubleClick }]);
      setTimeout(() => setRipples(prev => prev.slice(1)), 600);

      const plusBtnRect = { x: window.innerWidth - 80, y: 30, w: 60, h: 60 };
      if (x >= plusBtnRect.x && x <= plusBtnRect.x + plusBtnRect.w && y >= plusBtnRect.y && y <= plusBtnRect.y + plusBtnRect.h) {
        createTab(); return;
      }

      const sortedTabs = [...tabs].sort((a, b) => b.zIndex - a.zIndex);
      for (const tab of sortedTabs) {
        const tx = tab.isMaximized ? 0 : tab.x;
        const ty = tab.isMaximized ? 0 : tab.y;
        const tw = tab.isMaximized ? window.innerWidth : tab.width;
        const th = (tab.isMaximized || !tab.isCollapsed) ? (tab.isMaximized ? window.innerHeight : tab.height) : 48;
        
        if (x >= tx && x <= tx + tw && y >= ty && y <= ty + th) {
             if (y <= ty + 48) {
                if (x > tx + tw - 40) { closeTab(tab.id); return; }
                if (x > tx + tw - 80) { toggleMaximize(tab.id); return; }
                if (x > tx + tw - 120) { toggleCollapse(tab.id); return; }
                if (x > tx + tw - 160) { reloadTab(tab.id); return; }
                const inputRect = { x: tx + 50, y: ty + 8, w: tw - 240, h: 32 };
                if (x >= inputRect.x && x <= inputRect.x + inputRect.w && y >= inputRect.y && y <= inputRect.y + inputRect.h) startListening(tab.id);
             } else {
                 const el = document.elementFromPoint(x, y);
                 if (el) { (el as HTMLElement).click(); (el as HTMLElement).focus(); }
             }
             return; 
        }
      }
    }
  }, [cursorData, tabs, maxZ]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {ripples.map(r => (
          <div key={r.id} className={`absolute rounded-full border-2 z-[200] animate-[ping_0.6s_ease-out_forwards] ${r.double ? 'border-pink-400 bg-pink-400/20' : 'border-cyan-400 bg-cyan-400/20'}`} style={{ left: r.x - 25, top: r.y - 25, width: 50, height: 50 }} />
      ))}
      <div 
        className="absolute top-8 right-8 w-14 h-14 bg-cyan-900/80 border-2 border-cyan-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-transform duration-100 z-[60] pointer-events-auto cursor-pointer"
        style={{ transform: cursorData && Math.hypot(cursorData.x - (window.innerWidth - 53), cursorData.y - 57) < 40 ? 'scale(1.1)' : 'scale(1)' }}
      >
        <Plus className="text-cyan-200 w-8 h-8" />
      </div>
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`absolute flex flex-col bg-slate-900 border border-cyan-500/50 shadow-2xl transition-all duration-75 pointer-events-auto ${tab.isMaximized ? 'inset-4 z-50' : 'rounded-lg'} ${isResizingState ? 'select-none' : ''}`}
          style={{ zIndex: tab.zIndex, left: tab.isMaximized ? 0 : tab.x, top: tab.isMaximized ? 0 : tab.y, width: tab.isMaximized ? '100%' : tab.width, height: (tab.isMaximized || !tab.isCollapsed) ? (tab.isMaximized ? '100%' : tab.height) : 48 }}
        >
          <div className={`h-12 bg-slate-800/90 border-b border-cyan-500/30 flex items-center px-4 gap-4 select-none ${tab.isMaximized ? '' : 'cursor-move'}`}>
             <div className="p-1.5 bg-cyan-950 rounded text-cyan-400"><Globe size={16} /></div>
             <div className="flex-1 h-8 bg-slate-950 border border-cyan-900 rounded flex items-center px-3 gap-2 relative group overflow-hidden cursor-pointer hover:bg-slate-900" onClick={() => startListening(tab.id)}>
                {tab.isListening ? <Mic size={14} className="text-red-400 animate-pulse"/> : <Search size={14} className="text-slate-500"/>}
                <span className="text-xs font-mono text-cyan-100 truncate w-full">{tab.isListening ? 'Listening...' : (tab.inputValue || tab.title)}</span>
                <span className="absolute right-2 text-[10px] text-slate-600 uppercase">Tap to Type</span>
             </div>
             <div className="flex items-center gap-1">
               {!tab.isMaximized && (
                   <div className="absolute -top-3 -right-3 p-4 text-cyan-400 hover:text-white cursor-ne-resize z-50 scale-75 opacity-80 hover:opacity-100" title="Pinch to Resize"><Scaling size={24} /></div>
               )}
               <div className="p-2 hover:bg-slate-700 rounded text-cyan-500 hover:text-cyan-300"><RotateCw size={16} /></div>
               <div className="p-2 hover:bg-slate-700 rounded text-cyan-500 hover:text-cyan-300"><Minus size={16} /></div>
               <div className="p-2 hover:bg-slate-700 rounded text-cyan-500 hover:text-cyan-300">{tab.isMaximized ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</div>
               <div className="p-2 hover:bg-red-900/30 rounded text-red-500 hover:text-red-300 z-10"><X size={16} /></div>
             </div>
          </div>
          {!tab.isCollapsed && (
            <div className="flex-1 bg-white relative group w-full h-full">
              <iframe key={tab.renderKey} src={tab.url} className={`w-full h-full border-none pointer-events-auto ${isResizingState ? 'pointer-events-none' : ''}`} title={`Tab ${tab.id}`} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default BrowseScreen;