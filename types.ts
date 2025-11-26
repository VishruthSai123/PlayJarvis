
export interface Point {
  x: number;
  y: number;
}

export type ShapeType = 'ORB' | 'CUBE' | 'PYRAMID';

export type ScreenMode = 'PLAYGROUND' | 'BROWSE';

export type PlaygroundActivity = 'SHAPES' | 'ROBOT' | 'STUDIO_3D';

export type MechaObjectType = 'KATANA' | 'BOTTLE' | 'BUCKET' | 'BALL';

export interface CursorData {
  x: number;
  y: number;
  pinching: boolean;
  gestureMode: 'OPEN' | 'POINT' | 'PINCH' | 'LOCKED';
  pinchVal: number;
  timestamp: number;
  tilt: number; 
}

export interface PhysicsObject {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number; 
  color: string;
  glowColor: string;
  shape: ShapeType;
  isGrabbed: boolean;
  isHovered: boolean; 
  mass: number;
  friction: number;
  restitution: number; 
}

export interface MechaObject {
  id: number;
  type: MechaObjectType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  isGrabbed: boolean;
  scale: number;
  color: string;
}

// --- 3D STUDIO TYPES ---
export interface ThreeDObject {
  id: number;
  type: 'CUBE' | 'SPHERE' | 'PYRAMID' | 'CYLINDER';
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  color: string;
}

export interface Canvas3DState {
  camX: number;
  camY: number;
  camZ: number;
  camRotX: number; // Pitch
  camRotY: number; // Yaw
  zoom: number;
}

export interface HandState {
  present: boolean;
  x: number;
  y: number;
  pinching: boolean;
}

export enum GameState {
  LOADING_MODEL = 'LOADING_MODEL',
  WAITING_PERMISSIONS = 'WAITING_PERMISSIONS',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR'
}

export type JarvisStatus = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING';

export interface JarvisCommand {
  action: 'OPEN_TAB' | 'CLOSE_TAB' | 'SWITCH_TAB' | 'MINIMIZE_TAB' | 'MAXIMIZE_TAB' | 'SEARCH' | 'NAVIGATE' | 'SCROLL_DOWN' | 'SCROLL_UP' | 'GO_HOME' | 'STOP_LISTENING' | 'NONE';
  payload?: string; 
  targetIndex?: number; 
  response?: string; 
}