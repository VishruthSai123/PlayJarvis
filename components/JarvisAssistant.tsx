import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { JarvisStatus, JarvisCommand } from '../types';
import { Key, Mic, MicOff } from 'lucide-react';

interface JarvisAssistantProps {
  onCommand: (cmd: JarvisCommand) => void;
  isInputActive: boolean; 
}

const JarvisAssistant: React.FC<JarvisAssistantProps> = ({ onCommand, isInputActive }) => {
  const [status, setStatus] = useState<JarvisStatus>('IDLE');
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => {
    return process.env.API_KEY || localStorage.getItem('GEMINI_API_KEY') || '';
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Refs
  const statusRef = useRef<JarvisStatus>('IDLE');
  const apiKeyRef = useRef<string>(apiKey);
  const isInputActiveRef = useRef(isInputActive);
  const isMicEnabledRef = useRef(false);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const isSpeakingRef = useRef(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Sync refs
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);
  useEffect(() => { isInputActiveRef.current = isInputActive; }, [isInputActive]);

  const playBeep = (type: 'WAKE' | 'SUCCESS') => {
      try {
          if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          const ctx = audioContextRef.current;
          if (ctx.state === 'suspended') ctx.resume();
          
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          const t = ctx.currentTime;
          if (type === 'WAKE') {
              osc.type = 'sine';
              osc.frequency.setValueAtTime(440, t);
              osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
              gain.gain.setValueAtTime(0.1, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
              osc.start(t);
              osc.stop(t + 0.1);
          } else {
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(600, t);
              osc.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
              gain.gain.setValueAtTime(0.1, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
              osc.start(t);
              osc.stop(t + 0.15);
          }
      } catch(e) {}
  };

  // INITIALIZE RECOGNITION ONCE
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
         setErrorMessage('');
         // console.log("Microphone Started");
      };

      recognition.onresult = (event: any) => {
        if (isInputActiveRef.current || isSpeakingRef.current || statusRef.current === 'PROCESSING' || statusRef.current === 'SPEAKING') return;

        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript.trim().toLowerCase();
        const isFinal = result.isFinal;
        
        setLastTranscript(transcript);

        if (statusRef.current === 'IDLE') {
          // Wake Word
          const wakeWords = ['jarvis', 'jar vis', 'harvest', 'service', 'travis', 'davis', 'javis', 'jovis', 'starvis', 'java', 'hey jarvis'];
          if (wakeWords.some(w => transcript.includes(w))) {
            recognition.stop(); // Temporarily stop to process command
            setStatus('LISTENING');
            playBeep('WAKE');
          }
        } else if (statusRef.current === 'LISTENING' && isFinal) {
            recognition.stop();
            handleUserQuery(transcript);
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'no-speech') return;
        
        console.warn("Speech Error:", e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            setIsMicEnabled(false);
            isMicEnabledRef.current = false;
            setErrorMessage('Microphone blocked. Check permissions.');
        }
      };
      
      recognition.onend = () => {
          // RESTART LOGIC
          if (isMicEnabledRef.current && !isSpeakingRef.current && statusRef.current !== 'PROCESSING') {
             // Small delay to prevent CPU thrashing
             setTimeout(() => {
                 try { 
                     if (isMicEnabledRef.current) recognition.start(); 
                 } catch(e) { }
             }, 200);
          }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleMic = () => {
      if (!recognitionRef.current) {
          setErrorMessage("Browser not supported");
          return;
      }

      if (isMicEnabled) {
          // STOP
          setIsMicEnabled(false);
          isMicEnabledRef.current = false;
          setStatus('IDLE');
          recognitionRef.current.stop();
      } else {
          // START
          setIsMicEnabled(true);
          isMicEnabledRef.current = true;
          setErrorMessage('');
          
          try {
              recognitionRef.current.start();
          } catch(e) {
              // Might already be started
          }
      }
  };

  const handleUserQuery = async (query: string) => {
    if (!apiKeyRef.current) {
        speak("Please provide an API key.", false);
        setStatus('IDLE');
        setShowKeyInput(true);
        return;
    }

    setStatus('PROCESSING');
    
    try {
        const ai = new GoogleGenAI({ apiKey: apiKeyRef.current });
        
        // Safety timeout
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000));
        
        const apiPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: `Act as Jarvis AI. User said: "${query}". Map to action. Keep response brief and futuristic.`,
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
        speak("I could not process that.", false);
        setStatus('IDLE');
    }
  };

  const speak = (text: string, expectResponse: boolean) => {
    if (!synthRef.current) return;
    
    // Hard stop recognition while speaking
    if (recognitionRef.current) recognitionRef.current.abort();
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
        // Restart mic after speaking
        setTimeout(() => {
            try { 
                if (recognitionRef.current && isMicEnabledRef.current) recognitionRef.current.start(); 
            } catch(e) {}
        }, 100);
    };

    synthRef.current.speak(utterance);
  };

  const saveKey = () => {
      if(tempKey.trim().length > 0) {
          localStorage.setItem('GEMINI_API_KEY', tempKey);
          setApiKey(tempKey);
          setShowKeyInput(false);
          speak("Connected.", false);
      }
  };

  // Visualizer Loop
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
       else if (!isMicEnabled) color = '#1e293b';
       else if (status === 'IDLE') color = '#0EA5E9';
       else if (status === 'LISTENING') color = '#EAB308';
       else if (status === 'PROCESSING') color = '#A855F7';
       else if (status === 'SPEAKING') color = '#22C55E';

       const pulse = isMicEnabled ? Math.sin(time / 200) * (status === 'LISTENING' ? 4 : 2) : 0;
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
  }, [status, apiKey, isMicEnabled]);

  return (
    <div className="fixed bottom-8 right-8 z-[200] flex flex-col items-end gap-2 pointer-events-auto">
       {errorMessage && (
           <div className="bg-red-900/80 text-red-200 text-xs px-2 py-1 rounded mb-1 animate-pulse">
               {errorMessage}
           </div>
       )}
       
       {isMicEnabled && status !== 'IDLE' && (
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
           {!isMicEnabled && !errorMessage && (
                <div className="bg-slate-900/90 text-xs text-cyan-400 px-2 py-1 rounded mr-2 pointer-events-none">
                    Click to Activate
                </div>
           )}
           <div className="relative group cursor-pointer" onClick={toggleMic}>
                <canvas ref={canvasRef} width={80} height={80} className={`w-14 h-14 transition-opacity ${isMicEnabled ? 'opacity-100' : 'opacity-50'}`} />
                {!isMicEnabled && (
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