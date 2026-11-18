// The story: four missions that pay Bimo's $5,000 debt to Bu Ratna, in order. Each
// mission is a list of stages with a setup and a completion test; the marker, the
// objective text and the payout all flow from the current stage.

import { CASH, MISSION_TITLES, SAVE_KEY } from './config.js';
import { dist2 } from './vec.js';
import { say, showBanner } from './hud.js';
import { spawnEnemy } from './combat.js';
import { makeVehicle } from './traffic.js';
import { addWanted } from './wanted.js';
import { spawnFloater } from './effects.js';

function gotoStage(text, point, radius, needVehicle) {
  return {
    text,
    setup(G) { G.marker = { x: point.x, z: point.z }; },
    done(G) {
      const p = G.player;
      if (needVehicle && !p.driving) return false;
      return dist2(p.x, p.z, point.x, point.z) < radius;
    },
  };
}

function enterStage(text, car) {
  return {
    text,
    setup(G) { G.marker = { x: car.x, z: car.z }; },
    done(G) { return G.player.driving === car; },
  };
}

function killStage(text, enemies) {
  return {
    text,
    setup(G) { G.marker = null; },
    marker(G) {
      const alive = enemies.find((e) => !e.dead);
      if (alive) G.marker = { x: alive.x, z: alive.z };
      else G.marker = null;
    },
    done() { return enemies.every((e) => e.dead); },
  };
}

function pickupStage(text, item) {
  return {
    text,
    setup(G) { G.marker = { x: item.x, z: item.z }; },
    done(G) {
      if (item.taken) return true;
      if (dist2(G.player.x, G.player.z, item.x, item.z) < 2.6) {
        item.taken = true;
        G.audio.pickup();
        spawnFloater(G, item.x, 2.2, item.z, item.label, '#ffd257');
        return true;
      }
      return false;
    },
  };
}

const RACE_GATES = [
  { x: 0, z: -110 }, { x: 110, z: -120 }, { x: 120, z: 110 }, { x: 0, z: 120 }, { x: 0, z: 80 },
];

function buildStages(G, index) {
  const P = G.city.places;
  if (index === 0) {
    const car = makeVehicle(G, 'sedan', P.missionCar.x, P.missionCar.z, Math.PI, 'mission');
    car.color = [36, 56, 120];
    G.vehicles.push(car);
    return [
      enterStage('Get in the marked car by the warung.', car),
      gotoStage('Drive through the jam to the first checkpoint.', { x: 0, z: -60 }, 11, true),
      gotoStage('Keep going: second checkpoint on the cross street.', { x: 60, z: -120 }, 11, true),
      {
        text: 'Deliver the package to the contact at the plaza.',
        setup(G2) {
          G2.marker = { x: P.plazaContact.x, z: P.plazaContact.z };
          addWanted(G2, 1, 'spotted');
          say(G2, 'A patrol spotted the car. Deliver fast.', '#ff8a7a');
        },
        done(G2) { return dist2(G2.player.x, G2.player.z, P.plazaContact.x, P.plazaContact.z) < 8; },
      },
    ];
  }
  if (index === 1) {
    const thugs = [];
    const suitcase = { kind: 'suitcase', label: 'Suitcase recovered', x: P.suitcase.x, z: P.suitcase.z, taken: false };
    return [
      {
        text: 'Go to the kampung alley where the thieves hide.',
        setup(G2) {
          G2.marker = { x: P.kampungAlley.x, z: P.kampungAlley.z };
          thugs.push(spawnEnemy(G2, P.kampungAlley.x - 4, P.kampungAlley.z - 3, 'fist', 60));
          thugs.push(spawnEnemy(G2, P.kampungAlley.x + 4, P.kampungAlley.z + 2, 'fist', 60));
          thugs.push(spawnEnemy(G2, P.kampungAlley.x + 1, P.kampungAlley.z + 6, 'pistol', 50));
        },
        done(G2) { return dist2(G2.player.x, G2.player.z, P.kampungAlley.x, P.kampungAlley.z) < 11; },
      },
      killStage('Take back the suitcase: deal with the thieves.', thugs),
      {
        text: 'Pick up the suitcase.',
        setup(G2) {
          G2.items.push(suitcase);
          G2.marker = { x: suitcase.x, z: suitcase.z };
        },
        done(G2) {
          if (suitcase.taken) return true;
          if (dist2(G2.player.x, G2.player.z, suitcase.x, suitcase.z) < 2.6) {
            suitcase.taken = true;
            G2.audio.pickup();
            spawnFloater(G2, suitcase.x, 2.2, suitcase.z, 'Suitcase recovered', '#ffd257');
            addWanted(G2, 1, 'reported');
            say(G2, 'Someone called the police.', '#ff8a7a');
            return true;
          }
          return false;
        },
      },
      gotoStage('Bring the suitcase to Bu Ratna.', P.warung, 8, false),
    ];
  }
  if (index === 2) {
    const car = makeVehicle(G, 'race', P.raceStart.x, P.raceStart.z, Math.PI, 'mission');
    G.vehicles.push(car);
    const racers = [];
    return [
      enterStage('Get in the race car at the start line.', car),
      {
        text: 'Race: hit every gate before the rivals do.',
        objectiveText(G2) { return `Race: gate ${Math.min(G2.racePlayerGate + 1, G2.raceGates.length)} of ${G2.raceGates.length}. Beat the rivals.`; },
        setup(G2) {
          G2.raceGates = RACE_GATES.map((g) => ({ ...g, passed: false }));
          G2.racePlayerGate = 0;
          G2.marker = { x: RACE_GATES[0].x, z: RACE_GATES[0].z };
          for (const ox of [-6, 6]) {
            const r = makeVehicle(G2, 'race', P.raceStart.x + ox, P.raceStart.z + 8, Math.PI, 'racer');
            G2.vehicles.push(r);
            racers.push(r);
          }
          say(G2, 'GO! Beat the rivals through every gate.', '#ffd257');
          G2.audio.horn();
        },
        marker(G2) {
          const g = G2.raceGates[G2.racePlayerGate];
          G2.marker = g ? { x: g.x, z: g.z } : null;
        },
        done(G2) {
          const g = G2.raceGates[G2.racePlayerGate];
          if (g && dist2(G2.player.x, G2.player.z, g.x, g.z) < 9) {
            g.passed = true;
            G2.racePlayerGate += 1;
            G2.audio.pickup();
            if (G2.racePlayerGate >= G2.raceGates.length) {
              if (racers.some((r) => r.finished)) {
                failMission(G2, 'A rival beat you to the finish.');
                return false;
              }
              return true;
            }
            say(G2, `Checkpoint ${G2.racePlayerGate} of ${G2.raceGates.length}.`, '#9fe08a');
          }
          if (racers.some((r) => r.finished) && G2.racePlayerGate < G2.raceGates.length) {
            failMission(G2, 'A rival beat you to the finish.');
          }
          return false;
        },
      },
    ];
  }
  const guards = [];
  const ledger = { kind: 'ledger', label: 'Ledger taken', x: P.ledger.x, z: P.ledger.z, taken: false };
  const escapeCar = makeVehicle(G, 'sedan', P.escapeCar.x, P.escapeCar.z, Math.PI / 2, 'mission');
  escapeCar.color = [160, 40, 36];
  G.vehicles.push(escapeCar);
  return [
    {
      text: 'Drive to the port warehouse.',
      setup(G2) {
        G2.marker = { x: P.portGate.x, z: P.portGate.z };
        // Guards stand outside the warehouse walls: the footprint is 22 by 30, so
        // offsets inside it would trap them against the colliders.
        guards.push(spawnEnemy(G2, P.warehouse.x - 14, P.warehouse.z - 10, 'pistol', 55));
        guards.push(spawnEnemy(G2, P.warehouse.x + 14, P.warehouse.z - 6, 'pistol', 55));
        guards.push(spawnEnemy(G2, P.warehouse.x - 13, P.warehouse.z + 10, 'fist', 65));
        guards.push(spawnEnemy(G2, P.warehouse.x + 13, P.warehouse.z + 8, 'pistol', 55));
        guards.push(spawnEnemy(G2, P.warehouse.x, P.warehouse.z + 22, 'pistol', 120));
      },
      done(G2) { return dist2(G2.player.x, G2.player.z, P.portGate.x, P.portGate.z) < 13; },
    },
    killStage('Clear the guards at the warehouse.', guards),
    {
      text: 'Take the ledger from the warehouse.',
      setup(G2) {
        G2.items.push(ledger);
        G2.marker = { x: ledger.x, z: ledger.z };
      },
      done(G2) {
        if (ledger.taken) return true;
        if (dist2(G2.player.x, G2.player.z, ledger.x, ledger.z) < 2.6) {
          ledger.taken = true;
          G2.audio.pickup();
          spawnFloater(G2, ledger.x, 2.2, ledger.z, 'Ledger taken', '#ffd257');
          addWanted(G2, 2, 'port alarm');
          say(G2, 'The alarm is up. The whole port is coming.', '#ff8a7a');
          return true;
        }
        return false;
      },
    },
    enterStage('Escape: get in the car by the quay.', escapeCar),
    gotoStage('Reach Bu Ratna with the ledger.', P.warung, 8, false),
  ];
}

function cleanupMission(G) {
  G.enemies.length = 0;
  G.items.length = 0;
  G.raceGates = [];
  G.racePlayerGate = 0;
  for (let i = G.vehicles.length - 1; i >= 0; i -= 1) {
    const v = G.vehicles[i];
    if (v.driver === 'mission' || v.driver === 'racer') G.vehicles.splice(i, 1);
  }
  G.marker = null;
}

export function startMission(G, index) {
  cleanupMission(G);
  const stages = buildStages(G, index);
  G.mission = { index, stages, stage: 0, stageT: 0, active: true };
  const first = stages[0];
  first.setup(G);
  say(G, `Mission: ${MISSION_TITLES[index]}. ${first.text}`, '#ffd257');
  updateObjective(G);
}

export function failMission(G, why) {
  if (!G.mission || !G.mission.active) return;
  G.mission.active = false;
  showBanner(G, 'MISSION FAILED', why);
  G.audio.fail();
  const index = G.mission.index;
  G.retryMission = { index, t: 2.2 };
}

export function completeMission(G) {
  const m = G.mission;
  const pay = CASH.payouts[m.index];
  G.cash += pay;
  showBanner(G, 'MISSION COMPLETE', `+$${pay.toLocaleString('en-US')} · ${MISSION_TITLES[m.index]}`);
  G.audio.complete();
  spawnFloater(G, G.player.x, 2.6, G.player.z, `+$${pay}`, '#9fe08a');
  say(G, `Bu Ratna pays $${pay}. Cash $${G.cash.toLocaleString('en-US')} of $${CASH.debt.toLocaleString('en-US')}.`, '#9fe08a');
  m.active = false;
  const next = m.index + 1;
  if (next >= MISSION_TITLES.length) {
    G.storyDone = true;
    G.storyPending = true;
    saveGame(G);
    return;
  }
  // Keep the completed mission object until the next one starts: the HUD, the state
  // hook and the retry timer all stay coherent through the banner window.
  G.retryMission = { index: next, t: 2.4, fresh: true };
  saveGame(G);
}

export function updateMissions(G, dt) {
  if (G.retryMission) {
    G.retryMission.t -= dt;
    if (G.retryMission.t <= 0) {
      const next = G.retryMission.index;
      G.retryMission = null;
      startMission(G, next);
    }
    return;
  }
  const m = G.mission;
  if (!m || !m.active) {
    updateObjective(G);
    return;
  }
  m.stageT += dt;
  const stage = m.stages[m.stage];
  if (!stage) return;
  if (stage.marker) stage.marker(G);
  if (stage.done(G)) {
    m.stage += 1;
    m.stageT = 0;
    if (m.stage >= m.stages.length) {
      completeMission(G);
    } else {
      const next = m.stages[m.stage];
      next.setup(G);
      say(G, next.text, '#ffffff');
    }
  }
  updateObjective(G);
}

export function updateObjective(G) {
  const m = G.mission;
  if (!m || !m.active || !m.stages[m.stage]) {
    if (G.storyDone) {
      G.objective = { title: 'Debt paid', text: 'Free roam. Jakarta is yours.', dist: 0 };
    } else if (m && m.stages.length) {
      G.objective = { title: MISSION_TITLES[m.index], text: 'Mission complete.', dist: 0 };
    } else {
      G.objective = { title: '', text: '', dist: 0 };
    }
    return;
  }
  const stage = m.stages[m.stage];
  let dist = 0;
  if (G.marker) dist = Math.round(dist2(G.player.x, G.player.z, G.marker.x, G.marker.z));
  const text = typeof stage.objectiveText === 'function' ? stage.objectiveText(G) : stage.text;
  G.objective = { title: MISSION_TITLES[m.index], text, dist };
}

export function saveGame(G) {
  try {
    const data = {
      cash: G.cash,
      mission: G.mission ? G.mission.index : 0,
      storyDone: !!G.storyDone,
      x: G.player.x,
      z: G.player.z,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage can be off; the game still runs */ }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.mission !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

export { pickupStage };
