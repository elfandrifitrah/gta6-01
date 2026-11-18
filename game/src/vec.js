// Tiny math helpers shared by the simulation: clamping, easing and angles.

export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Frame-rate independent smoothing toward a target: higher lambda snaps faster. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Ease-out curve for entrances: fast start, soft landing. */
export function easeOut(t) {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

/** Ease-out with a slight overshoot, for banners that pop into place. */
export function easeOutBack(t) {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

export function wrapAngle(angle) {
  let a = angle % TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

export function dampAngle(current, target, lambda, dt) {
  // Wrap the result, not just the delta: without this a heading chased
  // across the +/-PI seam drifts outside the range a frame at a time and
  // never comes back, which makes long chases wobble.
  return wrapAngle(current + wrapAngle(target - current) * (1 - Math.exp(-lambda * dt)));
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function len(x, y) {
  return Math.hypot(x, y);
}
