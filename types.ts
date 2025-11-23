export interface Point {
  x: number;
  y: number;
}

export type ShapeType = 'ORB' | 'CUBE' | 'PYRAMID';

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