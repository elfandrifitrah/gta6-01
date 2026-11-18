// The wanted system: stars for crimes the city sees, police cars dispatched to match,
// evasion when the player breaks away, and a bust when the police corner a slow player.

import { WANTED } from './config.js';
import { dist2 } from './vec.js';
import { say } from './hud.js';
import { spawnPoliceCar } from './traffic.js';

export function createWanted() {
  return { level: 0, evadeT: 0, decayT: 0, bustT: 0, shotCooldown: 0, spawnT: 0 };
}

export function addWanted(G, n, reason) {
  const w = G.wanted;
  const before = w.level;
  w.level = Math.min(WANTED.max, w.level + n);
  w.evadeT = 0;
  w.decayT = 0;
  if (w.level > before) {
    say(G, `Wanted level ${w.level}. The police are coming.`, '#ff8a7a');
    G.audio.sirenBlip();
  }
  void reason;
}

export function clearWanted(G) {
  G.wanted.level = 0;
  G.wanted.evadeT = 0;
  G.wanted.decayT = 0;
  G.wanted.bustT = 0;
}

function nearestPolice(G) {
  let best = Infinity;
  for (const v of G.vehicles) {
    if (v.kind !== 'police') continue;
    const d = dist2(v.x, v.z, G.player.x, G.player.z);
    if (d < best) best = d;
  }
  return best;
}

export function updateWanted(G, dt) {
  const w = G.wanted;
  w.shotCooldown = Math.max(0, w.shotCooldown - dt);
  w.spawnT = Math.max(0, w.spawnT - dt);
  if (w.level <= 0) return;
  const want = w.level <= 1 ? 1 : w.level === 2 ? 2 : w.level === 3 ? 3 : 4;
  const have = G.vehicles.filter((v) => v.kind === 'police').length;
  if (have < want && w.spawnT <= 0) {
    if (spawnPoliceCar(G)) w.spawnT = 2;
  }
  const near = nearestPolice(G);
  const p = G.player;
  const speed = p.driving ? Math.abs(p.driving.speed) : p.speed || 0;
  if (near < 7.5 && speed < 3 && !p.dead && !G.shotMode) {
    w.bustT += dt;
    if (w.bustT > 0.8 && !G.bustWarned) {
      G.bustWarned = true;
      say(G, 'The police are closing in. Move.', '#ff8a7a');
    }
    if (w.bustT > WANTED.bustTime) G.pendingBust = true;
  } else {
    w.bustT = Math.max(0, w.bustT - dt * 2);
    if (w.bustT === 0) G.bustWarned = false;
  }
  if (near > WANTED.evadeSight) {
    w.evadeT += dt;
    if (w.evadeT > WANTED.evadeTime) {
      w.decayT += dt;
      if (w.decayT > WANTED.decayTime) {
        w.decayT = 0;
        w.evadeT = 0;
        w.level -= 1;
        if (w.level === 0) say(G, 'You lost the police.', '#9fe08a');
        else say(G, `Wanted level ${w.level}.`, '#ffd257');
      }
    }
  } else {
    w.evadeT = 0;
    w.decayT = 0;
  }
}
