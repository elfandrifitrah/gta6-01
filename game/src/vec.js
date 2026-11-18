// 3D camera math for the software renderer: basis vectors, projection, near-plane clipping.

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export function angLerp(a, b, t) { return a + wrapAngle(b - a) * t; }
export function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

/**
 * Camera basis. yaw turns around Y (forward is (sin yaw, 0, cos yaw) when level),
 * pitch looks down. Returns forward/right/up rows and the focal length in pixels.
 */
export function cameraBasis(cam) {
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const sy = Math.sin(cam.yaw);
  const cy = Math.cos(cam.yaw);
  const f = [sy * cp, -sp, cy * cp];
  const r = [cy, 0, -sy];
  const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  return { f, r, u, focal: (cam.h / 2) / Math.tan(cam.fov / 2) };
}

export function toCamera(b, cam, x, y, z) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  return [
    dx * b.r[0] + dy * b.r[1] + dz * b.r[2],
    dx * b.u[0] + dy * b.u[1] + dz * b.u[2],
    dx * b.f[0] + dy * b.f[1] + dz * b.f[2],
  ];
}

/** Clip a camera-space polygon against the near plane; null when nothing survives. */
export function clipNear(pts, near) {
  const out = [];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const aIn = a[2] >= near;
    const bIn = b[2] >= near;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (near - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]);
    }
  }
  return out.length >= 3 ? out : null;
}

/** Project world points to screen points. Returns { pts, depth } or null when behind the camera. */
export function projectPoly(b, cam, worldPts, near) {
  const camPts = worldPts.map((p) => toCamera(b, cam, p[0], p[1], p[2]));
  const clipped = clipNear(camPts, near);
  if (!clipped) return null;
  let depth = 0;
  const pts = clipped.map((p) => {
    depth += p[2];
    return [cam.w / 2 + (p[0] * b.focal) / p[2], cam.h / 2 - (p[1] * b.focal) / p[2]];
  });
  return { pts, depth: depth / clipped.length };
}

/** Project one world point; null when behind the near plane. */
export function projectPoint(b, cam, x, y, z, near) {
  const p = toCamera(b, cam, x, y, z);
  if (p[2] < near) return null;
  return [cam.w / 2 + (p[0] * b.focal) / p[2], cam.h / 2 - (p[1] * b.focal) / p[2], p[2]];
}

/** Mix an [r,g,b] colour toward the haze colour and return a CSS string. */
export function hazeColor(rgb, haze, amount, light) {
  const a = clamp(amount, 0, 1);
  const r = Math.round((rgb[0] * light + (haze[0] - rgb[0] * light) * a));
  const g = Math.round((rgb[1] * light + (haze[1] - rgb[1] * light) * a));
  const bl = Math.round((rgb[2] * light + (haze[2] - rgb[2] * light) * a));
  return `rgb(${r},${g},${bl})`;
}

export function rgbString(rgb, light) {
  const l = light === undefined ? 1 : light;
  return `rgb(${Math.round(rgb[0] * l)},${Math.round(rgb[1] * l)},${Math.round(rgb[2] * l)})`;
}
