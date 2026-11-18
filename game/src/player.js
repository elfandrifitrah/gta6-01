// Bimo on foot and behind the wheel: camera-relative walking, arcade driving with grip
// and drift, entering and exiting vehicles, health and regeneration.

import { CAR, PLAYER } from './config.js';
import { collideCircle, onRoad } from './city.js';
import { angLerp, clamp, damp, dist2 } from './vec.js';
import { addShake, spawnDust, spawnSparks, spawnSmoke } from './effects.js';
import { say } from './hud.js';
import { addWanted } from './wanted.js';

export function createPlayer(place) {
  return {
    x: place.x, z: place.z, heading: Math.PI, speed: 0,
    phase: 0, moving: false, health: PLAYER.health, maxHealth: PLAYER.health,
    driving: null, punchT: 0, shootT: 0, regenT: 0, invulnT: 0,
    dead: false, deadT: 0,
    shirt: [28, 148, 158], pants: [42, 46, 60], skin: [196, 150, 110], hair: [30, 24, 20],
  };
}

export function updatePlayer(G, dt, input, actions) {
  const p = G.player;
  p.punchT = Math.max(0, p.punchT - dt);
  p.shootT = Math.max(0, p.shootT - dt);
  p.invulnT = Math.max(0, p.invulnT - dt);
  if (p.dead) { p.deadT += dt; return; }
  if (p.driving) updateDriving(G, dt, input, actions);
  else updateOnFoot(G, dt, input, actions);
  p.regenT += dt;
  if (p.regenT > PLAYER.regenDelay && p.health < p.maxHealth) {
    p.health = Math.min(p.maxHealth, p.health + PLAYER.regen * dt);
  }
}

function updateOnFoot(G, dt, input, actions) {
  const p = G.player;
  const axis = input.axis();
  const cam = G.camera;
  const fx = Math.sin(cam.yaw);
  const fz = Math.cos(cam.yaw);
  const rx = Math.cos(cam.yaw);
  const rz = -Math.sin(cam.yaw);
  let mx = fx * axis.y + rx * axis.x;
  let mz = fz * axis.y + rz * axis.x;
  const len = Math.hypot(mx, mz);
  p.moving = len > 0.1;
  if (p.moving) {
    mx /= len;
    mz /= len;
    const speed = input.run() ? PLAYER.run : PLAYER.walk;
    const targetHeading = Math.atan2(mx, mz);
    p.heading = angLerp(p.heading, targetHeading, 1 - Math.exp(-12 * dt));
    p.x += mx * speed * dt;
    p.z += mz * speed * dt;
    p.phase += speed * dt * 1.7;
    p.speed = speed;
    if (input.run() && Math.random() < dt * 6) spawnDust(G, p.x, p.z, 1);
  } else {
    p.speed = 0;
  }
  collideCircle(G.city, p, PLAYER.radius);
  if (actions & 4) tryEnterVehicle(G);
}

function updateDriving(G, dt, input, actions) {
  const p = G.player;
  const v = p.driving;
  const axis = input.axis();
  const onroad = onRoad(G.city, v.x, v.z);
  const top = v.top || CAR.top;
  if (axis.y > 0) v.speed += CAR.accel * dt * (onroad ? 1 : 0.7);
  else if (axis.y < 0) {
    if (v.speed > 0.5) v.speed -= CAR.brake * dt;
    else v.speed = Math.max(v.speed - CAR.accel * 0.6 * dt, -CAR.reverseMax);
  } else {
    v.speed = damp(v.speed, 0, onroad ? 0.5 : 1.4, dt);
  }
  if (input.brake()) {
    v.speed = damp(v.speed, 0, 3.2, dt);
    if (Math.abs(v.speed) > 9 && Math.random() < dt * 8) {
      spawnSmoke(G, v.x, 0.3, v.z, 1);
      G.audio.skid();
    }
  }
  v.speed = clamp(v.speed, -CAR.reverseMax, top);
  const speedFactor = clamp(Math.abs(v.speed) / 9, 0, 1) * (1 - (Math.abs(v.speed) / top) * 0.55);
  v.heading += axis.x * CAR.steer * speedFactor * dt * (v.speed >= 0 ? 1 : -1);
  const dirX = Math.sin(v.heading);
  const dirZ = Math.cos(v.heading);
  const grip = input.brake() ? 1.6 : CAR.grip;
  let vx = v.vx || 0;
  let vz = v.vz || 0;
  const forward = vx * dirX + vz * dirZ;
  const latX = vx - dirX * forward;
  const latZ = vz - dirZ * forward;
  const keep = Math.exp(-grip * dt);
  vx = dirX * v.speed + latX * keep;
  vz = dirZ * v.speed + latZ * keep;
  v.vx = vx;
  v.vz = vz;
  const before = { x: v.x, z: v.z };
  v.x += vx * dt;
  v.z += vz * dt;
  const hitWall = collideCircle(G.city, v, CAR.radius);
  if (hitWall) {
    const impact = Math.abs(v.speed);
    if (impact > 7) {
      spawnSparks(G, v.x, 0.8, v.z, 10);
      addShake(G, clamp(impact * 0.03, 0.15, 0.7));
      G.audio.crash();
      if (impact > 20) damagePlayer(G, Math.round((impact - 20) * 0.8), 'crash');
    }
    v.speed *= 0.35;
    v.vx *= 0.3;
    v.vz *= 0.3;
  }
  v.braking = axis.y < 0 || input.brake();
  p.x = v.x;
  p.z = v.z;
  p.heading = v.heading;
  p.moving = Math.abs(v.speed) > 1;
  p.phase += Math.abs(v.speed) * dt * 0.4;
  if (Math.abs(v.speed) > 4 && Math.random() < dt * 5) {
    spawnSmoke(G, v.x - dirX * 2.2, 0.4, v.z - dirZ * 2.2, 1);
  }
  if (actions & 4) exitVehicle(G);
  void before;
}

function tryEnterVehicle(G) {
  const p = G.player;
  let best = null;
  let bd = 5;
  for (const v of G.vehicles) {
    if (v.kind === 'police') continue;
    const d = dist2(p.x, p.z, v.x, v.z);
    if (d < bd) { bd = d; best = v; }
  }
  if (!best) return;
  if (best.driver === 'traffic') {
    best.driver = 'player';
    const policeNear = G.vehicles.some((v) => v.kind === 'police' && dist2(p.x, p.z, v.x, v.z) < 55);
    if (policeNear || G.wanted.level > 0) addWanted(G, 1, 'stole a car');
    say(G, 'You took the car.', '#ffd257');
    G.audio.horn();
  } else if (best.driver === 'parked') {
    best.driver = 'player';
  } else if (best.driver === 'mission') {
    best.driver = 'player';
    say(G, 'You took the marked car.', '#ffd257');
  }
  best.speed = 0;
  best.vx = 0;
  best.vz = 0;
  p.driving = best;
  G.audio.click();
}

function exitVehicle(G) {
  const p = G.player;
  const v = p.driving;
  if (!v) return;
  const side = 2.8;
  p.x = v.x + Math.cos(v.heading) * side;
  p.z = v.z - Math.sin(v.heading) * side;
  collideCircle(G.city, p, PLAYER.radius);
  v.driver = 'parked';
  v.speed = 0;
  v.vx = 0;
  v.vz = 0;
  p.driving = null;
  G.audio.click();
}

export function damagePlayer(G, amount, source) {
  const p = G.player;
  if (p.dead || p.invulnT > 0 || G.shotMode) return;
  p.health -= amount;
  p.regenT = 0;
  p.invulnT = 0.25;
  G.damageFlash = 0.7;
  addShake(G, 0.35);
  G.audio.hit();
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    p.deadT = 0;
    if (p.driving) {
      p.driving.driver = 'parked';
      p.driving.speed = 0;
      p.driving = null;
    }
  }
  void source;
}

export function respawnPlayer(G, place) {
  const p = G.player;
  p.x = place.x;
  p.z = place.z;
  p.health = p.maxHealth;
  p.dead = false;
  p.deadT = 0;
  p.invulnT = 2;
  p.driving = null;
  G.damageFlash = 0;
}
