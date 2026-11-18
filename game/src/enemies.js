// Hostile characters: the suitcase thief who runs, the goons who swing, and
// the port guards who shoot. Each one is a small state machine with a health
// bar; spawn points are always resolved to open ground first.

import { findFreeSpot, collideCircle } from './city.js';
import { clamp, dist, dampAngle } from './vec.js';

export function createEnemies() {
  return { list: [] };
}

function baseEnemy(kind, x, y, hp) {
  return {
    kind, x, y, heading: 0, hp, maxHp: hp, state: 'idle', t: 0,
    tx: 0, ty: 0, shootCd: 1, telegraph: 0, punchCd: 0, flash: 0,
    phase: Math.random() * 6, dead: false, speed: 150,
  };
}

export function spawnThief(S, x, y) {
  const spot = findFreeSpot(S.city, x, y, 16);
  const thief = baseEnemy('thief', spot.x, spot.y, 100);
  thief.state = 'run';
  thief.speed = 238;
  S.enemies.list.push(thief);
  return thief;
}

export function spawnGoon(S, x, y) {
  const spot = findFreeSpot(S.city, x, y, 16);
  const goon = baseEnemy('goon', spot.x, spot.y, 70);
  goon.state = 'chase';
  goon.speed = 185;
  S.enemies.list.push(goon);
  return goon;
}

export function spawnGuard(S, x, y) {
  const spot = findFreeSpot(S.city, x, y, 16);
  const guard = baseEnemy('guard', spot.x, spot.y, 60);
  guard.state = 'alert';
  guard.speed = 150;
  S.enemies.list.push(guard);
  return guard;
}

function stepThief(S, e, dt) {
  const player = S.player;
  if (e.hp <= 0) return;
  // Run to the alley waypoint farthest from Bimo, then pick again.
  const dTarget = dist(e.x, e.y, e.tx, e.ty);
  if (dTarget < 30 || e.t <= 0) {
    let best = null;
    let bestD = -1;
    for (const w of S.city.thiefWaypoints) {
      const d = dist(w.x, w.y, player.x, player.y);
      if (d > bestD) {
        bestD = d;
        best = w;
      }
    }
    if (best) {
      e.tx = best.x;
      e.ty = best.y;
    }
    e.t = 2.5;
  }
  e.t -= dt;
  e.heading = dampAngle(e.heading, Math.atan2(e.ty - e.y, e.tx - e.x), 5, dt);
  e.x += Math.cos(e.heading) * e.speed * dt;
  e.y += Math.sin(e.heading) * e.speed * dt;
  e.phase += dt * 8;
}

function stepGoon(S, e, dt) {
  const player = S.player;
  const d = dist(e.x, e.y, player.x, player.y);
  e.punchCd = Math.max(0, e.punchCd - dt);
  // Their boss is down: the goons scatter instead of fighting to the death,
  // so the walk back with the suitcase stays fair.
  if (!S.enemies.list.some((o) => o.kind === 'thief' && !o.dead)) {
    e.state = 'flee';
    if (d < 420) {
      e.heading = dampAngle(e.heading, Math.atan2(e.y - player.y, e.x - player.x), 6, dt);
      e.x += Math.cos(e.heading) * e.speed * dt;
      e.y += Math.sin(e.heading) * e.speed * dt;
      e.phase += dt * 8;
    }
    return;
  }
  if (d > 420) {
    e.state = 'idle';
    return;
  }
  e.state = 'chase';
  if (d > 44) {
    e.heading = dampAngle(e.heading, Math.atan2(player.y - e.y, player.x - e.x), 6, dt);
    e.x += Math.cos(e.heading) * e.speed * dt;
    e.y += Math.sin(e.heading) * e.speed * dt;
    e.phase += dt * 8;
  } else if (e.punchCd <= 0 && !player.car) {
    e.punchCd = 0.85;
    e.telegraph = 0.3;
    S.pendingHits.push({ at: S.time + 0.3, from: e, damage: 8, range: 56 });
    S.audio.punch();
  }
}

function stepGuard(S, e, dt) {
  const player = S.player;
  const d = dist(e.x, e.y, player.x, player.y);
  e.shootCd -= dt;
  if (d > 560) {
    e.state = 'idle';
    return;
  }
  e.state = 'alert';
  // Keep a firing distance: strafe sideways, close in when too far, back off close up.
  const toPlayer = Math.atan2(player.y - e.y, player.x - e.x);
  let moveAngle = toPlayer + Math.PI / 2;
  if (d > 330) moveAngle = toPlayer;
  else if (d < 190) moveAngle = toPlayer + Math.PI;
  if (Math.sin(S.time * 0.7 + e.phase) < 0) moveAngle += Math.PI;
  e.heading = dampAngle(e.heading, toPlayer, 7, dt);
  e.x += Math.cos(moveAngle) * e.speed * 0.55 * dt;
  e.y += Math.sin(moveAngle) * e.speed * 0.55 * dt;
  if (e.telegraph > 0) {
    e.telegraph -= dt;
    if (e.telegraph <= 0) {
      S.fireShot(e.x, e.y, Math.atan2(player.y - e.y, player.x - e.x) + (Math.random() - 0.5) * 0.14, 'guard');
    }
  } else if (e.shootCd <= 0 && d < 520) {
    e.telegraph = 0.35;
    e.shootCd = 1.35 + Math.random() * 0.5;
  }
}

export function stepEnemies(S, dt) {
  for (const e of S.enemies.list) {
    if (e.dead) {
      e.deathT = Math.max(0, (e.deathT || 0) - dt);
      continue;
    }
    e.flash = Math.max(0, e.flash - dt);
    if (e.kind === 'thief') stepThief(S, e, dt);
    else if (e.kind === 'goon') stepGoon(S, e, dt);
    else if (e.kind === 'guard') stepGuard(S, e, dt);
    const fixed = collideCircle(S.city, e.x, e.y, 15);
    e.x = fixed.x;
    e.y = fixed.y;
  }
  S.enemies.list = S.enemies.list.filter((e) => !e.dead || e.deathT > 0);
}
