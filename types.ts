export interface Point {
  x: number;
  y: number;
}

export type ShapeType = 'ORB' | 'CUBE' | 'PYRAMID';

export type ScreenMode = 'PLAYGROUND' | 'BROWSE';

export interface CursorData {
  x: number;
  y: number;
  pinching: boolean;
  gestureMode: 'OPEN' | 'POINT' | 'PINCH' | 'LOCKED';
  pinchVal: number;
  timestamp: number;
  tilt: number; // New property for scroll gesture (Pitch)
}

export interface PhysicsObject {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number; // Used for physics collision radius
  color: string;
  glowColor: string;
  shape: ShapeType;
  isGrabbed: boolean;
  isHovered: boolean; // Visual state for when cursor is over it
  mass: number;
  friction: number;
  restitution: number; // Bounciness
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

// JARVIS TYPES
export type JarvisStatus = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING';

export interface JarvisCommand {
  action: 'OPEN_TAB' | 'CLOSE_TAB' | 'SEARCH' | 'SCROLL_DOWN' | 'SCROLL_UP' | 'GO_HOME' | 'NONE';
  payload?: string; // e.g., search query or url
  response?: string; // spoken response
}
