import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GameState, PhysicsObject, ScreenMode, CursorData } from '../types';
import { updatePhysics, smoothPointAdaptive, distance, smoothScalar } from '../utils/physics';

interface GestureCanvasProps {
  onStateChange: (state: GameState) => void;
  mode: ScreenMode;
  onCursorUpdate?: (data: CursorData) => void;
}

const GestureCanvas: React.FC<GestureCanvasProps> = ({ onStateChange, mode, onCursorUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // CRITICAL: Ref to track mode inside the animation loop without stale closures
  const modeRef = useRef<ScreenMode>(mode);
  
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const grabbedObjectIdRef = useRef<number | null>(null);
  const missedFramesRef = useRef<number>(0);
  const releaseDebounceRef = useRef<number>(0); 
  const prevHandPosRef = useRef<{x: number, y: number} | null>(null);
  const velocityRef = useRef<number>(0);

  // Update ref when prop changes
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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
    releaseProgress: number, // 0 to 1
    tilt: number
  }>({
    x: 0.5,
    y: 0.5,
    pinching: false,
    visible: false,
    mode: 'OPEN',
    pinchVal: 1,
    releaseProgress: 0,
    tilt: 0
  });

  const prevCursorRef = useRef<{ x: number, y: number, time: number }>({ x: 0.5, y: 0.5, time: 0 });
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
      onStateChange(GameState.ERROR);
    }
  }, [onStateChange]);

  const startCamera = async () => {
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
          onStateChange(GameState.RUNNING);
          predictWebcam();
        });
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      onStateChange(GameState.ERROR);
    }
  };

  const predictWebcam = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    
    // CRITICAL: Always read from ref to get the latest mode in the loop
    const currentMode = modeRef.current;

    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    // --- Detection ---
    let results;
    try {
       if(video.videoWidth > 0 && video.videoHeight > 0 && handLandmarkerRef.current) {
           results = handLandmarkerRef.current.detectForVideo(video, performance.now());
       }
    } catch(e) {
        console.warn("Frame skipped");
    }

    const cursor = cursorRef.current;
    const prevCursor = prevCursorRef.current;
    const objects = objectsRef.current;

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

      // Robust Scale
      const handScale = Math.max(
        Math.hypot(indexMCP.x - wrist.x, indexMCP.y - wrist.y),
        Math.hypot(pinkyMCP.x - wrist.x, pinkyMCP.y - wrist.y),
        Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y)
      );
      
      // Pinch Calculation
      const distIndex = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
      const distMiddle = Math.hypot(middleTip.x - thumbTip.x, middleTip.y - thumbTip.y);
      const rawPinchDist = Math.min(distIndex, distMiddle); 
      const normalizedPinch = rawPinchDist / handScale;
      
      cursor.pinchVal = smoothScalar(cursor.pinchVal, normalizedPinch, 0.3);

      // Tilt
      const rawTilt = (middleTip.y - wrist.y) / handScale;
      cursor.tilt = smoothScalar(cursor.tilt, rawTilt, 0.1);

      // Velocity
      if (prevHandPosRef.current) {
          const dx = wrist.x - prevHandPosRef.current.x;
          const dy = wrist.y - prevHandPosRef.current.y;
          velocityRef.current = Math.hypot(dx, dy);
      }
      prevHandPosRef.current = { x: wrist.x, y: wrist.y };

      // --- TUNED RELEASE CONSTANTS ---
      const IS_MOVING_FAST = velocityRef.current > 0.1; // Increased: Only block if moving VERY fast
      const RELEASE_THRESHOLD = 0.45; // Relaxed: Easier to release
      const RELEASE_FRAMES = 3; // Faster: Snappier release

      // Pinch State Logic
      let isPinching = false;
      if (grabbedObjectIdRef.current !== null) {
          // Panic Release: If hand is WIDE OPEN (> 0.8), drop immediately regardless of velocity
          if (cursor.pinchVal > 0.8) {
             isPinching = false;
             cursor.mode = 'OPEN';
             releaseDebounceRef.current = RELEASE_FRAMES + 1;
          }
          // Normal Release: Must be open past threshold and stable
          else if (cursor.pinchVal > RELEASE_THRESHOLD && !IS_MOVING_FAST) {
              releaseDebounceRef.current += 1;
              cursor.releaseProgress = Math.min(1, releaseDebounceRef.current / RELEASE_FRAMES);
              if (releaseDebounceRef.current > RELEASE_FRAMES) {
                  isPinching = false;
                  cursor.mode = 'OPEN';
              } else {
                  isPinching = true;
                  cursor.mode = 'LOCKED';
              }
          } else {
              isPinching = true;
              releaseDebounceRef.current = 0;
              cursor.releaseProgress = 0;
              cursor.mode = 'LOCKED';
          }
      } else {
          cursor.releaseProgress = 0;
          if (cursor.pinchVal < 0.18) {
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

      // Tracking - Palm Centroid
      const knuckleMidX = (indexMCP.x + middleMCP.x + pinkyMCP.x) / 3;
      const knuckleMidY = (indexMCP.y + middleMCP.y + pinkyMCP.y) / 3;
      const palmDirX = knuckleMidX - wrist.x;
      const palmDirY = knuckleMidY - wrist.y;
      
      const virtualTipX = knuckleMidX + palmDirX * 1.6;
      const virtualTipY = knuckleMidY + palmDirY * 1.6;

      // --- INTELLIGENT CORNER REMAPPING ---
      // Map a smaller "safe zone" of the camera to the full screen.
      // This allows reaching corners without the hand exiting the camera frame.
      const HORIZONTAL_MARGIN = 0.18; // 18% margin on left/right
      const VERTICAL_MARGIN = 0.22;   // 22% margin on top/bottom
      
      // Remap (0.18 -> 0.0) and (0.82 -> 1.0)
      let safeX = (virtualTipX - HORIZONTAL_MARGIN) / (1 - 2 * HORIZONTAL_MARGIN);
      let safeY = (virtualTipY - VERTICAL_MARGIN) / (1 - 2 * VERTICAL_MARGIN);

      // Clamp values (so we don't go off screen if we really stretch)
      safeX = Math.max(0, Math.min(1, safeX));
      safeY = Math.max(0, Math.min(1, safeY));

      const rawTargetX = (1 - safeX) * canvas.width; // Mirroring happens here
      const rawTargetY = safeY * canvas.height;

      // Precision Smoothing for Browser
      const minAlpha = currentMode === 'BROWSE' ? 0.05 : (isPinching ? 0.35 : 0.12);
      const maxAlpha = currentMode === 'BROWSE' ? 0.2 : 0.75;
      
      const smoothed = smoothPointAdaptive(
        { x: cursor.x, y: cursor.y }, 
        { x: rawTargetX, y: rawTargetY }, 
        minAlpha, 
        maxAlpha
      );
      
      cursor.x = smoothed.x;
      cursor.y = smoothed.y;

      // OBJECT INTERACTION (Playground Only)
      if (currentMode === 'PLAYGROUND') {
        objects.forEach(obj => obj.isHovered = false);

        let activeObject: PhysicsObject | null = null;
        if (grabbedObjectIdRef.current !== null) {
          activeObject = objects.find(o => o.id === grabbedObjectIdRef.current) || null;
        } else {
          let minDist = Infinity;
          objects.forEach(obj => {
            const d = distance({x: cursor.x, y: cursor.y}, {x: obj.x, y: obj.y});
            if (d < obj.radius + 60 && d < minDist) {
              minDist = d;
              activeObject = obj;
            }
          });
        }

        if (activeObject) {
          activeObject.isHovered = true;
          if (!cursor.pinching && normalizedPinch < 0.3 && !grabbedObjectIdRef.current) {
              cursor.x += (activeObject.x - cursor.x) * 0.25;
              cursor.y += (activeObject.y - cursor.y) * 0.25;
          }
          if (isPinching && !grabbedObjectIdRef.current) {
            grabbedObjectIdRef.current = activeObject.id;
            activeObject.isGrabbed = true;
          }
        }

        objects.forEach(obj => {
          if (!isPinching && obj.id === grabbedObjectIdRef.current) {
            obj.isGrabbed = false;
            grabbedObjectIdRef.current = null;
            const vx = (cursor.x - prevCursor.x) * 0.9;
            const vy = (cursor.y - prevCursor.y) * 0.9;
            obj.vx = Math.min(Math.max(vx, -40), 40);
            obj.vy = Math.min(Math.max(vy, -40), 40);
          }
          if (obj.isGrabbed) {
            obj.x += (cursor.x - obj.x) * 0.92;
            obj.y += (cursor.y - obj.y) * 0.92;
            obj.vx = 0; obj.vy = 0;
          }
        });
      }

      prevCursorRef.current = { x: cursor.x, y: cursor.y, time: performance.now() };

      if (onCursorUpdate) {
        onCursorUpdate({
          x: cursor.x,
          y: cursor.y,
          pinching: cursor.pinching,
          gestureMode: cursor.mode,
          pinchVal: cursor.pinchVal,
          timestamp: performance.now(),
          tilt: cursor.tilt
        });
      }

    } else {
      missedFramesRef.current++;
      if (missedFramesRef.current > 8) {
          cursor.visible = false;
          cursor.pinching = false;
          grabbedObjectIdRef.current = null;
      }
    }

    if (currentMode === 'PLAYGROUND') {
        objects.forEach(obj => updatePhysics(obj, { width: canvas.width, height: canvas.height }));
    }

    // --- RENDER ---
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Transparent
      
      drawGrid(ctx, canvas.width, canvas.height, currentMode);
      
      if (currentMode === 'PLAYGROUND') {
        objects.forEach(obj => drawSciFiObject(ctx, obj));
      }

      if (cursor.visible) {
        drawHudCursor(ctx, cursor.x, cursor.y, cursor.pinching, cursor.mode, cursor.pinchVal, cursor.releaseProgress, currentMode, cursor.tilt);
      }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, mode: ScreenMode) => {
    ctx.save();
    const opacity = mode === 'BROWSE' ? 0.05 : 0.15;
    ctx.strokeStyle = `rgba(6, 182, 212, ${opacity})`; 
    ctx.lineWidth = 1;
    const gridSize = 60;
    gridOffsetRef.current = (gridOffsetRef.current + 0.5) % gridSize;
    
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = gridOffsetRef.current; y <= height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
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
      ctx.stroke();
    } else if (obj.shape === 'CUBE') {
      const s = obj.radius * 1.6; 
      ctx.translate(obj.x, obj.y);
      ctx.rotate((obj.vx + obj.vy) * 0.05);
      ctx.fillRect(-s/2, -s/2, s, s);
      ctx.strokeRect(-s/2, -s/2, s, s);
    } else if (obj.shape === 'PYRAMID') {
      const s = obj.radius * 1.8;
      ctx.translate(obj.x, obj.y);
      ctx.rotate(performance.now() / 1000); 
      ctx.beginPath();
      ctx.moveTo(0, -s/1.5);
      ctx.lineTo(s/1.5, s/2);
      ctx.lineTo(-s/1.5, s/2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawHudCursor = (ctx: CanvasRenderingContext2D, x: number, y: number, pinching: boolean, mode: string, pinchVal: number, releaseProgress: number, screenMode: ScreenMode, tilt: number) => {
    ctx.save();
    ctx.translate(x, y);
    
    let color;
    if (screenMode === 'BROWSE') {
         if (mode === 'PINCH') color = '#FACC15'; 
         else color = '#38BDF8'; 
    } else {
         if (mode === 'LOCKED') color = '#F43F5E';
         else if (mode === 'PINCH') color = '#E879F9';
         else if (mode === 'OPEN') color = '#34D399';
         else color = '#22D3EE';
    }

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
    
    // Scroll Gauge
    if (screenMode === 'BROWSE') {
        const gaugeH = 40;
        const xOff = 35;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(xOff, -gaugeH/2, 4, gaugeH);
        
        const tiltVal = Math.min(1, Math.max(-1, tilt)); 
        const isScrolling = Math.abs(tiltVal) > 0.6;
        
        ctx.fillStyle = isScrolling ? (tiltVal > 0 ? '#FACC15' : '#34D399') : '#fff';
        const indicatorY = tiltVal * (gaugeH/2);
        ctx.fillRect(xOff - 2, indicatorY - 2, 8, 4);
    }

    if (mode === 'LOCKED' && releaseProgress > 0) {
        ctx.beginPath(); ctx.arc(0, 0, 30 + releaseProgress * 20, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(244, 63, 94, ${1 - releaseProgress})`;
        ctx.stroke();
    }

    if (mode !== 'LOCKED') {
        const visualPinch = Math.min(1, Math.max(0, pinchVal));
        if (visualPinch < 0.6) { 
            ctx.beginPath(); ctx.arc(0, 0, Math.max(8, visualPinch * 60), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(232, 121, 249, ${0.8 - visualPinch})`; 
            ctx.fill(); ctx.stroke();
        }
    }

    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  useEffect(() => {
    initializeMediaPipe();
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [initializeMediaPipe]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover opacity-0 pointer-events-none"
        playsInline autoPlay muted crossOrigin="anonymous"
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full block touch-none cursor-none pointer-events-none"
      />
    </div>
  );
};

export default GestureCanvas;