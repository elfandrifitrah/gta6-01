// Boot, the fixed-step loop, screens, the follow camera and the debug hook. The world
// simulates in 1/60 s steps; the renderer paints every animation frame. Shot mode stages
// a scene, runs it, and raises window.__shotReady for the screenshot.

import { CASH, STEP } from './config.js';
import { createRng } from './rng.js';
import { generateCity } from './city.js';
import { createRenderer } from './render.js';
import { ACT, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, respawnPlayer, updatePlayer } from './player.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds } from './peds.js';
import { playerPunch, playerShoot, updateEnemies } from './combat.js';
import { clearWanted, createWanted, updateWanted } from './wanted.js';
import { clearSave, failMission, loadGame, saveGame, startMission, updateMissions } from './missions.js';
import { createHud, say } from './hud.js';
import { updateEffects } from './effects.js';
import { shotTick, stageShot } from './shots.js';
import { angLerp, clamp, damp } from './vec.js';

const MAX_FRAME = 0.25;
const DEFAULT_SEED = 20260717;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const city = generateCity(seed);

const G = {
  time: 0,
  seed,
  rng: createRng((seed ^ 0x5f3a29c1) >>> 0),
  city,
  camera: { x: 0, y: 8, z: 0, yaw: Math.PI, pitch: 0.42, fov: 1.08, w: 1280, h: 720 },
  player: null,
  vehicles: [],
  peds: [],
  enemies: [],
  particles: [],
  floaters: [],
  flashes: [],
  items: [],
  messages: [],
  banner: null,
  marker: null,
  raceGates: [],
  racePlayerGate: 0,
  mission: null,
  retryMission: null,
  wanted: createWanted(),
  cash: CASH.start,
  storyDone: false,
  storyPending: false,
  pendingBust: false,
  bustWarned: false,
  threat: null,
  shake: 0,
  damageFlash: 0,
  objective: { title: '', text: '', dist: 0 },
  screen: 'title',
  screenT: 0,
  shotMode: !!shotName,
  shotScene: null,
  shotVista: false,
  scriptAxis: null,
  camYawOff: 0,
  camPitchOff: 0,
  camZoom: 0,
  save: null,
  audio: null,
};
G.player = createPlayer(city.places.playerStart);
G.audio = createAudio();
G.save = G.shotMode ? null : loadGame();

const renderer = createRenderer(canvas);
const hud = createHud();
const input = createInput(canvas);

const scriptInput = {
  axis: () => G.scriptAxis || input.axis(),
  run: () => input.run(),
  brake: () => input.brake(),
  takeActions: () => input.takeActions(),
  takeLook: () => input.takeLook(),
  takeWheel: () => input.takeWheel(),
  shootEdge: () => input.shootEdge(),
  shootHeld: () => input.shootHeld(),
  confirmHeld: () => input.confirmHeld(),
};

function showOverlay(id) {
  for (const name of ['title-screen', 'pause-screen', 'story-screen', 'busted-screen', 'wasted-screen']) {
    document.getElementById(name).classList.toggle('hidden', name !== id);
  }
  document.getElementById('hud').classList.toggle('hidden', id === 'title-screen' || id === 'story-screen');
}

function setScreen(name) {
  G.screen = name;
  G.screenT = 0;
  if (name === 'title') showOverlay('title-screen');
  else if (name === 'paused') showOverlay('pause-screen');
  else if (name === 'story') showOverlay('story-screen');
  else if (name === 'busted') showOverlay('busted-screen');
  else if (name === 'wasted') showOverlay('wasted-screen');
  else showOverlay(null);
  const labels = {
    title: 'Jakarta Heat. Press Enter or click Start to play.',
    play: 'Playing.',
    paused: 'Paused.',
    story: 'Debt paid. Bimo is free.',
    busted: 'Busted by the police.',
    wasted: 'Wasted.',
  };
  statusEl.textContent = labels[name] || '';
}

function startFresh() {
  clearSave();
  G.cash = CASH.start;
  G.storyDone = false;
  G.storyPending = false;
  clearWanted(G);
  respawnPlayer(G, city.places.playerStart);
  G.player.heading = Math.PI;
  startMission(G, 0);
  setScreen('play');
  say(G, 'Bimo owes Bu Ratna $5,000. Four jobs will clear it.', '#ffd257');
}

function startContinue() {
  const save = G.save;
  if (!save) { startFresh(); return; }
  G.cash = save.cash;
  G.storyDone = !!save.storyDone;
  clearWanted(G);
  respawnPlayer(G, { x: save.x, z: save.z });
  if (G.storyDone) {
    G.mission = null;
    setScreen('play');
  } else {
    startMission(G, Math.min(save.mission, 3));
    setScreen('play');
  }
  say(G, 'Welcome back, Bimo.', '#ffd257');
}

function resolveBustOrWasted(kind) {
  const fee = 100;
  G.cash = Math.max(0, G.cash - fee);
  clearWanted(G);
  const p = G.player;
  if (p.driving) {
    p.driving.driver = 'parked';
    p.driving.speed = 0;
    p.driving = null;
  }
  respawnPlayer(G, kind === 'busted' ? city.places.policePost : city.places.hospital);
  failMission(G, kind === 'busted' ? 'Bimo was busted. The job restarts.' : 'Bimo was wasted. The job restarts.');
  say(G, `-$${fee}. The city keeps its cut.`, '#ff8a7a');
  setScreen('play');
}

function updateCamera(G, dt) {
  const cam = G.camera;
  const p = G.player;
  if (G.shotVista || G.screen === 'title' || G.screen === 'story') {
    const angle = G.time * 0.045;
    cam.x = Math.sin(angle) * 78;
    cam.z = -150 + Math.cos(angle) * 78;
    cam.y = 40;
    cam.yaw = Math.atan2(0 - cam.x, -150 - cam.z);
    cam.pitch = 0.36;
    return;
  }
  const look = input.takeLook();
  G.camYawOff += look.x * 0.0042;
  G.camPitchOff = clamp(G.camPitchOff + look.y * 0.0028, -0.22, 0.5);
  G.camYawOff = damp(G.camYawOff, 0, 0.5, dt);
  G.camZoom = clamp(G.camZoom + input.takeWheel() * 0.008, -5, 9);
  const targetYaw = p.heading + G.camYawOff;
  cam.yaw = angLerp(cam.yaw, targetYaw, 1 - Math.exp(-(p.driving ? 3.4 : 2.2) * dt));
  cam.pitch = 0.42 + G.camPitchOff - (p.driving ? 0.05 : 0);
  const dist = clamp((p.driving ? 19 : 13) + G.camZoom, 8, 32);
  const cx = p.x - Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist;
  const cz = p.z - Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist;
  const cy = 2.4 + Math.sin(cam.pitch) * dist;
  cam.x = damp(cam.x, cx, 9, dt);
  cam.y = Math.max(1.4, damp(cam.y, cy, 9, dt));
  cam.z = damp(cam.z, cz, 9, dt);
}

function ambientStep(dt) {
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updateEffects(G, dt);
}

function playStep(dt, actions, shoot) {
  if (G.shotMode) shotTick(G);
  const activeInput = G.scriptAxis ? scriptInput : input;
  updatePlayer(G, dt, activeInput, actions);
  if (actions & ACT.PUNCH) playerPunch(G);
  if (shoot) playerShoot(G);
  if (actions & ACT.HORN) G.audio.horn();
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updateEnemies(G, dt);
  updateWanted(G, dt);
  updateMissions(G, dt);
  updateEffects(G, dt);
  if (G.threat) {
    G.threat.t -= dt;
    if (G.threat.t <= 0) G.threat = null;
  }
  if (G.player.dead && G.player.deadT > 1.6 && G.screen === 'play') setScreen('wasted');
  if (G.pendingBust && G.screen === 'play') {
    G.pendingBust = false;
    setScreen('busted');
  }
  if (G.storyPending && G.screen === 'play') {
    G.storyPending = false;
    document.getElementById('story-stats').textContent = `Cash $${G.cash.toLocaleString('en-US')} · all four jobs done · debt paid in full.`;
    setScreen('story');
  }
}

spawnTraffic(G);
spawnPeds(G);
G.camera.x = G.player.x - Math.sin(G.camera.yaw) * 13;
G.camera.z = G.player.z - Math.cos(G.camera.yaw) * 13;

if (G.shotMode) {
  stageShot(G, shotName);
  setScreen(shotName === 'start' ? 'title' : 'play');
} else {
  setScreen('title');
  if (G.save) {
    document.getElementById('btn-continue').classList.remove('hidden');
    const titles = ['Macet Total', 'Kopor Hilang', 'Balap Liar', 'Jebakan di Pelabuhan'];
    document.getElementById('save-info').textContent = G.save.storyDone
      ? `Saved game: $${G.save.cash.toLocaleString('en-US')} · debt paid`
      : `Saved game: $${G.save.cash.toLocaleString('en-US')} · ${titles[Math.min(G.save.mission, 3)]}`;
  }
}

function wireButton(id, fn) {
  const button = document.getElementById(id);
  if (!button) return;
  button.addEventListener('click', () => {
    G.audio.unlock();
    G.audio.click();
    fn();
  });
}
wireButton('btn-start', startFresh);
wireButton('btn-continue', startContinue);
wireButton('btn-resume', () => setScreen('play'));
wireButton('btn-restart', () => {
  clearWanted(G);
  if (G.mission) startMission(G, G.mission.index);
  setScreen('play');
});
wireButton('btn-save', () => { saveGame(G); say(G, 'Game saved.', '#9fe08a'); });
wireButton('btn-quit', () => setScreen('title'));
wireButton('btn-freeroam', () => setScreen('play'));

window.addEventListener('pointerdown', () => G.audio.unlock(), { once: false });
window.addEventListener('keydown', () => G.audio.unlock(), { once: false });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.screen === 'play' && !G.shotMode) setScreen('paused');
});

let last = performance.now();
let accumulator = 0;
let shotFrames = 0;
let readyRaised = false;

function frame(now) {
  requestAnimationFrame(frame);
  const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  G.time += frameDt;
  const actions = input.takeActions();
  const shoot = input.shootEdge();
  if (actions & ACT.PAUSE) {
    if (G.screen === 'play') setScreen('paused');
    else if (G.screen === 'paused') setScreen('play');
  }
  if (actions & ACT.CONFIRM) {
    if (G.screen === 'title') startFresh();
    else if (G.screen === 'paused') setScreen('play');
    else if (G.screen === 'story') setScreen('play');
  }
  if (G.screen === 'play') {
    accumulator += frameDt;
    let stepActions = actions & (ACT.INTERACT | ACT.PUNCH | ACT.HORN);
    let stepShoot = shoot;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      playStep(STEP, stepActions, stepShoot);
      stepActions = 0;
      stepShoot = false;
      accumulator -= STEP;
      steps += 1;
      if (G.screen !== 'play') { accumulator = 0; break; }
    }
  } else if (G.screen === 'title' || G.screen === 'story') {
    accumulator += frameDt;
    while (accumulator >= STEP) {
      ambientStep(STEP);
      accumulator -= STEP;
    }
  } else if (G.screen === 'busted' || G.screen === 'wasted') {
    G.screenT += frameDt;
    if (G.screenT > 2.2) resolveBustOrWasted(G.screen);
  } else {
    accumulator = 0;
  }
  updateCamera(G, frameDt);
  G.audio.update(G, frameDt);
  renderer.draw(G);
  if (G.screen === 'play' || G.screen === 'paused') hud.update(G, frameDt);
  if (G.shotMode && !readyRaised) {
    shotFrames += 1;
    if (shotFrames >= 110) {
      readyRaised = true;
      window.__shotReady = true;
    }
  }
  if (!readyRaised && !G.shotMode) {
    window.__jhReady = true;
    readyRaised = true;
  }
}

window.JH = {
  G,
  state() {
    const p = G.player;
    return {
      cash: G.cash,
      mission: G.mission ? G.mission.index : -1,
      stage: G.mission ? G.mission.stage : -1,
      stageText: G.objective.text,
      wanted: G.wanted.level,
      health: Math.round(p.health),
      x: Math.round(p.x * 10) / 10,
      z: Math.round(p.z * 10) / 10,
      driving: !!p.driving,
      vehicles: G.vehicles.length,
      peds: G.peds.length,
      enemiesAlive: G.enemies.filter((e) => !e.dead).length,
      screen: G.screen,
      storyDone: G.storyDone,
      marker: G.marker ? { x: Math.round(G.marker.x), z: Math.round(G.marker.z) } : null,
    };
  },
  teleport(x, z) {
    const p = G.player;
    if (p.driving) {
      p.driving.x = x;
      p.driving.z = z;
      p.driving.speed = 0;
      p.driving.vx = 0;
      p.driving.vz = 0;
    }
    p.x = x;
    p.z = z;
  },
  aimAt(x, z) {
    G.camera.yaw = Math.atan2(x - G.player.x, z - G.player.z);
    G.player.heading = G.camera.yaw;
  },
  enemies() {
    return G.enemies.map((e) => ({ x: Math.round(e.x * 10) / 10, z: Math.round(e.z * 10) / 10, hp: e.hp, dead: e.dead }));
  },
  startMission(index) { startMission(G, index); },
  setWanted(level) { G.wanted.level = level; },
  heal() { G.player.health = G.player.maxHealth; },
  enterNearest() {
    const p = G.player;
    let best = null;
    let bd = 6;
    for (const v of G.vehicles) {
      if (v.kind === 'police') continue;
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      if (d < bd) { bd = d; best = v; }
    }
    if (best) {
      best.driver = 'player';
      best.speed = 0;
      p.driving = best;
      return true;
    }
    return false;
  },
};

requestAnimationFrame(frame);
