
import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GameState, PhysicsObject, ScreenMode, CursorData, PlaygroundActivity, MechaObject, MechaObjectType } from '../types';
import { updatePhysics, smoothPointAdaptive, distance, smoothScalar } from '../utils/physics';

interface GestureCanvasProps {
  onStateChange: (state: GameState) => void;
  mode: ScreenMode;
  playgroundActivity: PlaygroundActivity;
  onCursorUpdate?: (data: CursorData) => void;
}

export interface GestureCanvasRef {
  spawnMechaObject: (type: MechaObjectType) => void;
}

const GestureCanvas = forwardRef<GestureCanvasRef, GestureCanvasProps>(({ onStateChange, mode, playgroundActivity, onCursorUpdate }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  const modeRef = useRef<ScreenMode>(mode);
  const activityRef = useRef<PlaygroundActivity>(playgroundActivity);
  
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const grabbedObjectIdRef = useRef<number | null>(null);
  const missedFramesRef = useRef<number>(0);
  const prevHandPosRef = useRef<{x: number, y: number} | null>(null);
  const rawLandmarksRef = useRef<any>(null); 

  // --- SCI-FI OBJECTS ---
  const objectsRef = useRef<PhysicsObject[]>([
    { id: 1, x: window.innerWidth * 0.3, y: window.innerHeight * 0.5, vx: 0, vy: 0, radius: 50, color: '#06B6D4', glowColor: '#22D3EE', shape: 'ORB', isGrabbed: false, isHovered: false, mass: 1, friction: 0.97, restitution: 0.85 },
    { id: 2, x: window.innerWidth * 0.5, y: window.innerHeight * 0.5, vx: 0, vy: 0, radius: 55, color: '#D946EF', glowColor: '#E879F9', shape: 'CUBE', isGrabbed: false, isHovered: false, mass: 1.5, friction: 0.95, restitution: 0.6 },
    { id: 3, x: window.innerWidth * 0.7, y: window.innerHeight * 0.5, vx: 0, vy: 0, radius: 50, color: '#10B981', glowColor: '#34D399', shape: 'PYRAMID', isGrabbed: false, isHovered: false, mass: 0.8, friction: 0.98, restitution: 0.9 }
  ]);

  // --- MECHA OBJECTS ---
  const mechaObjectsRef = useRef<MechaObject[]>([]);
  const grabbedMechaIdRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    spawnMechaObject: (type: MechaObjectType) => {
        const id = Date.now();
        const obj: MechaObject = {
            id, type, 
            x: window.innerWidth / 2, y: 100, 
            vx: (Math.random() - 0.5) * 5, vy: 0, // Lower initial velocity
            angle: 0, angularVelocity: (Math.random() - 0.5) * 0.1, 
            isGrabbed: false, scale: type === 'KATANA' ? 2.5 : 2.0,
            color: type === 'KATANA' ? '#f43f5e' : (type === 'BOTTLE' ? '#3b82f6' : (type === 'BUCKET' ? '#eab308' : '#22c55e'))
        };
        mechaObjectsRef.current.push(obj);
    }
  }));

  const cursorRef = useRef<{ 
    x: number, y: number, pinching: boolean, visible: boolean, mode: 'OPEN' | 'POINT' | 'PINCH' | 'LOCKED', pinchVal: number, releaseProgress: number, tilt: number,
    fistStrength: number, roll: number
  }>({
    x: 0.5, y: 0.5, pinching: false, visible: false, mode: 'OPEN', pinchVal: 1, releaseProgress: 0, tilt: 0, fistStrength: 0, roll: 0
  });

  const prevCursorRef = useRef<{ x: number, y: number, time: number }>({ x: 0.5, y: 0.5, time: 0 });
  const gridOffsetRef = useRef(0);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { activityRef.current = playgroundActivity; }, [playgroundActivity]);

  const initializeMediaPipe = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm");
      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" },
        runningMode: "VIDEO", numHands: 1
      });
      handLandmarkerRef.current = handLandmarker;
      startCamera();
    } catch (error) { onStateChange(GameState.ERROR); }
  }, [onStateChange]);

  const startCamera = async () => {
    onStateChange(GameState.WAITING_PERMISSIONS);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", () => { onStateChange(GameState.RUNNING); predictWebcam(); });
      }
    } catch (error) { 
        console.error(error);
        if (error instanceof DOMException && error.name === "NotAllowedError") {
             // Permission denied explicitly
        }
        onStateChange(GameState.ERROR); 
    }
  };

  const calculateFistStrength = (landmarks: any[]) => {
      // 1. Calculate average distance from fingertips to wrist
      const wrist = landmarks[0];
      const tips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]]; 
      let totalDist = 0;
      tips.forEach(t => {
          totalDist += Math.hypot(t.x - wrist.x, t.y - wrist.y);
      });
      const avgDist = totalDist / 4;

      // 2. Map distance to strength (Linear Map)
      // Tuned for better responsiveness
      const OPEN_THRESHOLD = 0.55;
      const CLOSED_THRESHOLD = 0.20;
      
      let strength = (OPEN_THRESHOLD - avgDist) / (OPEN_THRESHOLD - CLOSED_THRESHOLD);
      strength = Math.max(0, Math.min(1, strength)); 
      
      return strength;
  };

  const predictWebcam = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    }

    let results;
    try { if(video.videoWidth > 0 && handLandmarkerRef.current) results = handLandmarkerRef.current.detectForVideo(video, performance.now()); } catch(e) {}

    const cursor = cursorRef.current;
    
    if (modeRef.current === 'BROWSE') {
        if(ctx) ctx.clearRect(0,0, canvas.width, canvas.height);
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
    }

    if (results && results.landmarks && results.landmarks.length > 0) {
      missedFramesRef.current = 0;
      const landmarks = results.landmarks[0];
      rawLandmarksRef.current = landmarks;
      
      const wrist = landmarks[0];
      const indexMCP = landmarks[5]; const pinkyMCP = landmarks[17]; const middleMCP = landmarks[9];
      const middleTip = landmarks[12];
      
      const handScale = Math.max(Math.hypot(indexMCP.x - wrist.x, indexMCP.y - wrist.y), Math.hypot(pinkyMCP.x - wrist.x, pinkyMCP.y - wrist.y));
      
      // Calculate Pitch & Roll
      const handVectorY = middleTip.y - wrist.y; 
      cursor.tilt = smoothScalar(cursor.tilt, handVectorY / handScale, 0.15);
      
      const dx = pinkyMCP.x - indexMCP.x;
      const dy = pinkyMCP.y - indexMCP.y;
      cursor.roll = Math.atan2(dy, dx);

      // Safe Zone Mapping
      const knuckleMidX = (indexMCP.x + middleMCP.x + pinkyMCP.x) / 3;
      const knuckleMidY = (indexMCP.y + middleMCP.y + pinkyMCP.y) / 3;
      
      const minCam = 0.2; const maxCam = 0.8;
      const range = maxCam - minCam;
      let normX = (knuckleMidX - minCam) / range;
      let normY = (knuckleMidY - minCam) / range;
      normX = Math.max(0, Math.min(1, normX));
      normY = Math.max(0, Math.min(1, normY));

      const palmDirX = knuckleMidX - wrist.x;
      const palmDirY = knuckleMidY - wrist.y;
      const virtualTipX = normX + palmDirX * 1.5; 
      const virtualTipY = normY + palmDirY * 1.5;

      const rawTargetX = (1 - virtualTipX) * canvas.width; 
      const rawTargetY = virtualTipY * canvas.height;
      
      const minAlpha = modeRef.current === 'BROWSE' ? 0.05 : 0.12; 
      const smoothed = smoothPointAdaptive({x: cursor.x, y: cursor.y}, {x: rawTargetX, y: rawTargetY}, minAlpha, 0.75);
      cursor.x = smoothed.x; cursor.y = smoothed.y;
      
      cursor.fistStrength = calculateFistStrength(landmarks);
      const thumbTip = landmarks[4]; const indexTip = landmarks[8];
      const rawPinch = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
      cursor.pinchVal = smoothScalar(cursor.pinchVal, rawPinch / handScale, 0.3);
      cursor.pinching = cursor.pinchVal < 0.18;
      cursor.visible = true;

      // --- ACTIVITY LOGIC ---
      if (modeRef.current === 'PLAYGROUND') {
          if (activityRef.current === 'SHAPES') {
              objectsRef.current.forEach(obj => {
                 const d = distance({x: cursor.x, y: cursor.y}, {x: obj.x, y: obj.y});
                 if (cursor.pinching && d < obj.radius + 60 && !grabbedObjectIdRef.current) {
                     grabbedObjectIdRef.current = obj.id; obj.isGrabbed = true;
                 }
                 if (!cursor.pinching && obj.id === grabbedObjectIdRef.current) {
                     obj.isGrabbed = false; grabbedObjectIdRef.current = null;
                     obj.vx = (cursor.x - prevCursorRef.current.x) * 0.9;
                     obj.vy = (cursor.y - prevCursorRef.current.y) * 0.9;
                 }
                 if (obj.isGrabbed) { obj.x += (cursor.x - obj.x)*0.92; obj.y += (cursor.y - obj.y)*0.92; obj.vx=0; obj.vy=0; }
              });
          } else if (activityRef.current === 'ROBOT') {
              const handX = (1 - knuckleMidX) * canvas.width; 
              const handY = knuckleMidY * canvas.height;
              
              mechaObjectsRef.current.forEach(obj => {
                  const d = Math.hypot(handX - obj.x, handY - obj.y);
                  
                  // Easier Grab: Threshold 0.4, Distance 160
                  if (cursor.fistStrength > 0.4 && d < 160 && !grabbedMechaIdRef.current) {
                      grabbedMechaIdRef.current = obj.id;
                      obj.isGrabbed = true;
                  }
                  
                  // Release Throw
                  if (cursor.fistStrength < 0.35 && obj.id === grabbedMechaIdRef.current) {
                      obj.isGrabbed = false; grabbedMechaIdRef.current = null;
                      // Clamp Throw Velocity to prevent "Orbit" launches
                      let vx = (cursor.x - prevCursorRef.current.x);
                      let vy = (cursor.y - prevCursorRef.current.y);
                      
                      const maxVel = 25; // Terminal throw speed
                      vx = Math.max(-maxVel, Math.min(maxVel, vx));
                      vy = Math.max(-maxVel, Math.min(maxVel, vy));

                      obj.vx = vx; obj.vy = vy;
                      obj.angularVelocity = (Math.random() - 0.5) * 0.3;
                  }

                  // Hand Collision (Push)
                  if (!obj.isGrabbed && d < 80) {
                      const angle = Math.atan2(obj.y - handY, obj.x - handX);
                      const force = 3; // Reduced push force
                      obj.vx += Math.cos(angle) * force;
                      obj.vy += Math.sin(angle) * force;
                  }

                  if (obj.isGrabbed) {
                      obj.x += (handX - obj.x) * 0.9; 
                      obj.y += (handY - obj.y) * 0.9;
                      obj.angle = smoothScalar(obj.angle, cursor.roll + Math.PI/2, 0.2); 
                      obj.vx = 0; obj.vy = 0; obj.angularVelocity = 0;
                  }
              });
          }
      }

      prevCursorRef.current = { x: cursor.x, y: cursor.y, time: performance.now() };
      if (onCursorUpdate) onCursorUpdate({ x: cursor.x, y: cursor.y, pinching: cursor.pinching, gestureMode: cursor.mode, pinchVal: cursor.pinchVal, timestamp: performance.now(), tilt: cursor.tilt });

    } else {
      missedFramesRef.current++;
      if (missedFramesRef.current > 8) { cursor.visible = false; rawLandmarksRef.current = null; }
    }

    // --- PHYSICS UPDATES ---
    if (modeRef.current === 'PLAYGROUND') {
        if (activityRef.current === 'SHAPES') {
            objectsRef.current.forEach(obj => updatePhysics(obj, { width: canvas.width, height: canvas.height }));
        } else if (activityRef.current === 'ROBOT') {
            mechaObjectsRef.current.forEach(obj => updateMechaPhysics(obj, canvas.width, canvas.height));
        }
    }

    // --- RENDER ---
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGrid(ctx, canvas.width, canvas.height, modeRef.current);
      
      if (modeRef.current === 'PLAYGROUND') {
        if (activityRef.current === 'SHAPES') {
            objectsRef.current.forEach(obj => drawSciFiObject(ctx, obj));
        } else if (activityRef.current === 'ROBOT') {
            if (rawLandmarksRef.current) drawRoboticHand(ctx, rawLandmarksRef.current, canvas.width, canvas.height, cursor.fistStrength);
            drawMechaEnvironment(ctx, mechaObjectsRef.current, canvas.width, canvas.height);
        }
      }
      
      if (cursor.visible && (modeRef.current === 'BROWSE' || activityRef.current === 'SHAPES')) {
        drawHudCursor(ctx, cursor.x, cursor.y, cursor.pinching, cursor.mode, cursor.pinchVal, cursor.releaseProgress, modeRef.current, cursor.tilt);
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const updateMechaPhysics = (obj: MechaObject, width: number, height: number) => {
      if (obj.isGrabbed) return;
      
      const gravity = 0.55; 
      const airResistance = 0.99; // Prevents "flying forever"
      const floorY = height - 50;
      const restitution = 0.45; // Less bouncy
      const floorFriction = 0.92; // Slides to a stop

      obj.vy += gravity;
      obj.vx *= airResistance;
      obj.vy *= airResistance;
      
      obj.x += obj.vx;
      obj.y += obj.vy;
      obj.angle += obj.angularVelocity;
      obj.angularVelocity *= 0.98; // Rotational drag

      // Floor Collision
      const objectBottom = obj.y + (30 * obj.scale * 0.5); // Approx collision radius
      
      if (objectBottom > floorY) {
          obj.y = floorY - (30 * obj.scale * 0.5); // Correct pos
          
          if (Math.abs(obj.vy) > 3) {
              obj.vy *= -restitution;
          } else {
              obj.vy = 0; // Settle
          }
          
          obj.vx *= floorFriction;
          obj.angularVelocity *= 0.8;
      }
      
      // Walls
      if (obj.x < 0) { obj.x = 0; obj.vx *= -0.6; }
      if (obj.x > width) { obj.x = width; obj.vx *= -0.6; }
  };

  const drawMechaEnvironment = (ctx: CanvasRenderingContext2D, objects: MechaObject[], width: number, height: number) => {
      // Floor
      const floorY = height - 50;
      ctx.save();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(width, floorY); ctx.stroke();
      
      // Objects
      objects.forEach(obj => {
          ctx.save();
          ctx.translate(obj.x, obj.y);
          ctx.rotate(obj.angle);
          ctx.scale(obj.scale, obj.scale); 
          ctx.strokeStyle = obj.color;
          ctx.lineWidth = 3;
          ctx.shadowColor = obj.color;
          ctx.shadowBlur = 10;
          
          if (obj.type === 'KATANA') {
              ctx.beginPath();
              ctx.moveTo(-40, 0); ctx.lineTo(40, 0); // Blade
              ctx.moveTo(-40, 0); ctx.lineTo(-50, 5); ctx.lineTo(-50, -5); ctx.closePath(); // Handle
              ctx.stroke();
          } else if (obj.type === 'BOTTLE') {
              ctx.strokeRect(-15, -30, 30, 60);
              ctx.strokeRect(-10, -45, 20, 15);
          } else if (obj.type === 'BUCKET') {
              ctx.beginPath(); ctx.moveTo(-20, -20); ctx.lineTo(20, -20); ctx.lineTo(15, 20); ctx.lineTo(-15, 20); ctx.closePath(); ctx.stroke();
              ctx.beginPath(); ctx.arc(0, -20, 20, Math.PI, 0); ctx.stroke();
          } else if (obj.type === 'BALL') {
              ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.stroke();
          }
          ctx.restore();
      });
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
      ctx.beginPath(); ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2); ctx.fillStyle = obj.color; ctx.fill(); ctx.stroke();
    } else if (obj.shape === 'CUBE') {
      const s = obj.radius * 1.6; ctx.translate(obj.x, obj.y); ctx.rotate((obj.vx + obj.vy) * 0.05); ctx.fillRect(-s/2, -s/2, s, s); ctx.strokeRect(-s/2, -s/2, s, s);
    } else if (obj.shape === 'PYRAMID') {
      const s = obj.radius * 1.8; ctx.translate(obj.x, obj.y); ctx.rotate(performance.now() / 1000); 
      ctx.beginPath(); ctx.moveTo(0, -s/1.5); ctx.lineTo(s/1.5, s/2); ctx.lineTo(-s/1.5, s/2); ctx.closePath(); ctx.fill(); ctx.stroke();
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
    
    if (screenMode === 'BROWSE') {
        const gaugeH = 40; const xOff = 35;
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(xOff, -gaugeH/2, 4, gaugeH);
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

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, mode: ScreenMode) => {
    ctx.save();
    const opacity = mode === 'BROWSE' ? 0.05 : 0.15;
    ctx.strokeStyle = `rgba(6, 182, 212, ${opacity})`; 
    ctx.lineWidth = 1;
    const gridSize = 60;
    gridOffsetRef.current = (gridOffsetRef.current + 0.5) % gridSize;
    for (let x = 0; x <= width; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = gridOffsetRef.current; y <= height; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.restore();
  };

  const drawRoboticHand = (ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number, fistStrength: number) => {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const map = (lm: any) => {
        const zScale = 1 + (Math.abs(lm.z) * 4); 
        const x = (1 - lm.x) * width; const y = lm.y * height;
        return { x, y, scale: zScale, z: lm.z };
    };
    const points = landmarks.map(map);
    const fingers = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20]];

    const center = points[9]; 
    const ringRadius = 80;
    ctx.beginPath();
    ctx.arc(center.x, center.y, ringRadius, 0, Math.PI * 2);
    if (fistStrength > 0.4) {
        ctx.strokeStyle = '#F43F5E'; ctx.lineWidth = 4; // Locked
        ctx.shadowColor = '#F43F5E';
    } else if (fistStrength > 0.2) {
        ctx.strokeStyle = '#FACC15'; ctx.lineWidth = 2; // Forming
        ctx.shadowColor = '#FACC15';
    } else {
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)'; ctx.lineWidth = 1; // Idle
        ctx.shadowColor = '#22D3EE';
    }
    ctx.shadowBlur = 15;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); ctx.lineTo(points[5].x, points[5].y); ctx.lineTo(points[17].x, points[17].y); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(points[5].x, points[5].y); ctx.lineTo(points[17].x, points[17].y); ctx.stroke();

    fingers.forEach(indices => {
        ctx.beginPath();
        for (let i = 0; i < indices.length - 1; i++) {
            const curr = points[indices[i]]; const next = points[indices[i+1]];
            ctx.moveTo(curr.x, curr.y); ctx.lineTo(next.x, next.y);
        }
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)'; ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = '#22D3EE'; ctx.stroke();
        
        indices.forEach((idx, pos) => {
            const p = points[idx]; const size = (pos === 0 ? 10 : 6) * p.scale; 
            ctx.beginPath(); ctx.fillStyle = '#0f172a'; ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            if (pos === 4) { ctx.strokeStyle = '#F472B6'; ctx.arc(p.x, p.y, size * 0.8, 0, Math.PI * 2); } 
            else {
                 ctx.strokeStyle = '#22D3EE'; 
                 const sides = 6;
                 for (let k = 0; k < sides; k++) {
                     const angle = (k * 2 * Math.PI) / sides;
                     const hx = p.x + size * 0.8 * Math.cos(angle);
                     const hy = p.y + size * 0.8 * Math.sin(angle);
                     if (k===0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
                 }
                 ctx.closePath();
            }
            ctx.lineWidth = 2; ctx.stroke();
            ctx.beginPath(); ctx.fillStyle = '#fff'; ctx.arc(p.x, p.y, size * 0.2, 0, Math.PI * 2); ctx.fill();
        });
    });
    ctx.restore();
  };

  useEffect(() => { initializeMediaPipe(); return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); }; }, [initializeMediaPipe]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <video ref={videoRef} className="absolute top-0 left-0 w-full h-full object-cover opacity-0 pointer-events-none" playsInline autoPlay muted crossOrigin="anonymous" style={{ transform: 'scaleX(-1)' }} />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full block touch-none cursor-none pointer-events-none" />
    </div>
  );
});

export default GestureCanvas;
