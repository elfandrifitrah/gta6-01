// Pedestrians: Jakartans walking the sidewalks, waiting at stalls, fleeing from gunshots
// and speeding cars, and getting knocked down when a car hits them.

import { SHIRT_COLORS } from './config.js';
import { collideCircle, onRoad } from './city.js';
import { angLerp, dist2 } from './vec.js';
import { addShake, spawnDust } from './effects.js';
import { say } from './hud.js';
import { addWanted } from './wanted.js';

const COUNT = 34;

function sidewalkPoint(G, rng) {
  for (let tries = 0; tries < 24; tries += 1) {
    const x = rng.range(-220, 180);
    const z = rng.range(-220, 220);
    if (onRoad(G.city, x, z)) continue;
    const probe = { x, z };
    if (collideCircle(G.city, probe, 0.5)) continue;
    return probe;
  }
  return { x: 6, z: -140 };
}

export function makePed(G, x, z, fleeing) {
  const rng = G.rng;
  return {
    x, z,
    heading: rng.range(0, Math.PI * 2),
    speed: rng.range(1.4, 2.4),
    target: null,
    state: fleeing ? 'flee' : 'walk',
    idleT: rng.range(0, 3),
    downT: 0,
    fleeT: fleeing ? 5 : 0,
    phase: rng.range(0, 6),
    moving: true,
    punchT: 0,
    shirt: rng.pick(SHIRT_COLORS),
    pants: rng.pick([[50, 52, 60], [90, 80, 66], [30, 34, 44], [110, 100, 88]]),
    skin: rng.pick([[196, 150, 110], [170, 126, 92], [214, 168, 128]]),
    hair: [32, 26, 22],
    helmet: rng.chance(0.12),
    dead: false,
    deadT: 0,
  };
}

export function spawnPeds(G) {
  G.peds = [];
  for (let i = 0; i < COUNT; i += 1) {
    const spot = sidewalkPoint(G, G.rng);
    G.peds.push(makePed(G, spot.x, spot.z, false));
  }
}

export function spawnFleer(G, x, z) {
  const ped = makePed(G, x, z, true);
  G.peds.push(ped);
  return ped;
}

export function updatePeds(G, dt) {
  const threat = G.threat;
  for (const ped of G.peds) {
    ped.punchT = Math.max(0, ped.punchT - dt);
    if (ped.state === 'down') {
      ped.downT -= dt;
      ped.moving = false;
      if (ped.downT <= 0) {
        ped.state = 'flee';
        ped.fleeT = 4;
      }
      continue;
    }
    if (threat && threat.t > 0 && dist2(ped.x, ped.z, threat.x, threat.z) < 45) {
      ped.state = 'flee';
      ped.fleeT = 4;
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const away = Math.atan2(ped.x - (threat ? threat.x : G.player.x), ped.z - (threat ? threat.z : G.player.z));
      ped.heading = angLerp(ped.heading, away, 1 - Math.exp(-6 * dt));
      ped.x += Math.sin(ped.heading) * 6 * dt;
      ped.z += Math.cos(ped.heading) * 6 * dt;
      ped.phase += 6 * dt * 1.7;
      ped.moving = true;
      if (ped.fleeT <= 0) ped.state = 'walk';
    } else if (ped.state === 'idle') {
      ped.idleT -= dt;
      ped.moving = false;
      if (ped.idleT <= 0) {
        ped.target = sidewalkPoint(G, G.rng);
        ped.state = 'walk';
      }
    } else {
      if (!ped.target) ped.target = sidewalkPoint(G, G.rng);
      const d = dist2(ped.x, ped.z, ped.target.x, ped.target.z);
      if (d < 2) {
        ped.state = 'idle';
        ped.idleT = G.rng.range(1, 4);
        ped.moving = false;
      } else {
        const want = Math.atan2(ped.target.x - ped.x, ped.target.z - ped.z);
        ped.heading = angLerp(ped.heading, want, 1 - Math.exp(-5 * dt));
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
        ped.phase += ped.speed * dt * 1.7;
        ped.moving = true;
      }
    }
    collideCircle(G.city, ped, 0.5);
    // Cars: a fast one knocks the pedestrian down, a slow one makes them dodge.
    for (const v of G.vehicles) {
      const d = dist2(ped.x, ped.z, v.x, v.z);
      if (d > 3) continue;
      const speed = Math.abs(v.speed || 0);
      if (speed > 7 && d < 2.4 && ped.state !== 'down') {
        ped.state = 'down';
        ped.downT = 5;
        ped.moving = false;
        spawnDust(G, ped.x, ped.z, 6);
        addShake(G, 0.4);
        G.audio.hit();
        if (v.driver === 'player') {
          addWanted(G, 1, 'hit a pedestrian');
          say(G, 'You hit a pedestrian.', '#ff8a7a');
        }
        break;
      }
      if (speed > 1 && d < 3 && ped.state === 'walk') {
        ped.state = 'flee';
        ped.fleeT = 2.5;
      }
    }
    // Far pedestrians respawn nearer the action to keep the streets alive.
    if (dist2(ped.x, ped.z, G.player.x, G.player.z) > 210) {
      const spot = sidewalkPoint(G, G.rng);
      const near = dist2(spot.x, spot.z, G.player.x, G.player.z);
      if (near < 160) {
        ped.x = spot.x;
        ped.z = spot.z;
        ped.target = null;
        ped.state = 'walk';
      }
    }
  }
}
