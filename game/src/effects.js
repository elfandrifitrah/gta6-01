// Particles, floating text, muzzle flashes and screen shake: short-lived feedback for
// crashes, hits, pickups and payouts.

export function spawnSparks(G, x, y, z, n, color) {
  for (let i = 0; i < n; i += 1) {
    if (G.particles.length > 260) G.particles.shift();
    G.particles.push({
      x, y, z,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * 6 + 1,
      vz: (Math.random() - 0.5) * 9,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.7,
      color: color || [255, 200, 110],
      size: 0.22,
      grav: 14,
    });
  }
}

export function spawnSmoke(G, x, y, z, n, color) {
  for (let i = 0; i < n; i += 1) {
    if (G.particles.length > 260) G.particles.shift();
    G.particles.push({
      x: x + (Math.random() - 0.5),
      y,
      z: z + (Math.random() - 0.5),
      vx: (Math.random() - 0.5) * 2,
      vy: 1.2 + Math.random(),
      vz: (Math.random() - 0.5) * 2,
      life: 0.7 + Math.random() * 0.6,
      maxLife: 1.3,
      color: color || [150, 140, 132],
      size: 0.5,
      grav: -0.6,
    });
  }
}

export function spawnDust(G, x, z, n) {
  spawnSmoke(G, x, 0.4, z, n, [170, 150, 120]);
}

export function spawnFloater(G, x, y, z, text, color) {
  G.floaters.push({ x, y, z, text, color: color || '#ffd257', life: 1.4, maxLife: 1.4 });
  if (G.floaters.length > 12) G.floaters.shift();
}

export function addShake(G, amount) {
  G.shake = Math.min(1.4, (G.shake || 0) + amount);
}

export function updateEffects(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i -= 1) {
    const p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) { G.particles.splice(i, 1); continue; }
    p.vy -= p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
  }
  for (let i = G.floaters.length - 1; i >= 0; i -= 1) {
    const f = G.floaters[i];
    f.life -= dt;
    f.y += dt * 1.6;
    if (f.life <= 0) G.floaters.splice(i, 1);
  }
  for (let i = G.flashes.length - 1; i >= 0; i -= 1) {
    G.flashes[i].life -= dt;
    if (G.flashes[i].life <= 0) G.flashes.splice(i, 1);
  }
  G.shake = Math.max(0, (G.shake || 0) - dt * 2.4);
  G.damageFlash = Math.max(0, (G.damageFlash || 0) - dt * 1.8);
}
