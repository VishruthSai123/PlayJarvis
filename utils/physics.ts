import { PhysicsObject, Point } from '../types';

export const LERP_FACTOR = 0.2;
export const PINCH_THRESHOLD = 0.05; // Normalized distance

// Exponential Moving Average for smoothing cursor movement
export const smoothPoint = (current: Point, target: Point, alpha: number): Point => {
  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
  };
};

// Adaptive smoothing that reduces jitter when slow, but eliminates lag when fast
export const smoothPointAdaptive = (current: Point, target: Point, minAlpha: number = 0.1, maxAlpha: number = 0.6): Point => {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  
  // Speed Factor Calculation
  // If moving > 100px/frame (fast), use maxAlpha (responsive).
  // If moving < 5px/frame (static), use minAlpha (smooth/stable).
  // We use a squared ease-in curve to aggressively smooth out small jitters.
  const speed = Math.min(dist / 100, 1);
  const smoothFactor = speed * speed; 
  
  const alpha = minAlpha + (maxAlpha - minAlpha) * smoothFactor;

  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
  };
};

// Basic physics update
export const updatePhysics = (obj: PhysicsObject, bounds: { width: number, height: number }) => {
  if (obj.isGrabbed) return;

  // Apply velocity
  obj.x += obj.vx;
  obj.y += obj.vy;

  // Apply friction
  obj.vx *= obj.friction;
  obj.vy *= obj.friction;

  // Stop if very slow
  if (Math.abs(obj.vx) < 0.01) obj.vx = 0;
  if (Math.abs(obj.vy) < 0.01) obj.vy = 0;

  // Wall collisions (bounce)
  if (obj.x - obj.radius < 0) {
    obj.x = obj.radius;
    obj.vx *= -obj.restitution;
  } else if (obj.x + obj.radius > bounds.width) {
    obj.x = bounds.width - obj.radius;
    obj.vx *= -obj.restitution;
  }

  if (obj.y - obj.radius < 0) {
    obj.y = obj.radius;
    obj.vy *= -obj.restitution;
  } else if (obj.y + obj.radius > bounds.height) {
    obj.y = bounds.height - obj.radius;
    obj.vy *= -obj.restitution;
  }
};

export const distance = (p1: Point, p2: Point) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};