// The screenshot scenes behind ?shot=start|play|end|vista. Each one stages the real game
// (a mission, a chase, a payout banner, a high orbit) and lets the simulation run, so the
// frame is what playing really looks like and the same seed always gives the same frame.

import { dist2, wrapAngle, clamp } from './vec.js';
import { startMission } from './missions.js';
import { makeVehicle, spawnPoliceCar } from './traffic.js';
import { showBanner } from './hud.js';
import { clearWanted } from './wanted.js';

export function stageShot(G, name) {
  G.shotMode = true;
  const P = G.city.places;
  if (name === 'play') {
    G.cash = 1050;
    startMission(G, 0);
    const car = G.vehicles.find((v) => v.driver === 'mission');
    car.x = 0;
    car.z = -20;
    car.heading = Math.PI;
    car.driver = 'player';
    const p = G.player;
    p.driving = car;
    p.x = car.x;
    p.z = car.z;
    p.heading = Math.PI;
    // Clear parked cars from the avenue corridor so the scripted drive never
    // rear-ends a parked sedan and stalls mid-shot.
    for (let i = G.vehicles.length - 1; i >= 0; i -= 1) {
      const v = G.vehicles[i];
      if (v.driver === 'parked' && Math.abs(v.x) < 14 && v.z > -175 && v.z < 30) G.vehicles.splice(i, 1);
    }
    G.wanted.level = 3;
    // A parked cruiser on the shoulder ahead: it stays in frame with its lights on
    // instead of chasing into the camera and covering the player's car.
    const roadside = makeVehicle(G, 'police', 9, -85, Math.PI, 'parked');
    G.vehicles.push(roadside);
    const headOn = spawnPoliceCar(G);
    if (headOn) {
      headOn.x = -3;
      headOn.z = -160;
      headOn.heading = 0;
    }
    for (const [tx, tz] of [[4, -70], [-4, -100], [4, -130], [-4, -160]]) {
      const t = makeVehicle(G, 'sedan', tx, tz, Math.PI, 'traffic');
      G.vehicles.push(t);
    }
    G.shotScene = 'play';
    return;
  }
  if (name === 'end') {
    G.cash = 5250;
    startMission(G, 3);
    // The story is over: the objective panel reads "Debt paid" instead of showing
    // the final mission's first stage under the completion banner.
    G.storyDone = true;
    G.mission.active = false;
    G.messages.length = 0;
    const p = G.player;
    p.x = 206;
    p.z = 108;
    p.heading = -Math.PI / 2;
    G.wanted.level = 3;
    for (const [ox, oz] of [[178, 98], [184, 122]]) {
      const cop = makeVehicle(G, 'police', ox, oz, Math.atan2(p.x - ox, p.z - oz), 'parked');
      G.vehicles.push(cop);
    }
    showBanner(G, 'MISSION COMPLETE', '+$1,500 · Jebakan di Pelabuhan');
    if (G.banner) G.banner.t = 60;
    G.shotScene = 'end';
    return;
  }
  if (name === 'vista') {
    G.shotVista = true;
    G.shotScene = 'vista';
    return;
  }
  G.shotVista = true;
  G.shotScene = 'start';
}

/** Per-frame staging behaviour: the play scene drives itself up the avenue. */
export function shotTick(G) {
  if (G.shotScene !== 'play') return;
  const v = G.player.driving;
  if (!v) return;
  // Traffic pulls aside for the chase: any civilian car stalled just ahead of the
  // player slides sideways instead of blocking the scripted drive forever.
  for (const o of G.vehicles) {
    if (o === v || o.kind === 'police') continue;
    const dz = o.z - v.z;
    if (dz < 0 && dz > -10 && Math.abs(o.x - v.x) < 4 && Math.abs(o.x) < 10) {
      o.x += (o.x >= v.x ? 1 : -1) * 0.35;
    }
  }
  const ahead = { x: 0, z: v.z - 60 };
  const want = Math.atan2(ahead.x - v.x, ahead.z - v.z);
  const steer = clamp(wrapAngle(want - v.heading) * 1.6, -1, 1);
  G.scriptAxis = { x: steer, y: 1 };
  if (v.z < -100) {
    // Loop back for a longer chase: jump the chase south and keep driving.
    v.z += 130;
    G.player.z = v.z;
    for (const cop of G.vehicles) {
      if (cop.kind === 'police') cop.z += 130;
    }
  }
  void dist2;
  void clearWanted;
}
