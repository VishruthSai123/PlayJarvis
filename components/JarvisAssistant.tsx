
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { JarvisStatus, JarvisCommand } from '../types';
import { Key, Mic, MicOff, AlertCircle } from 'lucide-react';

interface JarvisAssistantProps {
  onCommand: (cmd: JarvisCommand) => void;
  isInputActive: boolean; 
}

const JarvisAssistant: React.FC<JarvisAssistantProps> = ({ onCommand, isInputActive }) => {
  const [status, setStatus] = useState<JarvisStatus>('IDLE');
  const [isMicActive, setIsMicActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Microphone blocked.");
  
  const [apiKey, setApiKey] = useState<string>(() => {
    return process.env.API_KEY || localStorage.getItem('GEMINI_API_KEY') || '';
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');

  // Refs for State in Callbacks
  const recognitionRef = useRef<any>(null);
  const isMicActiveRef = useRef(false); // Track intended state
  const statusRef = useRef<JarvisStatus>('IDLE');
  const apiKeyRef = useRef<string>(apiKey);
  const isSpeakingRef = useRef(false);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const ignoreNextEndRef = useRef(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);

  // --- CLEANUP ---
  useEffect(() => {
    return () => {
        isMicActiveRef.current = false;
        if (recognitionRef.current) recognitionRef.current.stop();
        if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  const initRecognition = () => {
    if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window)) return null;
    
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = true; 
    recognition.interimResults = true; 
    recognition.lang = 'en-US';

    recognition.onstart = () => {
         console.log("Mic Started Successfully");
         setPermissionDenied(false);
    };

    recognition.onresult = (event: any) => {
      // Ignore if speaking or processing
      if (isSpeakingRef.current || statusRef.current === 'PROCESSING' || statusRef.current === 'SPEAKING') return;

      const results = event.results;
      const result = results[results.length - 1];
      const transcript = result[0].transcript.trim().toLowerCase();
      const isFinal = result.isFinal;
      
      setLastTranscript(transcript);

      if (statusRef.current === 'IDLE') {
         // Wake Word Detection
         const wakeWords = ['jarvis', 'harvest', 'service', 'travis', 'davis', 'javis', 'java', 'hey jarvis'];
         if (wakeWords.some(w => transcript.includes(w))) {
            recognition.stop(); // Stop to reset for command
            ignoreNextEndRef.current = true; // Don't trigger auto-restart logic yet, we handle it
            setStatus('LISTENING');
            playBeep('WAKE');
            // Restart immediately in listening mode (handled by function flow usually, but here we just wait for onend to restart if we want)
            // Actually, for continuous: we just change state. But to ensure clean buffer, we stop & start.
         }
      } else if (statusRef.current === 'LISTENING' && isFinal) {
          recognition.stop();
          ignoreNextEndRef.current = true;
          handleUserQuery(transcript);
      }
    };

    recognition.onerror = (event: any) => {
        console.warn("Speech Error:", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setPermissionDenied(true);
            setErrorMessage("Permission denied. Check settings.");
            isMicActiveRef.current = false;
            setIsMicActive(false);
        } else if (event.error === 'no-speech') {
            // Normal, just ignore
        } else {
             // Other errors like network
             // Don't auto-stop for everything, but log it
        }
    };

    recognition.onend = () => {
        if (ignoreNextEndRef.current) {
            ignoreNextEndRef.current = false;
            // If we stopped intentionally to process/switch state, we might want to restart?
            // Actually handleUserQuery will handle the restart after processing.
            // If we just stopped to clear buffer (wake word), restart now:
            if (statusRef.current === 'LISTENING') {
                try { recognition.start(); } catch(e) {}
            }
            return;
        }

        // SMART RESTART
        if (isMicActiveRef.current && !isSpeakingRef.current && statusRef.current !== 'PROCESSING' && !permissionDenied) {
            console.log("Auto-restarting Mic...");
            try {
                recognition.start();
            } catch (e) {
                console.log("Restart failed", e);
            }
        } else {
            if (!isMicActiveRef.current) setIsMicActive(false);
        }
    };
    
    return recognition;
  };

  const handleMicClick = async () => {
      if (isMicActive) {
          // STOP
          isMicActiveRef.current = false;
          setIsMicActive(false);
          setStatus('IDLE');
          if (recognitionRef.current) recognitionRef.current.stop();
      } else {
          // START
          setPermissionDenied(false);
          setErrorMessage("");
          
          // 1. Warm up permissions via getUserMedia (Robust Fix)
          try {
             if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Browser API missing or insecure context");
             }
             const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
             stream.getTracks().forEach(t => t.stop()); // Close immediately
          } catch (e: any) {
             console.error("Microphone Init Failed", e);
             let msg = "Microphone blocked.";
             if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
                 msg = "No microphone detected.";
             } else if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                 msg = "Permission denied. Allow in settings.";
             } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
                 msg = "Mic busy/hardware error.";
             } else {
                 msg = e.message || "Microphone access error.";
             }
             setErrorMessage(msg);
             setPermissionDenied(true);
             return;
          }

          // 2. Initialize fresh instance
          recognitionRef.current = initRecognition();
          if (!recognitionRef.current) {
             setErrorMessage("Speech API not supported.");
             setPermissionDenied(true);
             return;
          }

          // 3. Start
          isMicActiveRef.current = true;
          setIsMicActive(true);
          try {
              recognitionRef.current.start();
          } catch (e) {
              console.error("Recognition Start Failed", e);
              setPermissionDenied(true);
              setErrorMessage("Failed to start speech engine.");
              setIsMicActive(false);
              isMicActiveRef.current = false;
          }
      }
  };

  const handleUserQuery = async (query: string) => {
    if (!apiKeyRef.current) {
        speak("I need an API key to function.", false);
        setStatus('IDLE');
        setShowKeyInput(true);
        return;
    }

    setStatus('PROCESSING');
    
    try {
        const ai = new GoogleGenAI({ apiKey: apiKeyRef.current });
        
        // Safety timeout 10s
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));
        
        const apiPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: `Act as Jarvis. User said: "${query}". Map to JSON. Actions: OPEN_TAB, CLOSE_TAB, SEARCH, SCROLL_DOWN, SCROLL_UP, GO_HOME, NONE. Payload needed for search/open. Response is brief spoken text.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        action: { type: Type.STRING, enum: ["OPEN_TAB", "CLOSE_TAB", "SEARCH", "SCROLL_DOWN", "SCROLL_UP", "GO_HOME", "NONE"] },
                        payload: { type: Type.STRING },
                        response: { type: Type.STRING }
                    },
                    required: ["action", "response"]
                }
            }
        });

        const result: any = await Promise.race([apiPromise, timeoutPromise]);
        const text = result.text;
        if (!text) throw new Error("Empty response");
        const jsonResponse = JSON.parse(text);
        
        playBeep('SUCCESS');
        onCommand(jsonResponse);
        speak(jsonResponse.response, false);

    } catch (err) {
        console.error("Gemini Error:", err);
        speak("Processing failed.", false);
        setStatus('IDLE');
    }
  };

  const speak = (text: string, expectResponse: boolean) => {
    if (!synthRef.current) return;
    
    // Abort mic while speaking to prevent loop
    if (recognitionRef.current) recognitionRef.current.abort();
    ignoreNextEndRef.current = true; // Don't auto-restart immediately on abort
    
    isSpeakingRef.current = true;
    setStatus('SPEAKING');
    
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthRef.current.getVoices();
    // Prefer Male Voice
    const voice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('David') || v.name.toLowerCase().includes('male')) || voices[0];
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.pitch = 0.9; 
    
    utterance.onend = () => {
        isSpeakingRef.current = false;
        setStatus('IDLE'); 
        // Restart mic after speaking finished
        if (isMicActiveRef.current && !permissionDenied) {
            setTimeout(() => {
                if (recognitionRef.current) {
                    try { recognitionRef.current.start(); } catch(e) {}
                }
            }, 100);
        }
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
              osc.start(); osc.stop(ctx.currentTime + 0.1);
          } else {
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(600, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
              gain.gain.setValueAtTime(0.1, ctx.currentTime);
              gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
              osc.start(); osc.stop(ctx.currentTime + 0.15);
          }
      } catch(e) {}
  };

  const saveKey = () => {
      if(tempKey.trim().length > 0) {
          localStorage.setItem('GEMINI_API_KEY', tempKey);
          setApiKey(tempKey);
          setShowKeyInput(false);
          speak("Connected.", false);
      }
  };

  // --- VISUALIZER ---
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

       let color = '#334155';
       if (!apiKey) color = '#EF4444';
       else if (permissionDenied) color = '#EF4444';
       else if (!isMicActive) color = '#1e293b';
       else if (status === 'IDLE') color = '#0EA5E9';
       else if (status === 'LISTENING') color = '#EAB308';
       else if (status === 'PROCESSING') color = '#A855F7';
       else if (status === 'SPEAKING') color = '#22C55E';

       const pulse = isMicActive ? Math.sin(time / 200) * (status === 'LISTENING' ? 4 : 2) : 0;
       const radius = 20 + pulse;

       // Glow
       const gradient = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 3);
       gradient.addColorStop(0, color);
       gradient.addColorStop(1, 'rgba(0,0,0,0)');
       ctx.fillStyle = gradient;
       ctx.beginPath(); ctx.arc(cx, cy, radius * 3, 0, Math.PI * 2); ctx.fill();

       // Core
       ctx.fillStyle = '#fff';
       ctx.beginPath(); ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2); ctx.fill();

       // Ring
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
       {/* PERMISSION ERROR UI */}
       {permissionDenied && (
           <div className="bg-red-900/90 border border-red-500 text-red-100 text-xs px-3 py-2 rounded-lg mb-1 shadow-lg max-w-[200px]">
               <div className="flex items-center gap-2 font-bold mb-1"><AlertCircle size={14}/> Access Denied</div>
               <p className="leading-tight opacity-80">{errorMessage}</p>
           </div>
       )}

       {isMicActive && status !== 'IDLE' && (
           <div className="bg-slate-900/80 border border-cyan-500/30 px-3 py-1 rounded text-[10px] text-cyan-200 font-mono mb-1 max-w-[200px] truncate animate-fade-in">
               {status === 'LISTENING' ? (lastTranscript || 'Listening...') : status}
           </div>
       )}

       {showKeyInput && (
           <div className="bg-slate-900/95 border border-cyan-500/50 p-4 rounded-xl mb-2 w-72 shadow-2xl">
               <input 
                 type="password" placeholder="Gemini API Key" value={tempKey} onChange={(e) => setTempKey(e.target.value)}
                 className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white mb-2"
               />
               <button onClick={saveKey} className="w-full bg-cyan-600 text-white text-xs font-bold py-1.5 rounded">CONNECT</button>
           </div>
       )}

       <div className="flex items-center gap-4">
           {!isMicActive && !permissionDenied && (
                <div className="bg-slate-900/90 text-xs text-cyan-400 px-2 py-1 rounded mr-2 pointer-events-none animate-pulse">
                    Click Orb to Activate
                </div>
           )}
           
           {/* MAIN ORB BUTTON */}
           <div className="relative group cursor-pointer" onClick={handleMicClick}>
                <canvas ref={canvasRef} width={80} height={80} className={`w-14 h-14 transition-opacity ${isMicActive ? 'opacity-100' : 'opacity-60'}`} />
                {!isMicActive && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                        <MicOff size={20} />
                    </div>
                )}
           </div>

           <button onClick={() => setShowKeyInput(!showKeyInput)} className={`p-2 rounded-full border bg-slate-900 ${!apiKey ? 'border-red-500 text-red-500 animate-pulse' : 'border-slate-700 text-slate-500'}`}>
               <Key size={14} />
           </button>
       </div>
    </div>
  );
};

export default JarvisAssistant;
