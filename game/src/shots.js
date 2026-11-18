// The screenshot scenes behind ?shot=start|play|end|vista. Each one stages a
// real game state through the same rules the player meets — the title over a
// living avenue, a police chase mid-mission, the paid-off ending, and a wide
// view of the monument plaza — then the runner paints it and sets
// window.__shotReady. The seed fixes the city; the staging fixes the moment.

import { TICK } from './config.js';
import { stageAt } from './missions.js';
import { addHeat } from './wanted.js';
import { clamp } from './vec.js';

function driveToward(S) {
  // Autopilot: full throttle, steer at the marker, ease off in tight turns.
  const player = S.player;
  const marker = S.marker;
  if (!marker || !player.car) return { x: 0, y: 0 };
  const want = Math.atan2(marker.y - player.y, marker.x - player.x);
  let diff = want - player.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { x: clamp(diff * 2.2, -1, 1), y: 1 };
}

function fakeInput(S) {
  return {
    axes: () => driveToward(S),
    held: { brake: false, sprint: false },
    takeActions: () => 0,
    mouse: { clientX: 0, clientY: 0 },
  };
}

export function stageShot(name, world) {
  const S = world.state;
  world.reset();
  const input = fakeInput(S);

  if (name === 'play') {
    // Mid-chase on Sudirman: delivering the package, three stars, patrols closing.
    stageAt(S, 0, 1);
    S.player.car.x = 1300;
    S.player.car.y = 1420;
    S.player.car.heading = -Math.PI / 2;
    S.player.x = 1300;
    S.player.y = 1420;
    S.camera.x = 1300;
    S.camera.y = 1420;
    addHeat(S, 300);
    // Drive until the drop is half a screen ahead: mid-avenue, patrols closing.
    for (let i = 0; i < 8 / TICK; i += 1) {
      world.step(TICK, input, 0);
      const d = Math.hypot(S.player.x - S.marker.x, S.player.y - S.marker.y);
      if (d < 520) break;
    }
    S.showBanner('Macet Total', 'Deliver the package to the Thamrin drop', 3.4);
    S.banner.t = 0.5; // past the pop-in, so the banner reads in the still frame
    return { screen: 'play' };
  }

  if (name === 'end') {
    // The paid-off ending at Bu Ratna's warung, dusk light, story complete.
    S.cash = 5250;
    S.cashShown = 5250;
    S.mission.index = 4;
    S.mission.active = false;
    S.objective = 'Free roam — Jakarta is yours.';
    S.marker = null;
    S.stats.playTime = 754;
    S.player.x = 1210;
    S.player.y = 950;
    S.camera.x = 1210;
    S.camera.y = 950;
    for (let i = 0; i < 4 / TICK; i += 1) world.step(TICK, input, 0, 'backdrop');
    return { screen: 'done' };
  }

  if (name === 'vista') {
    // Wide view of the monument plaza with the HUD on: the city at a glance.
    // At zoom 0.55 the frame spans 2327x1309 world units, so the camera
    // sits at the city centre: any further west and the frame shows the
    // void past the world's edge as a dark band.
    S.player.x = 760;
    S.player.y = 900;
    S.camera.x = 1300;
    S.camera.y = 850;
    S.camera.zoomTarget = 0.55;
    S.camera.zoom = 0.55;
    for (let i = 0; i < 8 / TICK; i += 1) world.step(TICK, input, 0, 'backdrop');
    S.camera.x = 1300;
    S.camera.y = 850;
    return { screen: 'play' };
  }

  // Start: the title over the avenue as traffic rolls past the warung.
  S.camera.x = 1080;
  S.camera.y = 760;
  for (let i = 0; i < 6 / TICK; i += 1) world.step(TICK, input, 0, 'backdrop');
  S.camera.x = 1080;
  S.camera.y = 760;
  return { screen: 'title' };
}
