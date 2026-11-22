// Jakarta Heat boot and main loop. Written in this session.
import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, clamp, angleLerp } from './random.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { buildWorld, collideCircle } from './world.js';
import { createVehicleSystem } from './vehicles.js';
import { createPeopleSystem } from './people.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { readSave, writeSave } from './save.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;

const canvas = document.getElementById('game');
const scene = new THREE.Scene();
const renderer = createRenderer(canvas);
const world = buildWorld(scene);
input.init(canvas);

const G = {
  cash: CFG.startCash, health: CFG.playerHealth, ammo: CFG.pistolAmmo,
  wanted: 0, wantedIdle: 0, timeSinceCrime: 99, bustMeter: 0,
  player: { x: -60, z: 26, angle: 0, speed: 0, mesh: null },
  playerCar: null, marker: null, message: '', msgT: 0,
  screen: 'title', time: 0, shotCam: null, vehicles: null, people: null, missions: null,
};
G.player.mesh = null;
const people = createPeopleSystem(scene, G);
G.people = people;
const vehicles = createVehicleSystem(scene, G);
G.vehicles = vehicles;
const missions = createMissions(scene, G, { vehicles, people });
G.missions = missions;
const hud = createHud(G);

const personMesh = people.makePersonMesh({ rng: mulberry32(99), shirt: 0xd81b60 });
personMesh.position.set(G.player.x, 0, G.player.z);
scene.add(personMesh);
G.player.mesh = personMesh;

G.announce = (msg) => { G.message = msg; G.msgT = 5; };
G.addWanted = (n) => { G.wanted = clamp(G.wanted + n, 0, 5); G.timeSinceCrime = 0; };
G.saveGame = () => writeSave({ cash: G.cash, missionIndex: missions.M.index, health: G.health, ammo: G.ammo, x: G.player.x, z: G.player.z });
G.teleport = (x, z) => {
  G.player.x = x; G.player.z = z;
  if (G.playerCar) { G.playerCar.x = x; G.playerCar.z = z; G.playerCar.mesh.position.set(x, 0, z); }
  personMesh.position.set(x, 0, z);
};
G.damagePlayer = (n) => {
  if (G.screen !== 'play') return;
  G.health -= n; audio.hurt();
  if (G.health <= 0) G.wasted();
};
G.busted = () => {
  G.cash = Math.max(0, G.cash - 100);
  G.health = CFG.playerHealth; G.wanted = 0; G.bustMeter = 0;
  if (G.playerCar) { G.playerCar.driven = false; G.playerCar = null; personMesh.visible = true; }
  if (missions.M.active) missions.fail('busted');
  G.teleport(CFG.places.home[0], CFG.places.home[1]);
  G.announce('Busted. You lost $100.');
};
G.wasted = () => {
  G.cash = Math.max(0, G.cash - 100);
  G.health = CFG.playerHealth; G.wanted = 0; G.bustMeter = 0;
  if (G.playerCar) { G.playerCar.driven = false; G.playerCar = null; personMesh.visible = true; }
  if (missions.M.active) missions.fail('wasted');
  G.teleport(CFG.places.home[0], CFG.places.home[1]);
  G.announce('Wasted. You lost $100.');
};
function enterCar(v) {
  v.driven = true;
  if (v.health === undefined) v.health = 100;
  G.playerCar = v;
  personMesh.visible = false;
  if (v.kind === 'police') { G.addWanted(1); G.announce('Police car stolen.'); }
  else { G.addWanted(1); people.scarePeds(v.x, v.z); }
  audio.engine(true);
}
function exitCar() {
  const v = G.playerCar;
  if (!v) return;
  v.driven = false; v.speed = 0;
  G.playerCar = null;
  G.player.x = v.x + 3; G.player.z = v.z + 3;
  personMesh.visible = true;
  personMesh.position.set(G.player.x, 0, G.player.z);
}
function startGame() {
  audio.unlock(); audio.startMusic();
  G.screen = 'play';
  hud.showTitle(false);
  missions.idleMarker();
  G.announce('Jakarta, 2026. You owe Bu Ratna $5,000.');
}
G.startGame = startGame;
function loadSave() {
  const s = readSave();
  if (!s) return false;
  G.cash = s.cash; missions.M.index = s.missionIndex || 0;
  G.health = s.health || 100; G.ammo = s.ammo || CFG.pistolAmmo;
  G.teleport(s.x ?? -60, s.z ?? 26);
  startGame();
  G.announce('Save loaded. Continue the story.');
  return true;
}
function resetStory() {
  G.cash = CFG.startCash; G.health = CFG.playerHealth; G.ammo = CFG.pistolAmmo;
  missions.M.index = 0; missions.M.completed = false; missions.M.failed = null;
  missions.cleanup();
  G.teleport(-60, 26);
  startGame();
}
document.getElementById('startBtn').addEventListener('click', () => { audio.click(); startGame(); });
document.getElementById('continueBtn').addEventListener('click', () => { audio.click(); loadSave(); });
document.getElementById('resumeBtn').addEventListener('click', () => { G.screen = 'play'; hud.show(hud.els.pause, false); });
document.getElementById('retryBtn').addEventListener('click', () => {
  hud.show(hud.els.fail, false);
  if (missions.M.index < 4) { missions.M.failed = null; missions.start(); }
});
document.getElementById('againBtn').addEventListener('click', () => { hud.show(hud.els.complete, false); resetStory(); });

function driveCar(dt) {
  const v = G.playerCar;
  const ax = input.axis();
  const max = v.kind === 'sport' ? CFG.sportMax : v.kind === 'bike' ? 32 : v.kind === 'bus' ? 20 : CFG.carMax;
  if (ax.z < 0) v.speed += CFG.carAccel * dt;
  else if (ax.z > 0) v.speed -= CFG.carBrake * dt;
  else v.speed *= (1 - 0.6 * dt);
  if (input.down('Space')) v.speed *= (1 - 3 * dt);
  v.speed = clamp(v.speed, -10, max);
  v.angle += ax.x * CFG.carTurn * dt * clamp(Math.abs(v.speed) / 10, 0, 1) * (v.speed < 0 ? -1 : 1);
  v.x += Math.sin(v.angle) * v.speed * dt;
  v.z += Math.cos(v.angle) * v.speed * dt;
  v.x = clamp(v.x, -108, 108); v.z = clamp(v.z, -128, 108);
  const hit = collideCircle(world.colliders, v.x, v.z, 2);
  if (hit) { v.x = hit.x; v.z = hit.z; if (Math.abs(v.speed) > 6) { v.health -= 6; } v.speed *= 0.4; }
  for (const o of [...vehicles.traffic, ...vehicles.bikes]) {
    if (o === v || o.driven) continue;
    const d = Math.hypot(o.x - v.x, o.z - v.z);
    if (d < 3.2 && Math.abs(v.speed) > 4) {
      v.health -= 8; v.speed *= 0.5;
      o.x += (o.x - v.x) * 0.4; o.z += (o.z - v.z) * 0.4;
      audio.punch();
    }
  }
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.angle;
  G.player.x = v.x; G.player.z = v.z; G.player.angle = v.angle;
  if (Math.abs(v.speed) > 1) audio.engine(true);
  if (v.health <= 0) {
    const wasMission = missions.gtCar === v;
    vehicles.removeVehicle(v);
    G.playerCar = null; personMesh.visible = true;
    G.player.x = v.x + 3; G.player.z = v.z + 3;
    personMesh.position.set(G.player.x, 0, G.player.z);
    G.announce('Car wrecked.');
    if (wasMission && missions.M.active) missions.fail('mission car wrecked');
  }
}
function walk(dt) {
  const ax = input.axis();
  const yaw = renderer.camYaw;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const rx = -Math.cos(yaw), rz = Math.sin(yaw);
  let mx = fx * -ax.z + rx * ax.x;
  let mz = fz * -ax.z + rz * ax.x;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    const sp = input.down('ShiftLeft') || input.down('ShiftRight') ? CFG.sprintSpeed : CFG.walkSpeed;
    G.player.x += mx * sp * dt;
    G.player.z += mz * sp * dt;
    G.player.angle = angleLerp(G.player.angle, Math.atan2(mx, mz), Math.min(1, dt * 10));
    G.player.x = clamp(G.player.x, -108, 108); G.player.z = clamp(G.player.z, -128, 108);
    const hit = collideCircle(world.colliders, G.player.x, G.player.z, 0.6);
    if (hit) { G.player.x = hit.x; G.player.z = hit.z; }
  }
  personMesh.position.set(G.player.x, 0, G.player.z);
  personMesh.rotation.y = G.player.angle;
}
function combat() {
  if (input.wasPressed('KeyF')) {
    audio.punch();
    for (const e of [...people.enemies]) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - G.player.x, e.z - G.player.z);
      const ang = Math.atan2(e.x - G.player.x, e.z - G.player.z);
      let diff = ang - G.player.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (d < CFG.punchRange && Math.abs(diff) < 1.0) {
        e.health -= CFG.punchDamage;
        if (e.health <= 0) { e.dead = true; people.enemies.splice(people.enemies.indexOf(e), 1); scene.remove(e.mesh); }
      }
    }
  }
  if (input.clicked && !G.playerCar) {
    if (G.ammo > 0) {
      G.ammo--; audio.shot();
      const yaw = renderer.camYaw;
      let best = null, bd = 40;
      for (const e of [...people.enemies]) {
        const dx = e.x - G.player.x, dz = e.z - G.player.z;
        const d = Math.hypot(dx, dz);
        if (d > 40) continue;
        const ang = Math.atan2(dx, dz);
        let diff = ang - yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < 0.18 && d < bd) { bd = d; best = e; }
      }
      if (best) {
        best.health -= CFG.pistolDamage;
        if (best.health <= 0) { best.dead = true; people.enemies.splice(people.enemies.indexOf(best), 1); scene.remove(best.mesh); }
      }
      G.addWanted(0); // firing a shot draws attention only when it hits a person
      if (best) G.addWanted(1);
    } else {
      G.announce('Out of ammo. Press R to reload.');
    }
  }
  if (input.wasPressed('KeyR')) { G.ammo = CFG.pistolAmmo; audio.click(); }
}
function handleKeys() {
  if (input.wasPressed('KeyM')) { const m = audio.toggleMute(); G.announce(m ? 'Muted.' : 'Sound on.'); }
  if (G.screen !== 'play') return;
  if (input.wasPressed('KeyE')) {
    const m = missions.M;
    if (m.failed) { hud.show(hud.els.fail, false); m.failed = null; missions.start(); return; }
    if (!m.active && m.index < 4 && G.marker && Math.hypot(G.player.x - G.marker.x, G.player.z - G.marker.z) < 7) {
      missions.start(); return;
    }
    if (G.playerCar) { if (Math.abs(G.playerCar.speed) < 1) exitCar(); return; }
    const v = vehicles.nearestCar(G.player.x, G.player.z, 4.5);
    if (v) enterCar(v);
  }
}
function step(dt) {
  G.time += dt;
  if (G.msgT > 0) { G.msgT -= dt; if (G.msgT <= 0) G.message = ''; }
  // Pause toggle runs before the screen gate, or P could never unpause the game.
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    if (G.screen === 'play') { G.screen = 'paused'; hud.show(hud.els.pause, true); }
    else if (G.screen === 'paused') { G.screen = 'play'; hud.show(hud.els.pause, false); }
  }
  world.update(dt, G.time);
  if (G.screen === 'title') {
    vehicles.update(dt);
    people.update(dt);
    hud.update(); hud.drawMinimap();
    return;
  }
  if (G.screen !== 'play') return;
  handleKeys();
  if (G.playerCar) driveCar(dt); else { walk(dt); combat(); }
  missions.update(dt);
  vehicles.update(dt);
  people.update(dt);
  // Wanted decay and bust.
  G.timeSinceCrime += dt;
  if (G.wanted > 0 && G.timeSinceCrime > CFG.wantedDecayIdle) {
    G.wantedIdle += dt;
    if (G.wantedIdle >= CFG.wantedDecayStep) { G.wanted--; G.wantedIdle = 0; }
  }
  if (G.bustMeter >= CFG.bustTime) G.busted();
  const m = missions.M;
  if (m.failed) hud.show(hud.els.fail, true);
  if (m.completed) hud.show(hud.els.complete, true);
  hud.update(); hud.drawMinimap();
}
G.step = step;
G.fastForward = (sec) => {
  const n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) step(STEP);
};
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min((now - last) / 1000, 0.25);
  last = now;
  while (acc >= STEP) { step(STEP); acc -= STEP; }
  renderer.update(G, Math.min(0.05, (now - last) / 1000 || STEP), input);
  renderer.render(scene);
  input.endFrame();
}
function boot() {
  const save = readSave();
  hud.showTitle(true, !!save);
  hud.update();
  if (shotName) {
    stageShot(shotName, G);
    if (shotName === 'end') {
      hud.showTitle(true, false);
      document.getElementById('hud').style.display = 'none';
    } else {
      hud.showTitle(false);
    }
    hud.update(); hud.drawMinimap();
    let painted = 0;
    const paint = () => {
      step(STEP);
      renderer.update(G, STEP, input);
      renderer.render(scene);
      painted++;
      if (painted < 3) requestAnimationFrame(paint);
      else window.__shotReady = true;
    };
    requestAnimationFrame(paint);
  } else {
    requestAnimationFrame(frame);
  }
  window.__ready = true;
}
window.__game = G;
window.__scene = scene;
window.__renderer = renderer;
window.__input = input;
window.addEventListener('error', (e) => { window.__pageError = String(e.message); });
boot();
