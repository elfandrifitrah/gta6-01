// Traffic, police pursuit, racers and every car-to-car collision. Traffic follows the
// road graph on the left, stops for what is ahead, and flees its car when hit hard.

import { CAR_COLORS } from './config.js';
import { collideCircle, nearestNode, randomRoadPoint } from './city.js';
import { angLerp, clamp, damp, dist2, wrapAngle } from './vec.js';
import { addShake, spawnSmoke, spawnSparks } from './effects.js';
import { say } from './hud.js';
import { spawnFleer } from './peds.js';

let nextId = 1;

const KINDS = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sedan', 'truck', 'sedan', 'van', 'taxi'];

export function makeVehicle(G, kind, x, z, heading, driver) {
  const rng = G.rng;
  const color = kind === 'taxi' ? [232, 178, 44] : kind === 'police' ? [238, 238, 240] : kind === 'race' ? rng.pick([[200, 40, 40], [40, 90, 200]]) : rng.pick(CAR_COLORS);
  return {
    id: nextId,
    kind, x, z, heading,
    speed: 0, vx: 0, vz: 0,
    color, driver,
    top: kind === 'police' ? 38 : kind === 'race' ? 30 : kind === 'bike' ? 15 : 13,
    targetSpeed: kind === 'bike' ? rng.range(11, 14) : rng.range(8, 12),
    braking: false, honkT: 0, stuckT: 0, abandoned: false, gate: 0, finished: false,
    node: null, next: null, prev: null,
  };
}

function routeFrom(G, v) {
  v.node = nearestNode(G.city, v.x, v.z);
  const links = v.node.links;
  v.next = links.length ? links[Math.floor(G.rng.next() * links.length)] : v.node;
  v.prev = v.node;
}

export function spawnTraffic(G) {
  G.vehicles = G.vehicles || [];
  for (let i = 0; i < 20; i += 1) {
    const spot = randomRoadPoint(G.rng, G.city);
    if (dist2(spot.x, spot.z, G.player.x, G.player.z) < 40) continue;
    const v = makeVehicle(G, KINDS[i % KINDS.length], spot.x, spot.z, 0, 'traffic');
    routeFrom(G, v);
    v.heading = Math.atan2(v.next.x - v.x, v.next.z - v.z);
    G.vehicles.push(v);
  }
  for (let i = 0; i < 8; i += 1) {
    const spot = randomRoadPoint(G.rng, G.city);
    if (dist2(spot.x, spot.z, G.player.x, G.player.z) < 40) continue;
    const v = makeVehicle(G, 'bike', spot.x, spot.z, 0, 'traffic');
    routeFrom(G, v);
    v.heading = Math.atan2(v.next.x - v.x, v.next.z - v.z);
    G.vehicles.push(v);
  }
}

export function spawnPoliceCar(G) {
  const p = G.player;
  for (let tries = 0; tries < 12; tries += 1) {
    const spot = randomRoadPoint(G.rng, G.city);
    const d = dist2(spot.x, spot.z, p.x, p.z);
    if (d > 65 && d < 110) {
      const v = makeVehicle(G, 'police', spot.x, spot.z, Math.atan2(p.x - spot.x, p.z - spot.z), 'police');
      G.vehicles.push(v);
      return v;
    }
  }
  return null;
}

function radiusOf(v) { return v.kind === 'bike' ? 1.3 : 2.3; }

function blockedAhead(G, v, range) {
  const fx = Math.sin(v.heading);
  const fz = Math.cos(v.heading);
  for (const o of G.vehicles) {
    if (o === v) continue;
    const dx = o.x - v.x;
    const dz = o.z - v.z;
    const d = Math.hypot(dx, dz);
    if (d > range || d < 0.01) continue;
    if ((dx * fx + dz * fz) / d > 0.82) return true;
  }
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - v.x;
    const dz = ped.z - v.z;
    const d = Math.hypot(dx, dz);
    if (d > range * 0.7 || d < 0.01) continue;
    if ((dx * fx + dz * fz) / d > 0.9) return true;
  }
  return false;
}

function updateTrafficCar(G, v, dt) {
  if (!v.next) routeFrom(G, v);
  const dx = v.next.x - v.x;
  const dz = v.next.z - v.z;
  const d = Math.hypot(dx, dz);
  if (d < 7) {
    v.prev = v.node;
    v.node = v.next;
    const options = v.node.links.filter((n) => n !== v.prev);
    v.next = options.length && G.rng.chance(0.85) ? options[Math.floor(G.rng.next() * options.length)] : v.node.links[Math.floor(G.rng.next() * v.node.links.length)];
  }
  const want = Math.atan2(dx, dz);
  v.heading = angLerp(v.heading, want, 1 - Math.exp(-3.2 * dt));
  const blocked = blockedAhead(G, v, 11);
  v.braking = blocked;
  const target = blocked ? 0 : v.targetSpeed;
  v.speed = damp(v.speed, target, blocked ? 6 : 1.6, dt);
  if (blocked) {
    v.honkT += dt;
    if (v.honkT > 2.5) { v.honkT = 0; G.audio.horn(); }
  } else v.honkT = 0;
  v.x += Math.sin(v.heading) * v.speed * dt;
  v.z += Math.cos(v.heading) * v.speed * dt;
  v.vx = Math.sin(v.heading) * v.speed;
  v.vz = Math.cos(v.heading) * v.speed;
  collideCircle(G.city, v, radiusOf(v));
  if (dist2(v.x, v.z, G.player.x, G.player.z) > 220) {
    const spot = randomRoadPoint(G.rng, G.city);
    if (dist2(spot.x, spot.z, G.player.x, G.player.z) > 110) {
      v.x = spot.x;
      v.z = spot.z;
      routeFrom(G, v);
      v.heading = Math.atan2(v.next.x - v.x, v.next.z - v.z);
    }
  }
}

function updatePolice(G, v, dt) {
  const p = G.player;
  const d = dist2(v.x, v.z, p.x, p.z);
  const want = Math.atan2(p.x - v.x, p.z - v.z);
  v.heading = angLerp(v.heading, want, 1 - Math.exp(-2.6 * dt));
  const onFoot = !p.driving;
  const closing = d > 6 ? v.top : onFoot ? 3 : 6;
  v.speed = damp(v.speed, closing, 2.2, dt);
  v.x += Math.sin(v.heading) * v.speed * dt;
  v.z += Math.cos(v.heading) * v.speed * dt;
  v.vx = Math.sin(v.heading) * v.speed;
  v.vz = Math.cos(v.heading) * v.speed;
  const hit = collideCircle(G.city, v, radiusOf(v));
  if ((hit && v.speed > 4) || v.speed < 1) v.stuckT += dt;
  else v.stuckT = 0;
  if (v.stuckT > 2.5) {
    v.heading += (G.rng.chance(0.5) ? 1 : -1) * 1.2;
    v.stuckT = 0;
  }
  v.braking = d < 8;
}

function updateRacer(G, v, dt) {
  const gates = G.raceGates || [];
  if (v.finished || v.gate >= gates.length) {
    v.speed = damp(v.speed, 0, 1.5, dt);
    v.x += Math.sin(v.heading) * v.speed * dt;
    v.z += Math.cos(v.heading) * v.speed * dt;
    return;
  }
  const gate = gates[v.gate];
  const d = dist2(v.x, v.z, gate.x, gate.z);
  if (d < 9) {
    v.gate += 1;
    if (v.gate >= gates.length) { v.finished = true; say(G, 'A rival finished the race.', '#ffb08a'); }
    return;
  }
  const want = Math.atan2(gate.x - v.x, gate.z - v.z);
  const turn = clamp(wrapAngle(want - v.heading), -1, 1);
  v.heading += turn * 2.2 * dt;
  const playerGate = G.racePlayerGate || 0;
  let target = 27;
  if (v.gate > playerGate + 1) target = 22;
  if (v.gate < playerGate) target = 30;
  v.speed = damp(v.speed, target, 1.4, dt);
  v.x += Math.sin(v.heading) * v.speed * dt;
  v.z += Math.cos(v.heading) * v.speed * dt;
  v.vx = Math.sin(v.heading) * v.speed;
  v.vz = Math.cos(v.heading) * v.speed;
  collideCircle(G.city, v, radiusOf(v));
}

function collideVehicles(G, dt) {
  const list = G.vehicles;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = radiusOf(a) + radiusOf(b) - 0.6;
      if (d >= min || d < 0.01) continue;
      const nx = dx / d;
      const nz = dz / d;
      const push = (min - d) / 2;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
      const rel = Math.abs((a.vx - b.vx) * nx + (a.vz - b.vz) * nz);
      if (rel > 5) {
        const mx = (a.x + b.x) / 2;
        const mz = (a.z + b.z) / 2;
        spawnSparks(G, mx, 0.9, mz, 8);
        if (rel > 10) {
          G.audio.crash();
          if (a.driver === 'player' || b.driver === 'player') addShake(G, clamp(rel * 0.02, 0.15, 0.6));
        }
        const victim = a.driver === 'traffic' ? a : b.driver === 'traffic' ? b : null;
        const hitter = victim === a ? b : a;
        if (victim && hitter.driver === 'player' && rel > 9 && !victim.abandoned) {
          victim.driver = 'parked';
          victim.abandoned = true;
          victim.speed = 0;
          spawnSmoke(G, victim.x, 1, victim.z, 6);
          spawnFleer(G, victim.x + 2, victim.z + 2);
        }
      }
      const swap = ((a.vx - b.vx) * nx + (a.vz - b.vz) * nz) * 0.5;
      a.vx -= nx * swap;
      a.vz -= nz * swap;
      b.vx += nx * swap;
      b.vz += nz * swap;
      a.speed *= 0.7;
      b.speed *= 0.7;
    }
  }
  void dt;
}

export function updateTraffic(G, dt) {
  for (const v of G.vehicles) {
    if (v.driver === 'traffic') updateTrafficCar(G, v, dt);
    else if (v.driver === 'police') updatePolice(G, v, dt);
    else if (v.driver === 'racer') updateRacer(G, v, dt);
    else if (v.driver === 'parked' && v.abandoned && dist2(v.x, v.z, G.player.x, G.player.z) > 170) v.removeMe = true;
  }
  collideVehicles(G, dt);
  for (let i = G.vehicles.length - 1; i >= 0; i -= 1) {
    const v = G.vehicles[i];
    if (v.removeMe) G.vehicles.splice(i, 1);
    else if (v.driver === 'police' && G.wanted.level === 0 && dist2(v.x, v.z, G.player.x, G.player.z) > 130) G.vehicles.splice(i, 1);
  }
}
