import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GameState, PhysicsObject } from '../types';
import { updatePhysics, smoothPointAdaptive, distance } from '../utils/physics';
import { Camera, RefreshCw, AlertCircle } from 'lucide-react';

interface GestureCanvasProps {
  onStateChange: (state: GameState) => void;
}

const GestureCanvas: React.FC<GestureCanvasProps> = ({ onStateChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const [status, setStatus] = useState<GameState>(GameState.LOADING_MODEL);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const grabbedObjectIdRef = useRef<number | null>(null);
  const missedFramesRef = useRef<number>(0);
  const releaseDebounceRef = useRef<number>(0); 
  
  // Initialize 3 Sci-Fi Objects
  const objectsRef = useRef<PhysicsObject[]>([
    {
      id: 1,
      x: window.innerWidth * 0.3,
      y: window.innerHeight * 0.5,
      vx: 0, vy: 0,
      radius: 50,
      color: '#06B6D4', // Cyan
      glowColor: '#22D3EE',
      shape: 'ORB',
      isGrabbed: false,
      isHovered: false,
      mass: 1,
      friction: 0.97,
      restitution: 0.85,
    },
    {
      id: 2,
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.5,
      vx: 0, vy: 0,
      radius: 55,
      color: '#D946EF', // Magenta
      glowColor: '#E879F9',
      shape: 'CUBE',
      isGrabbed: false,
      isHovered: false,
      mass: 1.5, // Heavier
      friction: 0.95,
      restitution: 0.6,
    },
    {
      id: 3,
      x: window.innerWidth * 0.7,
      y: window.innerHeight * 0.5,
      vx: 0, vy: 0,
      radius: 50,
      color: '#10B981', // Emerald
      glowColor: '#34D399',
      shape: 'PYRAMID',
      isGrabbed: false,
      isHovered: false,
      mass: 0.8, // Lighter
      friction: 0.98,
      restitution: 0.9,
    }
  ]);
  
  // Cursor state
  const cursorRef = useRef<{ 
    x: number, 
    y: number, 
    pinching: boolean, 
    visible: boolean, 
    mode: 'OPEN' | 'POINT' | 'PINCH' | 'LOCKED',
    pinchVal: number,
    releaseProgress: number // 0 to 1, for visualizing release
  }>({
    x: 0.5,
    y: 0.5,
    pinching: false,
    visible: false,
    mode: 'OPEN',
    pinchVal: 1,
    releaseProgress: 0
  });

  const prevCursorRef = useRef<{ x: number, y: number, time: number }>({ x: 0.5, y: 0.5, time: 0 });

  // Grid animation state
  const gridOffsetRef = useRef(0);

  const initializeMediaPipe = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
      );
      
      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });

      handLandmarkerRef.current = handLandmarker;
      startCamera();
    } catch (error) {
      console.error("Error initializing MediaPipe:", error);
      setStatus(GameState.ERROR);
      setErrorMessage("Failed to load AI model. Please check your connection.");
      onStateChange(GameState.ERROR);
    }
  }, [onStateChange]);

  const startCamera = async () => {
    setStatus(GameState.WAITING_PERMISSIONS);
    onStateChange(GameState.WAITING_PERMISSIONS);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", () => {
          setStatus(GameState.RUNNING);
          onStateChange(GameState.RUNNING);
          predictWebcam();
        });
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setStatus(GameState.ERROR);
      setErrorMessage("Camera access denied or unavailable.");
      onStateChange(GameState.ERROR);
    }
  };

  const predictWebcam = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;

    // Handle resizing
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    // --- Detection Phase ---
    let results;
    try {
       if(video.videoWidth > 0 && video.videoHeight > 0 && handLandmarkerRef.current) {
           results = handLandmarkerRef.current.detectForVideo(video, performance.now());
       }
    } catch(e) {
        console.warn("Detection frame skipped");
    }

    // --- Logic Phase ---
    const cursor = cursorRef.current;
    const prevCursor = prevCursorRef.current;
    const objects = objectsRef.current;

    // Persistence Check: If we lose hand, wait 8 frames (~130ms) before dropping
    if (results && results.landmarks && results.landmarks.length > 0) {
      missedFramesRef.current = 0;
      const landmarks = results.landmarks[0];
      
      const wrist = landmarks[0];
      const thumbTip = landmarks[4];
      const indexMCP = landmarks[5]; 
      const indexTip = landmarks[8];
      const middleMCP = landmarks[9];
      const middleTip = landmarks[12]; 
      const pinkyMCP = landmarks[17]; 

      // --- ROBUST SCALE CALCULATION ---
      const handScale = Math.max(
        Math.hypot(indexMCP.x - wrist.x, indexMCP.y - wrist.y),
        Math.hypot(pinkyMCP.x - wrist.x, pinkyMCP.y - wrist.y),
        Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y)
      );
      
      // --- PINCH CALCULATION ---
      const distIndex = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
      const distMiddle = Math.hypot(middleTip.x - thumbTip.x, middleTip.y - thumbTip.y);
      const rawPinchDist = Math.min(distIndex, distMiddle); 
      const normalizedPinch = rawPinchDist / handScale;

      cursor.pinchVal = normalizedPinch; // Store for visuals

      // --- SIMPLIFIED ROBUST STATE MACHINE ---
      let isPinching = false;
      
      // Tuned Thresholds
      const GRAB_THRESHOLD = 0.18; 
      const RELEASE_THRESHOLD = 0.6; // Very high threshold for release (Sticky)
      const RELEASE_FRAMES = 8; // Must hold open for 8 frames

      if (grabbedObjectIdRef.current !== null) {
          // --- LOCKED STATE ---
          
          if (normalizedPinch > RELEASE_THRESHOLD) {
              // Intentional Release Detected
              releaseDebounceRef.current += 1;
              cursor.releaseProgress = Math.min(1, releaseDebounceRef.current / RELEASE_FRAMES);

              if (releaseDebounceRef.current > RELEASE_FRAMES) {
                  isPinching = false;
                  cursor.mode = 'OPEN';
              } else {
                  isPinching = true; // Still holding until buffer full
                  cursor.mode = 'LOCKED';
              }
          } else {
              // Grip is secure
              isPinching = true;
              releaseDebounceRef.current = 0;
              cursor.releaseProgress = 0;
              cursor.mode = 'LOCKED';
          }
      } else {
          // --- SEARCHING STATE ---
          cursor.releaseProgress = 0;
          if (normalizedPinch < GRAB_THRESHOLD) {
              isPinching = true;
              cursor.mode = 'PINCH';
          } else {
              isPinching = false;
              cursor.mode = 'POINT';
          }
          releaseDebounceRef.current = 0;
      }

      cursor.visible = true;
      cursor.pinching = isPinching;

      // --- STABLE PALM CENTROID TRACKING ---
      const knuckleMidX = (indexMCP.x + pinkyMCP.x) / 2;
      const knuckleMidY = (indexMCP.y + pinkyMCP.y) / 2;
      const palmDirX = knuckleMidX - wrist.x;
      const palmDirY = knuckleMidY - wrist.y;
      
      // Project cursor rigidly from palm orientation
      const virtualTipX = knuckleMidX + palmDirX * 1.5;
      const virtualTipY = knuckleMidY + palmDirY * 1.5;

      const rawTargetX = (1 - virtualTipX) * canvas.width;
      const rawTargetY = virtualTipY * canvas.height;

      // --- ADAPTIVE SMOOTHING ---
      // Higher minAlpha when locked to prevent "floaty" feel
      const minAlpha = isPinching ? 0.30 : 0.12; 
      const maxAlpha = 0.7;
      
      const smoothed = smoothPointAdaptive(
        { x: cursor.x, y: cursor.y }, 
        { x: rawTargetX, y: rawTargetY }, 
        minAlpha, 
        maxAlpha
      );
      
      cursor.x = smoothed.x;
      cursor.y = smoothed.y;

      // --- Physics Interaction ---
      objects.forEach(obj => obj.isHovered = false);

      let activeObject: PhysicsObject | null = null;

      // STRICT LOCKING: If we are holding an object, IGNORE all others.
      if (grabbedObjectIdRef.current !== null) {
        activeObject = objects.find(o => o.id === grabbedObjectIdRef.current) || null;
      } else {
        // Only look for new objects if we aren't holding anything
        let minDist = Infinity;
        objects.forEach(obj => {
          const d = distance({x: cursor.x, y: cursor.y}, {x: obj.x, y: obj.y});
          // Hitbox is slightly larger than visual radius
          if (d < obj.radius + 60 && d < minDist) {
            minDist = d;
            activeObject = obj;
          }
        });
      }

      if (activeObject) {
        activeObject.isHovered = true;
        
        // MAGNETIC AIM ASSIST (Only when not holding yet)
        if (!cursor.pinching && normalizedPinch < 0.3 && !grabbedObjectIdRef.current) {
            const pullStrength = 0.25;
            cursor.x += (activeObject.x - cursor.x) * pullStrength;
            cursor.y += (activeObject.y - cursor.y) * pullStrength;
        }

        // Engage Grab
        if (isPinching && !grabbedObjectIdRef.current) {
           grabbedObjectIdRef.current = activeObject.id;
           activeObject.isGrabbed = true;
        }
      }

      // Update Object States
      objects.forEach(obj => {
        // Release Logic
        if (!isPinching && obj.id === grabbedObjectIdRef.current) {
           obj.isGrabbed = false;
           grabbedObjectIdRef.current = null;
           
           // Apply Throw Velocity
           const scale = 0.9;
           const vx = (cursor.x - prevCursor.x) * scale;
           const vy = (cursor.y - prevCursor.y) * scale;
           const maxSpeed = 40;
           obj.vx = Math.min(Math.max(vx, -maxSpeed), maxSpeed);
           obj.vy = Math.min(Math.max(vy, -maxSpeed), maxSpeed);
        }

        if (obj.isGrabbed) {
          // Direct control - TIGHT Lock (0.92 factor)
          obj.x += (cursor.x - obj.x) * 0.92;
          obj.y += (cursor.y - obj.y) * 0.92;
          
          // Zero velocity to prevent drift
          obj.vx = 0;
          obj.vy = 0;
        }
      });

      prevCursorRef.current = { x: cursor.x, y: cursor.y, time: performance.now() };

    } else {
      // Hand Lost Handling
      missedFramesRef.current++;
      
      if (missedFramesRef.current > 8) {
          cursor.visible = false;
          cursor.pinching = false;
          if (grabbedObjectIdRef.current !== null) {
             const obj = objects.find(o => o.id === grabbedObjectIdRef.current);
             if (obj) obj.isGrabbed = false;
             grabbedObjectIdRef.current = null;
          }
      }
    }

    // --- Physics Step ---
    objects.forEach(obj => updatePhysics(obj, { width: canvas.width, height: canvas.height }));

    // --- Render Phase ---
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGrid(ctx, canvas.width, canvas.height);
      objects.forEach(obj => drawSciFiObject(ctx, obj));
      if (cursor.visible) {
        drawHudCursor(ctx, cursor.x, cursor.y, cursor.pinching, cursor.mode, cursor.pinchVal, cursor.releaseProgress);
      }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  // --- Drawing Helpers ---

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)'; 
    ctx.lineWidth = 1;
    const gridSize = 60;
    gridOffsetRef.current = (gridOffsetRef.current + 0.5) % gridSize;
    
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = gridOffsetRef.current; y <= height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    const gradient = ctx.createRadialGradient(width/2, height/2, height/4, width/2, height/2, height);
    gradient.addColorStop(0, 'rgba(15, 23, 42, 0)');
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  const drawSciFiObject = (ctx: CanvasRenderingContext2D, obj: PhysicsObject) => {
    ctx.save();
    const isActive = obj.isGrabbed || obj.isHovered;
    const pulse = isActive ? Math.sin(performance.now() / 100) * 5 : 0;
    
    ctx.shadowBlur = isActive ? 30 + pulse : 15;
    ctx.shadowColor = obj.glowColor;
    ctx.fillStyle = isActive ? '#ffffff' : obj.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    if (obj.shape === 'ORB') {
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
      ctx.fillStyle = obj.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
      if(isActive) ctx.stroke();
    
    } else if (obj.shape === 'CUBE') {
      const s = obj.radius * 1.6; 
      ctx.translate(obj.x, obj.y);
      const rot = (obj.vx + obj.vy) * 0.05;
      ctx.rotate(rot);
      ctx.fillStyle = obj.color;
      ctx.fillRect(-s/2, -s/2, s, s);
      ctx.strokeStyle = obj.glowColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(-s/2, -s/2, s, s);
      ctx.beginPath();
      ctx.moveTo(-s/4, 0); ctx.lineTo(s/4, 0);
      ctx.moveTo(0, -s/4); ctx.lineTo(0, s/4);
      ctx.stroke();
      ctx.restore();

    } else if (obj.shape === 'PYRAMID') {
      const s = obj.radius * 1.8;
      ctx.translate(obj.x, obj.y);
      ctx.rotate(performance.now() / 1000); 
      ctx.beginPath();
      ctx.moveTo(0, -s/1.5);
      ctx.lineTo(s/1.5, s/2);
      ctx.lineTo(-s/1.5, s/2);
      ctx.closePath();
      ctx.fillStyle = obj.color;
      ctx.fill();
      ctx.strokeStyle = obj.glowColor;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };

  const drawHudCursor = (ctx: CanvasRenderingContext2D, x: number, y: number, pinching: boolean, mode: string, pinchVal: number, releaseProgress: number) => {
    ctx.save();
    ctx.translate(x, y);
    
    let color;
    if (mode === 'LOCKED') color = '#F43F5E'; // Rose/Red for LOCKED
    else if (mode === 'PINCH') color = '#E879F9'; // Purple for PINCH intent
    else if (mode === 'OPEN') color = '#34D399'; // Green for OPEN
    else color = '#22D3EE'; // Cyan for POINT

    ctx.strokeStyle = color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.lineWidth = 2;

    const time = performance.now();
    ctx.save();
    ctx.rotate(time / 500);
    const r = 25;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, Math.PI * 1.3); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.rotate(-time / 500);
    const r2 = 15;
    ctx.beginPath(); ctx.arc(0, 0, r2, 0, Math.PI * 2);
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.restore();
    
    // --- RELEASE PROGRESS (Fading ring when opening hand while locked) ---
    if (mode === 'LOCKED' && releaseProgress > 0) {
        const ringR = 30 + releaseProgress * 20;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(244, 63, 94, ${1 - releaseProgress})`;
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    // --- PINCH RING FEEDBACK ---
    if (mode !== 'LOCKED') {
        const visualPinch = Math.min(1, Math.max(0, pinchVal));
        if (visualPinch < 0.6) { 
            const ringSize = Math.max(8, visualPinch * 60);
            ctx.beginPath();
            ctx.arc(0, 0, ringSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(232, 121, 249, ${0.8 - visualPinch})`; 
            ctx.fill();
            ctx.strokeStyle = '#E879F9';
            ctx.stroke();
        }
    }

    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();

    ctx.font = '10px monospace';
    ctx.fillStyle = color;
    ctx.fillText(mode, 30, 4);

    ctx.restore();
  };

  useEffect(() => {
    initializeMediaPipe();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [initializeMediaPipe]);

  const handleRetry = () => {
    setStatus(GameState.LOADING_MODEL);
    setErrorMessage('');
    initializeMediaPipe();
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover opacity-0 pointer-events-none"
        playsInline
        autoPlay
        muted
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full block touch-none cursor-none"
      />
      
      {status === GameState.LOADING_MODEL && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-50">
          <div className="relative">
             <div className="w-20 h-20 border-4 border-cyan-500/30 rounded-full animate-ping absolute inset-0"></div>
             <div className="w-20 h-20 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-cyan-400 font-mono tracking-widest animate-pulse">INITIALIZING SYSTEMS...</p>
        </div>
      )}

      {status === GameState.WAITING_PERMISSIONS && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 z-50 p-6 text-center">
          <Camera className="w-16 h-16 text-cyan-400 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-white mb-2 font-mono">OPTICAL SENSOR REQUIRED</h2>
          <p className="text-slate-400 max-w-md font-mono text-sm">
            ACCESS GRANTED REQUIRED FOR HAND TRACKING PROTOCOLS.
            LOCAL PROCESSING ONLY.
          </p>
        </div>
      )}

      {status === GameState.ERROR && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-50 p-6 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-red-500 mb-2 font-mono">SYSTEM FAILURE</h2>
          <p className="text-red-300 max-w-md mb-6 font-mono text-sm">{errorMessage}</p>
          <button 
            onClick={handleRetry}
            className="flex items-center gap-2 px-6 py-3 bg-cyan-900/50 hover:bg-cyan-800/50 border border-cyan-500 text-cyan-300 rounded-none font-mono transition-all"
          >
            <RefreshCw className="w-5 h-5" /> REBOOT
          </button>
        </div>
      )}
      
      {status === GameState.RUNNING && (
        <div className="absolute bottom-6 left-6 pointer-events-none">
           <div className="bg-slate-900/80 backdrop-blur p-4 border-l-2 border-cyan-500 text-xs font-mono text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
             <div className="flex items-center gap-2 mb-2">
               <div className="w-2 h-2 bg-green-500 animate-pulse"></div>
               <span className="tracking-widest">SYSTEM ONLINE</span>
             </div>
             <div className="opacity-70">
               TRACKING: RIGID_LOCK_V3<br/>
               LATENCY: OPTIMIZED<br/>
               OBJECTS: 3
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default GestureCanvas;