
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { JarvisStatus, JarvisCommand } from '../types';
import { Key, Mic, MicOff, AlertCircle, MessageSquare, Link } from 'lucide-react';

interface JarvisAssistantProps {
  onCommand: (cmd: JarvisCommand) => void;
  isInputActive: boolean; 
  tabs?: { index: number, title: string, url: string, active: boolean }[];
}

const JarvisAssistant: React.FC<JarvisAssistantProps> = ({ onCommand, isInputActive, tabs = [] }) => {
  const [status, setStatus] = useState<JarvisStatus>('IDLE');
  const [isMicActive, setIsMicActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Microphone blocked.");
  
  const [apiKey, setApiKey] = useState<string>(() => {
    return process.env.API_KEY || localStorage.getItem('GEMINI_API_KEY') || '';
  });
  const [serperKey, setSerperKey] = useState<string>(() => {
    return localStorage.getItem('SERPER_API_KEY') || '';
  });

  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [tempSerperKey, setTempSerperKey] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [assistantResponse, setAssistantResponse] = useState('');

  // Refs for State in Callbacks
  const recognitionRef = useRef<any>(null);
  const isMicActiveRef = useRef(false); 
  const statusRef = useRef<JarvisStatus>('IDLE');
  const apiKeyRef = useRef<string>(apiKey);
  const serperKeyRef = useRef<string>(serperKey);

  const onCommandRef = useRef(onCommand);
  const tabsRef = useRef(tabs);
  
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);

  const isSpeakingRef = useRef(false);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const ignoreNextEndRef = useRef(false);
  
  const sessionEndTimeRef = useRef<number>(0);
  const silenceTimerRef = useRef<any>(null);
  const historyRef = useRef<{role: 'user' | 'model', text: string}[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);
  useEffect(() => { serperKeyRef.current = serperKey; }, [serperKey]);

  useEffect(() => {
    return () => {
        isMicActiveRef.current = false;
        if (recognitionRef.current) recognitionRef.current.stop();
        if (synthRef.current) synthRef.current.cancel();
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  const extendSession = () => {
      sessionEndTimeRef.current = Date.now() + 180000; 
  };

  const initRecognition = () => {
    if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window)) return null;
    
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = true; 
    recognition.interimResults = true; 
    recognition.lang = 'en-US';

    recognition.onstart = () => {
         setPermissionDenied(false);
    };

    recognition.onresult = (event: any) => {
      if (isSpeakingRef.current || statusRef.current === 'PROCESSING' || statusRef.current === 'SPEAKING') return;

      const results = event.results;
      const result = results[results.length - 1];
      const transcript = result[0].transcript.trim().toLowerCase();
      
      setLastTranscript(transcript);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      const isSessionActive = Date.now() < sessionEndTimeRef.current;

      if (!isSessionActive && statusRef.current === 'IDLE') {
         const wakeWords = ['jarvis', 'harvest', 'service', 'travis', 'davis', 'javis', 'java', 'hey jarvis'];
         if (wakeWords.some(w => transcript.includes(w))) {
            recognition.stop(); 
            ignoreNextEndRef.current = true; 
            
            playBeep('WAKE');
            setAssistantResponse("I'm listening...");
            extendSession(); 
            return;
         }
      }

      if (isSessionActive || statusRef.current === 'LISTENING') {
          silenceTimerRef.current = setTimeout(() => {
              let cleanQuery = transcript;
              ['jarvis', 'hey jarvis'].forEach(w => {
                  cleanQuery = cleanQuery.replace(w, '').trim();
              });

              if (cleanQuery.length > 2) {
                recognition.stop();
                ignoreNextEndRef.current = true;
                handleUserQuery(cleanQuery);
              }
          }, 1200);
      }
    };

    recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setPermissionDenied(true);
            setErrorMessage("Permission denied. Check settings.");
            isMicActiveRef.current = false;
            setIsMicActive(false);
        }
    };

    recognition.onend = () => {
        if (ignoreNextEndRef.current) {
            ignoreNextEndRef.current = false;
            setTimeout(() => {
                 if (isMicActiveRef.current) {
                    try { recognition.start(); } catch(e) {}
                 }
            }, 50);
            return;
        }

        if (isMicActiveRef.current && !isSpeakingRef.current && statusRef.current !== 'PROCESSING' && !permissionDenied) {
            try { recognition.start(); } catch (e) { }
        } else {
            if (!isMicActiveRef.current) setIsMicActive(false);
        }
    };
    
    return recognition;
  };

  const handleMicClick = async () => {
      if (isMicActive) {
          isMicActiveRef.current = false;
          setIsMicActive(false);
          setStatus('IDLE');
          sessionEndTimeRef.current = 0; 
          if (recognitionRef.current) recognitionRef.current.stop();
      } else {
          setPermissionDenied(false);
          setErrorMessage("");
          
          try {
             if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Browser API missing");
             }
             const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
             stream.getTracks().forEach(t => t.stop()); 
          } catch (e: any) {
             setErrorMessage("Microphone access denied.");
             setPermissionDenied(true);
             return;
          }

          recognitionRef.current = initRecognition();
          if (!recognitionRef.current) {
             setErrorMessage("Speech API not supported.");
             setPermissionDenied(true);
             return;
          }

          isMicActiveRef.current = true;
          setIsMicActive(true);
          try { recognitionRef.current.start(); } catch (e) {
              setPermissionDenied(true);
              setIsMicActive(false);
          }
      }
  };

  const fetchSerperResult = async (query: string): Promise<string | null> => {
      if (!serperKeyRef.current) return null;
      try {
          const response = await fetch('https://google.serper.dev/search', {
              method: 'POST',
              headers: {
                  'X-API-KEY': serperKeyRef.current,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ q: query, num: 1 })
          });
          const data = await response.json();
          if (data.organic && data.organic.length > 0) {
              return data.organic[0].link;
          }
      } catch (e) {
          console.error("Serper API Error:", e);
      }
      return null;
  };

  const handleUserQuery = async (query: string) => {
    if (!apiKeyRef.current) {
        const msg = "I need an API key to function.";
        setAssistantResponse(msg);
        speak(msg, false);
        setStatus('IDLE');
        setShowKeyInput(true);
        return;
    }

    setStatus('PROCESSING');
    setAssistantResponse("Thinking...");
    
    try {
        const ai = new GoogleGenAI({ apiKey: apiKeyRef.current });
        
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 25000));
        
        const currentTabs = tabsRef.current;
        const tabContext = currentTabs.map(t => `[Tab ${t.index}: ${t.title} (${t.url})${t.active ? ' *ACTIVE*' : ''}]`).join('\n');
        const historyText = historyRef.current.slice(-6).map(h => `${h.role.toUpperCase()}: ${h.text}`).join('\n');
        
        const apiPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            config: {
                temperature: 0.7,
                maxOutputTokens: 250,
            },
            contents: `System: You are Jarvis, an AI browser assistant.
            INSTRUCTIONS:
            1. Respond naturally to the user.
            2. If an action is required, append a command block at the end using this EXACT format:
               *---{"action": "ACTION_NAME", "payload": "value", "targetIndex": number}---*
            3. Do NOT put the command block in code blocks. Just plain text at the end.
            4. Be concise (under 20 words).
            5. If user asks to "Open [Website]" or "Search [Topic]", use SEARCH action. I will handle the fetching.
            6. Use the Tab Context. If user says "Close Tab 2", ensure targetIndex is 2.
            
            ACTIONS: OPEN_TAB, CLOSE_TAB, SWITCH_TAB, MINIMIZE_TAB, MAXIMIZE_TAB, SEARCH, NAVIGATE, SCROLL_DOWN, SCROLL_UP, GO_HOME, STOP_LISTENING, NONE.
            
            CONTEXT:
            Current Tabs:
            ${tabContext || "No tabs open."}
            History:
            ${historyText}
            User Input: "${query}"`
        });

        const result: any = await Promise.race([apiPromise, timeoutPromise]);
        let rawText = result.text || "";
        
        let responseText = rawText;
        let commandData: JarvisCommand = { action: 'NONE' };

        const commandRegex = /\*---(.*?)---\*/s;
        const match = rawText.match(commandRegex);

        if (match) {
            try {
                commandData = JSON.parse(match[1]);
                responseText = rawText.replace(match[0], '').trim();
            } catch (e) {
                console.error("Failed to parse command JSON", e);
            }
        }

        if (commandData.action === 'SEARCH' && commandData.payload && serperKeyRef.current) {
            setAssistantResponse("Fetching link...");
            const directLink = await fetchSerperResult(commandData.payload);
            if (directLink) {
                commandData.action = 'NAVIGATE';
                commandData.payload = directLink;
                if (responseText.toLowerCase().includes("search")) {
                     responseText = `Opening ${directLink.replace('https://', '').split('/')[0]}...`;
                }
            }
        }

        historyRef.current = [
            ...historyRef.current, 
            { role: 'user' as const, text: query },
            { role: 'model' as const, text: responseText }
        ].slice(-10);

        if (commandData.action === 'STOP_LISTENING') {
            sessionEndTimeRef.current = 0; 
            playBeep('SUCCESS');
            setAssistantResponse("Going to sleep.");
            speak("Goodbye.", false);
            return;
        }

        playBeep('SUCCESS');
        
        if (commandData.action !== 'NONE') {
            onCommandRef.current(commandData); 
        }
        
        setAssistantResponse(responseText); 
        speak(responseText, false); 
        extendSession(); 

    } catch (err: any) {
        const msg = err.message === 'Timeout' ? "Network slow." : "I couldn't process that.";
        setAssistantResponse(msg);
        speak(msg, false);
        setStatus('IDLE');
    }
  };

  const speak = (text: string, expectResponse: boolean) => {
    if (!synthRef.current) return;
    
    if (recognitionRef.current) recognitionRef.current.abort();
    ignoreNextEndRef.current = true; 
    
    isSpeakingRef.current = true;
    setStatus('SPEAKING');
    
    synthRef.current.cancel(); 

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthRef.current.getVoices();
    const voice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('David') || v.name.toLowerCase().includes('male')) || voices[0];
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.pitch = 0.9; 
    
    utterance.onend = () => {
        isSpeakingRef.current = false;
        setStatus('IDLE'); 
        if (isMicActiveRef.current && !permissionDenied) {
            setTimeout(() => {
                if (recognitionRef.current) {
                    try { recognitionRef.current.start(); } catch(e) {}
                }
            }, 100);
        }
    };
    
    utterance.onerror = () => {
        isSpeakingRef.current = false;
        setStatus('IDLE');
    };

    synthRef.current.speak(utterance);
  };

  const playBeep = (type: 'WAKE' | 'SUCCESS') => {
      try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          if (type === 'WAKE') {
              osc.type = 'sine';
              osc.frequency.setValueAtTime(440, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
              gain.gain.setValueAtTime(0.1, ctx.currentTime);
              gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
          } else {
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(600, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
              gain.gain.setValueAtTime(0.1, ctx.currentTime);
              gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
          }
          osc.start(); osc.stop(ctx.currentTime + 0.2);
          setTimeout(() => ctx.close(), 250);
      } catch(e) {}
  };

  const saveKeys = () => {
      if(tempKey.trim().length > 0) {
          localStorage.setItem('GEMINI_API_KEY', tempKey);
          setApiKey(tempKey);
      }
      if(tempSerperKey.trim().length > 0) {
          localStorage.setItem('SERPER_API_KEY', tempSerperKey);
          setSerperKey(tempSerperKey);
      }
      setShowKeyInput(false);
      setAssistantResponse("Keys Saved.");
      speak("Connected.", false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const draw = () => {
       if (!ctx) return;
       ctx.clearRect(0, 0, canvas.width, canvas.height);
       
       const cx = canvas.width / 2;
       const cy = canvas.height / 2;
       const time = performance.now();
       
       const isSessionActive = Date.now() < sessionEndTimeRef.current;

       let color = '#334155';
       if (!apiKey) color = '#EF4444'; 
       else if (permissionDenied) color = '#EF4444'; 
       else if (!isMicActive) color = '#1e293b'; 
       else if (status === 'SPEAKING') color = '#22C55E'; 
       else if (status === 'PROCESSING') color = '#A855F7'; 
       else if (isSessionActive || status === 'LISTENING') color = '#06B6D4'; 
       else color = '#3B82F6'; 

       const pulse = isMicActive ? Math.sin(time / 200) * (status === 'LISTENING' || isSessionActive ? 4 : 2) : 0;
       const radius = 20 + pulse;

       const gradient = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 3);
       gradient.addColorStop(0, color);
       gradient.addColorStop(1, 'rgba(0,0,0,0)');
       ctx.fillStyle = gradient;
       ctx.beginPath(); ctx.arc(cx, cy, radius * 3, 0, Math.PI * 2); ctx.fill();

       ctx.fillStyle = '#fff';
       ctx.beginPath(); ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2); ctx.fill();

       ctx.strokeStyle = color;
       ctx.lineWidth = 2;
       ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
       
       animationFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [status, apiKey, isMicActive, permissionDenied]);

  return (
    <div className="fixed bottom-8 right-8 z-[200] flex flex-col items-end gap-2 pointer-events-auto">
       {permissionDenied && (
           <div className="bg-red-900/90 border border-red-500 text-red-100 text-xs px-3 py-2 rounded-lg mb-1 shadow-lg max-w-[200px]">
               <div className="flex items-center gap-2 font-bold mb-1"><AlertCircle size={14}/> Access Denied</div>
               <p className="leading-tight opacity-80">{errorMessage}</p>
           </div>
       )}

       {(assistantResponse || (isMicActive && status !== 'IDLE')) && (
           <div className="bg-slate-900/90 border border-cyan-500/40 px-4 py-2 rounded-2xl rounded-tr-none text-xs text-cyan-100 font-mono mb-2 max-w-[240px] shadow-lg animate-fade-in flex items-start gap-2">
               <MessageSquare size={14} className="mt-0.5 text-cyan-400 shrink-0"/>
               <div>
                 {status === 'LISTENING' && !assistantResponse ? (lastTranscript || 'Listening...') : (assistantResponse || status)}
               </div>
           </div>
       )}

       {showKeyInput && (
           <div className="bg-slate-900/95 border border-cyan-500/50 p-4 rounded-xl mb-2 w-72 shadow-2xl">
               <div className="text-cyan-400 text-xs font-bold mb-2 uppercase tracking-wider">Configure Neural Link</div>
               <input 
                 type="password" placeholder="Paste Gemini API Key" value={tempKey} onChange={(e) => setTempKey(e.target.value)}
                 className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-2 text-xs text-white mb-2 focus:border-cyan-500 outline-none transition-colors"
               />
               <div className="flex items-center gap-2 mb-2">
                 <Link size={12} className="text-slate-400"/>
                 <input 
                   type="password" placeholder="Serper API Key (Optional)" value={tempSerperKey} onChange={(e) => setTempSerperKey(e.target.value)}
                   className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-2 text-xs text-white focus:border-cyan-500 outline-none transition-colors"
                 />
               </div>
               <button onClick={saveKeys} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-2 rounded transition-colors">CONNECT SYSTEM</button>
           </div>
       )}

       <div className="flex items-center gap-4">
           {!isMicActive && !permissionDenied && !apiKey && (
                <div className="bg-red-900/90 text-xs text-red-200 px-2 py-1 rounded mr-2 pointer-events-none animate-pulse">
                    Setup Required
                </div>
           )}
           
           <div className="relative group cursor-pointer" onClick={handleMicClick}>
                <canvas ref={canvasRef} width={80} height={80} className={`w-14 h-14 transition-opacity ${isMicActive ? 'opacity-100' : 'opacity-60'}`} />
                {!isMicActive && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                        <MicOff size={20} />
                    </div>
                )}
           </div>

           <button onClick={() => setShowKeyInput(!showKeyInput)} className={`p-2 rounded-full border bg-slate-900 hover:bg-slate-800 transition-colors ${!apiKey ? 'border-red-500 text-red-500 animate-pulse' : 'border-slate-700 text-slate-500'}`}>
               <Key size={14} />
           </button>
       </div>
    </div>
  );
};

export default JarvisAssistant;