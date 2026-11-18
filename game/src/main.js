// Boot and the one loop: the screens (title, play, paused, busted, wasted,
// story complete), saving and continuing, the fixed-step simulation, and the
// screenshot mode behind ?shot=. A debug handle (?debug=1) exposes the live
// state and a teleport for automated checks; it stays off in normal play.

import { SAVE_KEY, TICK, WANTED } from './config.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import {
  ACTION_CONFIRM, ACTION_ENTER, ACTION_HONK, ACTION_MUTE, ACTION_NEWGAME,
  ACTION_PAUSE, ACTION_PUNCH, createInput,
} from './input.js';
import { stageShot } from './shots.js';
import { jumpToMission, resetCurrentMission } from './missions.js';
import { tryPunch, tryShoot } from './combat.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const debug = params.has('debug');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const S = world.state;
const renderer = createRenderer(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.cash !== 'number' || typeof save.missionIndex !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: S.cash,
      missionIndex: S.mission.index,
      completed: S.mission.index >= 4,
      playTime: S.stats.playTime || 0,
    }));
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* ignore */ }
}

S.hasSave = readSave() !== null;
S.stats.playTime = 0;

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(S, scene.screen, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let screenT = 0;
  let accumulator = 0;
  let last = performance.now();
  let fpsEma = 60;

  const unlockAudio = () => S.audio.unlock();
  window.addEventListener('keydown', unlockAudio, { once: false });
  window.addEventListener('pointerdown', unlockAudio, { once: false });

  function startNewGame() {
    clearSave();
    world.reset();
    S.hasSave = false;
    S.stats.playTime = 0;
    screen = 'play';
    screenT = 0;
    S.audio.ui();
    announce('Jakarta Heat. Mission 1: Macet Total. Get in Bu Ratna\'s car.');
  }

  function continueGame() {
    const save = readSave();
    world.reset();
    S.stats.playTime = save ? save.playTime || 0 : 0;
    if (save) {
      S.cash = save.cash;
      S.cashShown = save.cash;
      if (save.completed) {
        S.mission.index = 4;
        S.mission.active = false;
        S.objective = 'Free roam — Jakarta is yours.';
        S.marker = null;
      } else {
        jumpToMission(S, Math.min(3, Math.max(0, save.missionIndex)));
      }
    }
    screen = 'play';
    screenT = 0;
    S.audio.ui();
    announce('Story continued.');
  }

  function respawn(fine, label) {
    S.cash = Math.max(0, S.cash - fine);
    const player = S.player;
    player.car = null;
    player.x = 1210;
    player.y = 950;
    player.vx = 0;
    player.vy = 0;
    player.health = 100;
    player.ammo = Math.max(player.ammo, 0);
    S.wanted.heat = 0;
    S.wanted.stars = 0;
    S.wanted.bustT = 0;
    for (const car of S.wanted.police) car.dead = true;
    S.wanted.police = [];
    S.cars = S.cars.filter((c) => !c.dead);
    S.camera.x = player.x;
    S.camera.y = player.y;
    resetCurrentMission(S);
    writeSave();
    announce(label);
  }

  function handleEvents() {
    for (const event of world.takeEvents()) {
      if (event === 'wasted') {
        screen = 'wasted';
        screenT = 0;
        S.audio.fail();
        announce('Wasted. Bimo wakes up at the warung.');
      } else if (event === 'busted') {
        screen = 'busted';
        screenT = 0;
        S.audio.bust();
        announce('Busted by the police.');
      } else if (event === 'missionComplete') {
        writeSave();
      } else if (event === 'storyDone') {
        S.storyDone = true;
        screen = 'done';
        screenT = 0;
        writeSave();
        announce('Debt paid. Story complete.');
      }
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      S.audio.setMuted(!S.audio.isMuted());
      announce(S.audio.isMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (screen === 'title') {
      if (actions & ACTION_NEWGAME) startNewGame();
      else if (actions & ACTION_CONFIRM) {
        if (S.hasSave) continueGame();
        else startNewGame();
      }
      return;
    }
    if (screen === 'paused') {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = 'play';
        announce('Playing.');
      }
      return;
    }
    if (screen === 'busted' || screen === 'wasted') {
      if ((actions & ACTION_CONFIRM && screenT > 0.6) || screenT > 4) {
        respawn(screen === 'busted' ? WANTED.bustFine : WANTED.deathFine, 'Back on the street.');
        screen = 'play';
        screenT = 0;
      }
      return;
    }
    if (screen === 'done') {
      if (actions & ACTION_CONFIRM && screenT > 0.6) {
        screen = 'play';
        announce('Free roam. Jakarta is yours.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = 'paused';
      announce('Paused.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    fpsEma = fpsEma * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    screenT += dt;
    // Actions are taken once per frame: screen changes use them, and only the
    // first simulation substep sees them, so a press never fires twice.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === 'play' || screen === 'title') {
      accumulator += dt;
      let first = true;
      while (accumulator >= TICK && (screen === 'play' || screen === 'title')) {
        const stepActions = first ? actions : 0;
        first = false;
        if (screen === 'play') {
          if (stepActions & ACTION_PUNCH) tryPunch(S);
          if (stepActions & ACTION_HONK && S.player.car) S.audio.honk();
          if (input.mouseDown() && !S.player.car && S.player.hasPistol) {
            const target = renderer.worldFromScreen(input.mouse.clientX, input.mouse.clientY, S.camera);
            tryShoot(S, target.x, target.y);
          }
          world.step(TICK, input, stepActions, 'play');
          S.stats.playTime += TICK;
        } else {
          world.step(TICK, input, 0, 'backdrop');
        }
        accumulator -= TICK;
      }
    } else {
      accumulator = 0;
    }
    handleEvents();
    const pointer = renderer.toLogical(input.mouse.clientX, input.mouse.clientY);
    renderer.draw(S, screen, pointer);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  if (debug) {
    window.__jh = {
      state: S,
      world,
      screen: () => screen,
      fps: () => Math.round(fpsEma),
      teleport(x, y) {
        S.player.x = x;
        S.player.y = y;
        if (S.player.car) {
          S.player.car.x = x;
          S.player.car.y = y;
          S.player.car.speed = 0;
          S.player.car.vx = 0;
          S.player.car.vy = 0;
        }
        S.camera.x = x;
        S.camera.y = y;
      },
    };
  }

  announce('Jakarta Heat. Press Enter to start the story.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
