
import React, { useState, useRef, useEffect } from 'react';
import { CursorData, JarvisCommand } from '../types';
import { Plus, Maximize2, Minimize2, Mic, Search, Globe, X, Minus, RotateCw, Scaling } from 'lucide-react';
import JarvisAssistant from './JarvisAssistant';

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
      title: 'Google',
      url: 'https://www.google.com/webhp?igu=1',
      isMaximized: false,
      isCollapsed: false,
      zIndex: 10,
      inputValue: '',
      isListening: false,
      renderKey: 0
    }
  ]);
  
  const [maxZ, setMaxZ] = useState(10);
  const [ripples, setRipples] = useState<{id: number, x: number, y: number, double: boolean}[]>([]);
  const [isResizingState, setIsResizingState] = useState(false);
  const [isAnyInputActive, setIsAnyInputActive] = useState(false); 
  
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

  // Track active input state for Jarvis
  useEffect(() => {
    const active = tabs.some(t => t.isListening);
    setIsAnyInputActive(active);
  }, [tabs]);

  const bringToFront = (id: number) => {
      setTabs(prev => {
          const tab = prev.find(t => t.id === id);
          if (!tab || tab.zIndex === maxZ) return prev; // Already on top
          return prev.map(t => t.id === id ? { ...t, zIndex: maxZ + 1 } : t);
      });
      setMaxZ(prev => prev + 1);
  };

  const createTab = (url: string = 'https://www.google.com/webhp?igu=1', title: string = 'New Tab') => {
    const newId = Date.now();
    setTabs(prev => {
        const nextZ = maxZ + 1;
        // Offset new tabs slightly so they don't stack perfectly on top
        const offset = (prev.length % 5) * 30; 
        return [...prev, {
            id: newId,
            x: window.innerWidth * 0.1 + offset,
            y: window.innerHeight * 0.15 + offset,
            width: 800, height: 500,
            title: title, url: url,
            isMaximized: false, isCollapsed: false, zIndex: nextZ,
            inputValue: '', isListening: false, renderKey: 0
        }];
    });
    setMaxZ(z => z + 1);
  };

  const closeTab = (id: number) => setTabs(prev => prev.filter(t => t.id !== id));
  
  const toggleMaximize = (id: number) => {
    bringToFront(id);
    setTabs(prev => prev.map(t => t.id === id ? { ...t, isMaximized: !t.isMaximized, isCollapsed: false } : t));
  };

  const toggleCollapse = (id: number) => {
    bringToFront(id);
    setTabs(prev => prev.map(t => t.id === id ? { ...t, isCollapsed: !t.isCollapsed, isMaximized: false } : t));
  };

  const reloadTab = (id: number) => {
      setTabs(prev => prev.map(t => t.id === id ? { ...t, renderKey: t.renderKey + 1 } : t));
  };

  const startListening = (tabId: number) => {
    bringToFront(tabId);

    if (!('webkitSpeechRecognition' in window)) {
       const text = prompt("Enter Search Query / URL:");
       if (text) {
         const url = text.startsWith('http') ? text : `https://www.google.com/search?q=${encodeURIComponent(text)}&igu=1`;
         setTabs(prev => prev.map(t => t.id === tabId ? { 
            ...t, inputValue: text, 
            url: url,
            title: text,
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
      const url = `https://www.google.com/search?q=${encodeURIComponent(text)}&igu=1`;
      setTabs(prev => prev.map(t => t.id === tabId ? { 
          ...t, inputValue: text, isListening: false,
          url: url,
          title: text,
          renderKey: t.renderKey + 1
      } : t));
    };
    recognition.onerror = () => setTabs(prev => prev.map(t => t.id === tabId ? { ...t, isListening: false, inputValue: 'Error' } : t));
    recognition.onend = () => setTabs(prev => prev.map(t => t.id === tabId && t.isListening ? { ...t, isListening: false } : t));
    recognition.start();
  };

  // JARVIS COMMAND HANDLER - ATOMIC UPDATES
  const handleJarvisCommand = (cmd: JarvisCommand) => {
      console.log("Processing Command:", cmd);

      setTabs(currentTabs => {
        const nextZ = maxZ + 1; // Increment Z globally (side effect handled via effect or relaxed consistency here)
        
        const getTab = (idx?: number) => {
            if (idx !== undefined && idx !== null) {
                // strict mapping: tab 1 is index 0
                return currentTabs[idx - 1]; 
            }
            // default to active
            return [...currentTabs].sort((a,b) => b.zIndex - a.zIndex)[0];
        };

        const targetTab = getTab(cmd.targetIndex);

        switch(cmd.action) {
            case 'OPEN_TAB': {
                const newId = Date.now();
                const offset = (currentTabs.length % 5) * 30; 
                setMaxZ(z => z + 1); // safe side effect
                return [...currentTabs, {
                    id: newId,
                    x: window.innerWidth * 0.1 + offset,
                    y: window.innerHeight * 0.15 + offset,
                    width: 800, height: 500,
                    title: cmd.payload ? 'New Tab' : 'Google', 
                    url: cmd.payload || 'https://www.google.com/webhp?igu=1',
                    isMaximized: false, isCollapsed: false, zIndex: nextZ,
                    inputValue: '', isListening: false, renderKey: 0
                }];
            }
            case 'CLOSE_TAB':
                if (targetTab) return currentTabs.filter(t => t.id !== targetTab.id);
                return currentTabs;
            
            case 'SWITCH_TAB':
                if (targetTab) {
                    setMaxZ(z => z + 1);
                    return currentTabs.map(t => t.id === targetTab.id ? { ...t, zIndex: nextZ } : t);
                }
                return currentTabs;

            case 'MINIMIZE_TAB':
                if (targetTab) return currentTabs.map(t => t.id === targetTab.id ? { ...t, isCollapsed: true, isMaximized: false } : t);
                return currentTabs;
            
            case 'MAXIMIZE_TAB':
                if (targetTab) {
                    setMaxZ(z => z + 1);
                    return currentTabs.map(t => t.id === targetTab.id ? { ...t, isMaximized: true, isCollapsed: false, zIndex: nextZ } : t);
                }
                return currentTabs;

            case 'NAVIGATE':
                if (targetTab && cmd.payload) {
                    setMaxZ(z => z + 1);
                    return currentTabs.map(t => t.id === targetTab.id ? { 
                         ...t, inputValue: cmd.payload || '', url: cmd.payload || '', title: 'Loading...', renderKey: t.renderKey + 1, zIndex: nextZ 
                    } : t);
                } else if (!targetTab && cmd.payload) {
                    // Create if not found
                     const newId = Date.now();
                     setMaxZ(z => z + 1);
                     return [...currentTabs, {
                        id: newId, x: 100, y: 100, width: 800, height: 500,
                        title: 'New Tab', url: cmd.payload,
                        isMaximized: false, isCollapsed: false, zIndex: nextZ, inputValue: '', isListening: false, renderKey: 0
                     }];
                }
                return currentTabs;

            case 'SEARCH':
                if (cmd.payload) {
                   const url = `https://www.google.com/search?q=${encodeURIComponent(cmd.payload)}&igu=1`;
                   if (targetTab) {
                       setMaxZ(z => z + 1);
                       return currentTabs.map(t => t.id === targetTab.id ? { 
                            ...t, inputValue: cmd.payload || '', url, title: cmd.payload || 'Search', renderKey: t.renderKey + 1, zIndex: nextZ 
                       } : t);
                   } else {
                       const newId = Date.now();
                       setMaxZ(z => z + 1);
                       return [...currentTabs, {
                           id: newId, x: 100, y: 100, width: 800, height: 500,
                           title: cmd.payload || 'Search', url, isMaximized: false, isCollapsed: false, zIndex: nextZ, inputValue: '', isListening: false, renderKey: 0
                       }];
                   }
                }
                return currentTabs;
                
            case 'SCROLL_DOWN':
                window.scrollBy({ top: 300, behavior: 'smooth'}); 
                return currentTabs;
            case 'SCROLL_UP':
                window.scrollBy({ top: -300, behavior: 'smooth'});
                return currentTabs;
            default:
                return currentTabs;
        }
      });
  };

  const scrollIntervalRef = useRef<number | null>(null);
  useEffect(() => {
    if (!cursorData) return;
    if (Math.abs(cursorData.tilt) > 0.6) {
        if (!scrollIntervalRef.current) {
            scrollIntervalRef.current = window.setInterval(() => {
                const speed = cursorData.tilt * 30;
                // Attempt to scroll element under cursor
                const el = document.elementFromPoint(cursorData.x, cursorData.y);
                if (el) {
                    el.scrollBy({ top: speed, behavior: 'auto' });
                    // Try to send events to iframes if possible
                    el.dispatchEvent(new WheelEvent('wheel', { deltaY: speed * 2, bubbles: true }));
                    if (el.tagName === 'IFRAME') {
                        try { (el as HTMLIFrameElement).contentWindow?.focus(); } catch(e) {}
                    }
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

  // GESTURE HANDLER
  useEffect(() => {
    if (!cursorData) return;

    const { x, y, pinching, timestamp } = cursorData;
    const prev = pinchStateRef.current;
    let isClick = false;
    let isDoubleClick = false;

    // Detect Click (Release after short pinch)
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
      
      // Sort tabs by visual order (z-index) to interact with top-most first
      const sortedTabs = [...tabs].sort((a, b) => b.zIndex - a.zIndex);
      
      for (const tab of sortedTabs) {
        if (tab.isMaximized) continue;
        
        // RESIZE: Top Right Corner (60px hit area)
        const rx = tab.x + tab.width; const ry = tab.y;
        if (Math.hypot(x - rx, y - ry) < 60) {
             resizeRef.current = { tabId: tab.id, startX: x, startY: y, startW: tab.width, startH: tab.height, startTabY: tab.y };
             setIsResizingState(true);
             bringToFront(tab.id);
             break; 
        }

        // DRAG: Header
        if (x >= tab.x && x <= tab.x + tab.width && y >= tab.y && y <= tab.y + 48) {
          dragRef.current = { tabId: tab.id, startMouseX: x, startMouseY: y, initialTabX: tab.x, initialTabY: tab.y, isDragging: false };
          bringToFront(tab.id);
          break;
        }
      }
    } else if (!pinching) {
      pinchStateRef.current.wasPinching = false;
    }

    // Handle Resize
    if (pinching && resizeRef.current) {
        const { tabId, startX, startY, startW, startH, startTabY } = resizeRef.current;
        const dx = x - startX;
        const dy = y - startY;
        const newWidth = Math.max(300, startW + dx);
        const newHeight = Math.max(200, startH - dy); 
        const newY = startTabY + dy; 
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, width: newWidth, height: newHeight, y: newY } : t));
    }

    // Handle Drag
    if (pinching && dragRef.current) {
      const { tabId, startMouseX, startMouseY, initialTabX, initialTabY, isDragging } = dragRef.current;
      // Drag Deadzone
      if (!isDragging && Math.hypot(x - startMouseX, y - startMouseY) > 40) dragRef.current.isDragging = true;
      if (dragRef.current.isDragging) {
          setTabs(prev => prev.map(t => t.id === tabId ? { ...t, x: initialTabX + (x - startMouseX), y: initialTabY + (y - startMouseY) } : t));
      }
    }

    // Handle Clicks
    if (isClick || isDoubleClick) {
      setRipples(prev => [...prev, { id: Date.now(), x, y, double: isDoubleClick }]);
      setTimeout(() => setRipples(prev => prev.slice(1)), 600);

      const plusBtnRect = { x: window.innerWidth - 80, y: 30, w: 60, h: 60 };
      if (x >= plusBtnRect.x && x <= plusBtnRect.x + plusBtnRect.w && y >= plusBtnRect.y && y <= plusBtnRect.y + plusBtnRect.h) {
        createTab(); return;
      }

      // Check clicks on Tabs (Top-most first)
      const sortedTabs = [...tabs].sort((a, b) => b.zIndex - a.zIndex);
      for (const tab of sortedTabs) {
        const tx = tab.isMaximized ? 0 : tab.x;
        const ty = tab.isMaximized ? 0 : tab.y;
        const tw = tab.isMaximized ? window.innerWidth : tab.width;
        const th = (tab.isMaximized || !tab.isCollapsed) ? (tab.isMaximized ? window.innerHeight : tab.height) : 48;
        
        // Bounds check
        if (x >= tx && x <= tx + tw && y >= ty && y <= ty + th) {
             bringToFront(tab.id); // Click brings to front

             if (y <= ty + 48) {
                // Header Controls
                if (x > tx + tw - 40) { closeTab(tab.id); return; }
                if (x > tx + tw - 80) { toggleMaximize(tab.id); return; }
                if (x > tx + tw - 120) { toggleCollapse(tab.id); return; }
                if (x > tx + tw - 160) { reloadTab(tab.id); return; }
                
                // Address Bar Click
                const inputRect = { x: tx + 50, y: ty + 8, w: tw - 240, h: 32 };
                if (x >= inputRect.x && x <= inputRect.x + inputRect.w && y >= inputRect.y && y <= inputRect.y + inputRect.h) startListening(tab.id);
             } else {
                 // Content Click
                 // Try to simulate focus or click on native elements if possible
                 const el = document.elementFromPoint(x, y);
                 if (el) { (el as HTMLElement).click(); (el as HTMLElement).focus(); }
             }
             return; // Handled click on top-most tab, stop checking others
        }
      }
    }
  }, [cursorData, tabs, maxZ]);

  // Prepare Context for Jarvis
  // We strictly map Array Index + 1 to "Tab N" for human readability
  const jarvisContext = tabs.map((t, idx) => ({ 
      index: idx + 1, 
      title: t.title, 
      url: t.url, 
      active: t.zIndex === maxZ 
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* JARVIS INTEGRATION */}
      <JarvisAssistant 
         onCommand={handleJarvisCommand} 
         isInputActive={isAnyInputActive} 
         tabs={jarvisContext}
      />

      {ripples.map(r => (
          <div key={r.id} className={`absolute rounded-full border-2 z-[200] animate-[ping_0.6s_ease-out_forwards] ${r.double ? 'border-pink-400 bg-pink-400/20' : 'border-cyan-400 bg-cyan-400/20'}`} style={{ left: r.x - 25, top: r.y - 25, width: 50, height: 50 }} />
      ))}
      <div 
        className="absolute top-8 right-8 w-14 h-14 bg-cyan-900/80 border-2 border-cyan-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-transform duration-100 z-[60] pointer-events-auto cursor-pointer"
        style={{ transform: cursorData && Math.hypot(cursorData.x - (window.innerWidth - 53), cursorData.y - 57) < 40 ? 'scale(1.1)' : 'scale(1)' }}
        onClick={() => createTab()}
      >
        <Plus className="text-cyan-200 w-8 h-8" />
      </div>
      {tabs.map((tab, idx) => (
        <div
          key={tab.id}
          className={`absolute flex flex-col bg-slate-900 border border-cyan-500/50 shadow-2xl transition-all duration-75 pointer-events-auto ${tab.isMaximized ? 'inset-4 z-50' : 'rounded-lg'} ${isResizingState ? 'select-none' : ''}`}
          style={{ zIndex: tab.zIndex, left: tab.isMaximized ? 0 : tab.x, top: tab.isMaximized ? 0 : tab.y, width: tab.isMaximized ? '100%' : tab.width, height: (tab.isMaximized || !tab.isCollapsed) ? (tab.isMaximized ? '100%' : tab.height) : 48 }}
        >
          <div className={`h-12 bg-slate-800/90 border-b border-cyan-500/30 flex items-center px-4 gap-4 select-none ${tab.isMaximized ? '' : 'cursor-move'}`}>
             <div className="p-1.5 bg-cyan-950 rounded text-cyan-400 font-mono text-[10px] font-bold">
                TAB {String(idx + 1).padStart(2, '0')}
             </div>
             <div className="flex-1 h-8 bg-slate-950 border border-cyan-900 rounded flex items-center px-3 gap-2 relative group overflow-hidden cursor-pointer hover:bg-slate-900" onClick={() => startListening(tab.id)}>
                {tab.isListening ? <Mic size={14} className="text-red-400 animate-pulse"/> : <Search size={14} className="text-slate-500"/>}
                <span className="text-xs font-mono text-cyan-100 truncate w-full">{tab.isListening ? 'Listening...' : (tab.inputValue || tab.title)}</span>
                <span className="absolute right-2 text-[10px] text-slate-600 uppercase">Tap to Type</span>
             </div>
             <div className="flex items-center gap-1">
               {!tab.isMaximized && (
                   <div className="absolute -top-3 -right-3 p-4 text-cyan-400 hover:text-white cursor-ne-resize z-50 scale-75 opacity-80 hover:opacity-100" title="Pinch to Resize"><Scaling size={24} /></div>
               )}
               <div className="p-2 hover:bg-slate-700 rounded text-cyan-500 hover:text-cyan-300" onClick={() => reloadTab(tab.id)}><RotateCw size={16} /></div>
               <div className="p-2 hover:bg-slate-700 rounded text-cyan-500 hover:text-cyan-300" onClick={() => toggleCollapse(tab.id)}><Minus size={16} /></div>
               <div className="p-2 hover:bg-slate-700 rounded text-cyan-500 hover:text-cyan-300" onClick={() => toggleMaximize(tab.id)}>{tab.isMaximized ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</div>
               <div className="p-2 hover:bg-red-900/30 rounded text-red-500 hover:text-red-300 z-10" onClick={() => closeTab(tab.id)}><X size={16} /></div>
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