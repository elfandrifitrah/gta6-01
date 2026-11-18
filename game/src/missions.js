// The story: four missions for Bu Ratna, each a short chain of steps — reach
// a place, get in a car, take someone down, collect something, hit race gates.
// Steps set the HUD marker and objective; completing a mission pays out,
// saves, and opens the next one. Failing a timer restarts the mission.

import { PAYOUTS, MISSION_NAMES } from './config.js';
import { dist } from './vec.js';
import { findFreeSpot } from './city.js';
import { makeCar, setJam } from './traffic.js';
import { spawnThief, spawnGoon, spawnGuard } from './enemies.js';
import { spawnPickup } from './combat.js';
import { addHeat } from './wanted.js';

const STEP_DEFS = [
  {
    intro: 'Bu Ratna needs a package across town. The avenue is jammed solid.',
    steps: [
      { type: 'enterCar', text: "Get in Bu Ratna's car" },
      { type: 'reach', text: 'Deliver the package to the Thamrin drop', marker: 'dropNorth', radius: 75, timer: 95, jam: true },
    ],
  },
  {
    intro: 'A courier lost Bu Ratna\'s suitcase in the kampung. Someone took it.',
    steps: [
      { type: 'reach', text: 'Find the courier in the kampung alleys', marker: 'kampungAlley', radius: 65 },
      { type: 'defeat', text: 'Catch the thief — take him down' },
      { type: 'collect', text: 'Pick up the suitcase', flag: 'suitcase' },
      { type: 'reach', text: 'Bring the suitcase back to Bu Ratna', marker: 'warung', radius: 75 },
    ],
  },
  {
    intro: 'A street race on the avenue loop. Bu Ratna bet on you. Do not lose.',
    steps: [
      { type: 'enterCar', text: 'Get in the race car at the start line', race: true },
      { type: 'gates', text: 'Hit every gate before the clock runs out', timer: 130 },
    ],
  },
  {
    intro: 'A ledger sits in a port container. It is a trap. Go anyway.',
    steps: [
      { type: 'reach', text: 'Drive to the warehouse at the port', marker: 'portYard', radius: 85 },
      { type: 'defeat', text: 'The trap is sprung — clear the yard' },
      { type: 'collect', text: 'Take the ledger from the container', flag: 'ledger' },
      { type: 'escape', text: 'The police are coming — escape to Bu Ratna', marker: 'warung', radius: 75 },
    ],
  },
];

export function createMissions() {
  return { index: 0, stepIdx: 0, timer: 0, data: {}, active: true, spawns: [] };
}

function trackSpawn(S, ref) {
  S.mission.spawns.push(ref);
}

function clearSpawns(S) {
  for (const ref of S.mission.spawns) {
    if (ref && typeof ref === 'object') {
      if ('hp' in ref && 'kind' in ref && ref.kind !== undefined && 'maxHp' in ref) ref.dead = true;
      else if ('w' in ref) ref.dead = true;
    }
  }
  S.cars = S.cars.filter((c) => !c.dead);
  S.enemies.list = S.enemies.list.filter((e) => !e.dead);
  S.mission.spawns = [];
  S.rivals = [];
}

function spawnMissionCar(S, x, y, heading, color, race) {
  const car = makeCar('sedan', x, y, heading, color);
  car.parked = true;
  car.driver = false;
  car.missionCar = true;
  car.race = !!race;
  S.cars.push(car);
  trackSpawn(S, car);
  return car;
}

function setupStep(S) {
  const def = STEP_DEFS[S.mission.index];
  const step = def.steps[S.mission.stepIdx];
  const data = S.mission.data;
  const markers = S.city.markers;
  S.mission.timer = step.timer || 0;
  S.objective = step.text;
  if (step.marker) {
    const m = markers[step.marker];
    S.marker = { x: m.x, y: m.y, r: step.radius || 60 };
  } else {
    S.marker = null;
  }

  if (S.mission.index === 0 && S.mission.stepIdx === 0) {
    const spot = findFreeSpot(S.city, 1236, 900, 26);
    data.car = spawnMissionCar(S, spot.x, spot.y, -Math.PI / 2, '#d8b13c', false);
  }
  if (S.mission.index === 0 && S.mission.stepIdx === 1) {
    setJam(S, true);
  }
  if (S.mission.index === 1 && S.mission.stepIdx === 1) {
    data.thief = spawnThief(S, 2100, 620);
    trackSpawn(S, data.thief);
    trackSpawn(S, spawnGoon(S, 2040, 560));
    trackSpawn(S, spawnGoon(S, 2180, 700));
    data.dropped = false;
  }
  if (S.mission.index === 2 && S.mission.stepIdx === 0) {
    data.car = spawnMissionCar(S, 1300, 1500, -Math.PI / 2, '#a83a32', true);
  }
  if (S.mission.index === 2 && S.mission.stepIdx === 1) {
    data.gateIdx = 0;
    data.gates = S.city.raceGates;
    S.raceProgress = { hit: 0, total: data.gates.length };
    // Clear the starting grid first. Traffic cars that overlap the grid
    // grind against the race car and the rivals, drain their health to
    // zero before the flag drops, and shove the player off the route.
    // Pushed cars keep their routes and drive back on their own.
    for (const other of S.cars) {
      if (other === S.player.car) continue;
      const dd = Math.hypot(other.x - 1300, other.y - 1600);
      if (dd < 150) {
        other.y = Math.min(1900, Math.max(100, other.y + (other.y >= 1600 ? 220 : -220)));
        other.vx = 0;
        other.vy = 0;
      }
    }
    const rivalColors = ['#3a5a8c', '#e8e4da', '#5a7a4a'];
    const grid = [[1267, 1570], [1333, 1570], [1300, 1640]];
    S.rivals = [];
    for (let i = 0; i < 3; i += 1) {
      const car = makeCar('sedan', grid[i][0], grid[i][1], -Math.PI / 2, rivalColors[i]);
      car.rival = true;
      car.race = true;
      car.driver = false;
      car.gateIdx = 0;
      S.cars.push(car);
      S.rivals.push(car);
      trackSpawn(S, car);
    }
    const g = data.gates[0];
    S.marker = { x: g.x, y: g.y, r: 60 };
  }
  if (S.mission.index === 3 && S.mission.stepIdx === 0) {
    S.player.hasPistol = true;
    S.player.ammo = Math.max(S.player.ammo, 24);
    S.showBanner('Bu Ratna lends you her pistol', 'Click to shoot. F to punch.', 3);
  }
  if (S.mission.index === 3 && S.mission.stepIdx === 1) {
    data.guards = [];
    for (const post of S.city.guardPosts) {
      const guard = spawnGuard(S, post.x, post.y);
      data.guards.push(guard);
      trackSpawn(S, guard);
    }
  }
  if (S.mission.index === 3 && S.mission.stepIdx === 2) {
    const m = markers.ledger;
    spawnPickup(S, 'ledger', m.x, m.y);
    S.marker = { x: m.x, y: m.y, r: 55 };
  }
  if (S.mission.index === 3 && S.mission.stepIdx === 3) {
    addHeat(S, 300);
    S.showBanner('The police are coming', 'Get back to Bu Ratna, fast.', 3);
  }
}

export function setupMission(S, index) {
  S.mission.index = index;
  S.mission.stepIdx = 0;
  S.mission.data = {};
  S.mission.active = true;
  S.flags.suitcase = false;
  S.flags.ledger = false;
  setupStep(S);
  S.showBanner(MISSION_NAMES[index], STEP_DEFS[index].intro, 3.4);
}

export function jumpToMission(S, index) {
  clearSpawns(S);
  setJam(S, false);
  setupMission(S, index);
}

/** Walk a mission forward to a given step for screenshot staging: cars are
 * boarded and markers reached without payouts, so the staged scene is real. */
export function stageAt(S, index, stepIdx) {
  clearSpawns(S);
  setJam(S, false);
  S.mission.index = index;
  S.mission.stepIdx = 0;
  S.mission.data = {};
  S.mission.active = true;
  setupStep(S);
  while (S.mission.stepIdx < stepIdx) {
    const step = STEP_DEFS[index].steps[S.mission.stepIdx];
    const data = S.mission.data;
    if (step.type === 'enterCar' && data.car) {
      S.player.car = data.car;
      data.car.parked = false;
      S.player.x = data.car.x;
      S.player.y = data.car.y;
    }
    if ((step.type === 'reach' || step.type === 'escape') && S.marker) {
      S.player.x = S.marker.x;
      S.player.y = S.marker.y;
      if (S.player.car) {
        S.player.car.x = S.marker.x;
        S.player.car.y = S.marker.y;
      }
    }
    S.mission.stepIdx += 1;
    setupStep(S);
  }
  S.banner = null;
}

function failMission(S, reason) {
  S.audio.fail();
  S.showBanner('Failed', reason, 2.6);
  clearSpawns(S);
  setJam(S, false);
  S.mission.data = {};
  S.mission.stepIdx = 0;
  setupStep(S);
}

export function resetCurrentMission(S) {
  if (!S.mission.active || S.mission.index >= 4) return;
  clearSpawns(S);
  setJam(S, false);
  S.mission.data = {};
  S.mission.stepIdx = 0;
  setupStep(S);
}

function completeStep(S) {
  const def = STEP_DEFS[S.mission.index];
  S.audio.coin();
  if (S.mission.stepIdx === 0 && S.mission.index === 0) setJam(S, false);
  S.mission.stepIdx += 1;
  if (S.mission.stepIdx >= def.steps.length) {
    const payout = PAYOUTS[S.mission.index];
    S.cash += payout;
    S.stats.missionsDone += 1;
    S.audio.jingle();
    S.showBanner(`Mission complete  +$${payout}`, MISSION_NAMES[S.mission.index], 3.2);
    S.events.push('missionComplete');
    setJam(S, false);
    S.mission.index += 1;
    S.mission.stepIdx = 0;
    S.mission.data = {};
    if (S.mission.index >= 4) {
      S.mission.active = false;
      S.objective = 'Free roam — Jakarta is yours.';
      S.marker = null;
      S.events.push('storyDone');
    } else {
      setupMission(S, S.mission.index);
    }
    return;
  }
  setupStep(S);
}

const RIVAL_ROUTE = [
  [1300, 1000], [1300, 360], [1700, 360], [2080, 360], [2080, 700], [2080, 1400],
  [2080, 1640], [1700, 1640], [900, 1640], [520, 1640], [520, 1300], [520, 1640],
  [1300, 1640], [1300, 1500],
];

function stepRivals(S, dt) {
  const gates = RIVAL_ROUTE;
  for (const car of S.rivals) {
    if (car.gateIdx >= gates.length) {
      car.speed = Math.max(0, car.speed - 200 * dt);
      continue;
    }
    const g = gates[car.gateIdx];
    const d = dist(car.x, car.y, g[0], g[1]);
    if (d < 55) {
      car.gateIdx += 1;
      continue;
    }
    const want = Math.atan2(g[1] - car.y, g[0] - car.x);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    car.speed = Math.min(305, car.speed + 240 * dt);
    car.vx = Math.cos(car.heading) * car.speed;
    car.vy = Math.sin(car.heading) * car.speed;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
  }
}

export function stepMissions(S, dt) {
  if (!S.mission.active || S.mission.index >= 4) return;
  stepRivals(S, dt);
  const step = STEP_DEFS[S.mission.index].steps[S.mission.stepIdx];
  const data = S.mission.data;
  const player = S.player;

  if (step.timer) {
    S.mission.timer -= dt;
    if (S.mission.timer <= 0) {
      failMission(S, 'Too slow — try again.');
      return;
    }
  }

  if (step.type === 'enterCar') {
    if (data.car) S.marker = { x: data.car.x, y: data.car.y, r: 60 };
    if (player.car === data.car) completeStep(S);
  } else if (step.type === 'reach' || step.type === 'escape') {
    if (S.marker && dist(player.x, player.y, S.marker.x, S.marker.y) < S.marker.r) completeStep(S);
  } else if (step.type === 'defeat') {
    if (S.mission.index === 1) {
      if (data.thief && data.thief.dead && !data.dropped) {
        data.dropped = true;
        spawnPickup(S, 'suitcase', data.thief.x, data.thief.y);
        spawnPickup(S, 'health', data.thief.x + 44, data.thief.y + 26);
        completeStep(S);
      }
    } else if (S.mission.index === 3) {
      if (data.guards && data.guards.every((g) => g.dead)) completeStep(S);
    }
  } else if (step.type === 'collect') {
    if (S.flags[step.flag]) completeStep(S);
  } else if (step.type === 'gates') {
    const g = data.gates[data.gateIdx];
    if (g) {
      S.marker = { x: g.x, y: g.y, r: 60 };
      if (dist(player.x, player.y, g.x, g.y) < 62) {
        data.gateIdx += 1;
        S.raceProgress.hit = data.gateIdx;
        S.audio.coin();
        S.fx.floatText(`Gate ${data.gateIdx}/${data.gates.length}`, player.x, player.y - 40, '#ffd94d');
        if (data.gateIdx >= data.gates.length) completeStep(S);
      }
    }
  }
}
