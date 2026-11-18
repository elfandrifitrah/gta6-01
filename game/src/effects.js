// Transient juice: particles, tracers, floating text and screen shake.
// Pooled arrays keep the frame allocation-free; everything here is cosmetic,
// so nothing in this module changes the simulation's outcome.

import { clamp } from './vec.js';

const MAX_PARTICLES = 240;

export function createEffects() {
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#fff', drag: 0.9, gravity: 0 });
  }
  const floaters = [];
  const tracers = [];
  let trauma = 0;
  let time = 0;

  function spawn(x, y, vx, vy, life, size, color, drag = 0.88, gravity = 0) {
    // Prefer a free slot. When the pool is full (a firefight saturates it),
    // recycle the particle nearest death instead of dropping the new one,
    // so fresh muzzle flashes and sparks stay visible under load.
    let slot = null;
    let oldestLife = Infinity;
    for (const p of particles) {
      if (!p.active) { slot = p; break; }
      if (p.life < oldestLife) { oldestLife = p.life; slot = p; }
    }
    if (!slot) return;
    const p = slot;
    p.active = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life; p.size = size; p.color = color;
    p.drag = drag; p.gravity = gravity;
  }

  return {
    trauma: 0,
    burst(x, y, color, count, speed, life = 0.5, size = 4) {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.7);
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.8), color);
      }
    },
    sparks(x, y) { this.burst(x, y, '#ffd94d', 10, 260, 0.35, 3); },
    dust(x, y) { this.burst(x, y, '#c9b18a', 3, 60, 0.6, 6); },
    smoke(x, y) { this.burst(x, y, 'rgba(220,215,205,0.7)', 2, 40, 0.7, 7); },
    hitStars(x, y) { this.burst(x, y, '#fff3c4', 8, 200, 0.3, 4); },
    muzzle(x, y) { this.burst(x, y, '#ffdf6b', 4, 120, 0.09, 5); },
    pickupSparkle(x, y) { this.burst(x, y, '#f2c14e', 12, 130, 0.55, 3); },
    tracer(x1, y1, x2, y2) {
      tracers.push({ x1, y1, x2, y2, life: 0.09 });
      if (tracers.length > 24) tracers.shift();
    },
    floatText(text, x, y, color) {
      floaters.push({ text, x, y, life: 1.1, color });
      if (floaters.length > 16) floaters.shift();
    },
    shake(amount) {
      trauma = clamp(trauma + amount, 0, 1);
    },
    shakeOffset() {
      const s = trauma * trauma * 14;
      return {
        x: Math.sin(time * 91.7) * s,
        y: Math.cos(time * 113.3) * s,
      };
    },
    update(dt) {
      time += dt;
      trauma = Math.max(0, trauma - dt * 1.6);
      this.trauma = trauma;
      for (const p of particles) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) { p.active = false; continue; }
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = floaters.length - 1; i >= 0; i -= 1) {
        floaters[i].life -= dt;
        floaters[i].y -= 34 * dt;
        if (floaters[i].life <= 0) floaters.splice(i, 1);
      }
      for (let i = tracers.length - 1; i >= 0; i -= 1) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) tracers.splice(i, 1);
      }
    },
    drawWorld(ctx) {
      for (const t of tracers) {
        ctx.strokeStyle = `rgba(255,236,170,${clamp(t.life / 0.09, 0, 1)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();
      }
      for (const p of particles) {
        if (!p.active) continue;
        ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    drawFloaters(ctx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const f of floaters) {
        ctx.globalAlpha = clamp(f.life, 0, 1);
        ctx.font = '700 20px system-ui, sans-serif';
        ctx.fillStyle = f.color;
        ctx.strokeStyle = 'rgba(20,12,6,0.8)';
        ctx.lineWidth = 4;
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
    },
  };
}
