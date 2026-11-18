// The world: one state object, one fixed step, everything wired together.
// The state carries the city, the player, traffic, enemies, police, the
// mission, effects and audio; each system steps in turn and the camera and
// the banner follow. reset() rebuilds the same seeded city from scratch.

import { START_CASH, TICK, VIEW, WORLD } from './config.js';
import { buildCity, findFreeSpot } from './city.js';
import { createRng } from './rng.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { createPlayer, stepPlayer, damagePlayer } from './player.js';
import { createTraffic, stepTraffic, spawnFleeingPed, setJam } from './traffic.js';
import { createEnemies, stepEnemies } from './enemies.js';
import { createWanted, stepWanted, addHeat } from './wanted.js';
import { createMissions, stepMissions, setupMission, resetCurrentMission } from './missions.js';
import { stepPickups, fireShot } from './combat.js';
import { clamp, damp } from './vec.js';

export function createWorld(seed) {
  const audio = createAudio();
  const state = { audio };
  const world = { state, step, reset, takeEvents, showBanner };

  function showBanner(title, sub, dur = 2.8) {
    state.banner = { title, sub: sub || '', t: 0, dur };
  }
  state.showBanner = showBanner;

  function init() {
    const rng = createRng(seed);
    const city = buildCity(seed);
    const traffic = createTraffic(city, rng);
    const spawn = findFreeSpot(city, 1210, 950, 16);
    Object.assign(state, {
      seed, rng, city,
      time: 0,
      cash: START_CASH,
      cashShown: START_CASH,
      player: createPlayer(spawn.x, spawn.y),
      cars: traffic.cars,
      peds: traffic.peds,
      jamCars: traffic.jamCars,
      enemies: createEnemies(),
      wanted: createWanted(),
      mission: createMissions(),
      pickups: [],
      rivals: [],
      pendingHits: [],
      fx: createEffects(),
      camera: { x: spawn.x, y: spawn.y, zoom: 1, zoomTarget: 1 },
      objective: '',
      marker: null,
      banner: null,
      raceProgress: null,
      flags: { suitcase: false, ledger: false },
      stats: { missionsDone: 0 },
      events: [],
      threat: null,
      policeNear01: 0,
      jam: false,
      storyDone: false,
    });
    state.addHeat = (n) => addHeat(state, n);
    state.spawnFleeingPed = (x, y) => spawnFleeingPed(state, x, y);
    state.fireShot = (x, y, angle, owner) => fireShot(state, x, y, angle, owner);
    state.setJam = (on) => setJam(state, on);
    state.damagePlayer = (n, x, y) => damagePlayer(state, n, x, y);
    setupMission(state, 0);
  }

  function takeEvents() {
    const events = state.events;
    state.events = [];
    return events;
  }

  function stepCamera(dt) {
    const cam = state.camera;
    const player = state.player;
    const tx = player.x + player.vx * 0.22;
    const ty = player.y + player.vy * 0.22;
    cam.x = damp(cam.x, tx, 3.4, dt);
    cam.y = damp(cam.y, ty, 3.4, dt);
    cam.zoom = damp(cam.zoom, cam.zoomTarget, 3, dt);
    const halfW = VIEW.width / 2 / cam.zoom;
    const halfH = VIEW.height / 2 / cam.zoom;
    cam.x = clamp(cam.x, Math.min(halfW, WORLD.width / 2), Math.max(WORLD.width - halfW, WORLD.width / 2));
    cam.y = clamp(cam.y, Math.min(halfH, WORLD.height / 2), Math.max(WORLD.height - halfH, WORLD.height / 2));
  }

  function step(dt, input, actions, mode) {
    state.time += dt;
    if (state.banner) {
      state.banner.t += dt;
      if (state.banner.t > state.banner.dur) state.banner = null;
    }
    if (state.threat && state.time - state.threat.t > 3) state.threat = null;

    if (mode === 'backdrop') {
      // Title screen: the city lives, nobody plays.
      stepTraffic(state, dt);
      state.fx.update(dt);
      state.camera.x = damp(state.camera.x, 1000 + Math.sin(state.time * 0.08) * 120, 0.6, dt);
      state.camera.y = damp(state.camera.y, 700 + Math.cos(state.time * 0.06) * 60, 0.6, dt);
      return;
    }

    for (let i = state.pendingHits.length - 1; i >= 0; i -= 1) {
      const hit = state.pendingHits[i];
      if (state.time < hit.at) continue;
      state.pendingHits.splice(i, 1);
      const player = state.player;
      if (!player.car && player.health > 0 && !hit.from.dead) {
        const d = Math.hypot(player.x - hit.from.x, player.y - hit.from.y);
        if (d < hit.range) damagePlayer(state, hit.damage, hit.from.x, hit.from.y);
      }
    }

    if (input) stepPlayer(state, input, dt, actions || 0);
    stepTraffic(state, dt);
    stepEnemies(state, dt);
    stepWanted(state, dt, input ? input.axes().y > 0 : false);
    stepMissions(state, dt);
    stepPickups(state);
    state.fx.update(dt);
    stepCamera(dt);

    state.cashShown = damp(state.cashShown, state.cash, 6, dt);
    if (Math.abs(state.cashShown - state.cash) < 0.6) state.cashShown = state.cash;

    const player = state.player;
    state.audio.update({
      inCar: !!player.car,
      speed01: clamp(player.speed / 520, 0, 1),
      throttle: input ? input.axes().y > 0 : false,
      policeNear01: state.policeNear01,
    });
  }

  function reset() {
    init();
  }

  init();
  return world;
}

export { TICK };
