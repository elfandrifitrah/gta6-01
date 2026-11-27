// Missions: the four-job story state machine. Written in this session.
import * as THREE from 'three';
import { CFG, CHECKPOINTS_M3 } from './config.js';
import { mulberry32 } from './random.js';
import { audio } from './audio.js';

export function createMissions(scene, G, deps) {
  const { vehicles, people } = deps;
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 14, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  beam.position.y = 7; beacon.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.25, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd54f }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; beacon.add(ring);
  beacon.visible = false; scene.add(beacon);
  let itemMesh = null;
  let gtCar = null;
  let passenger = null;
  let passengerRode = false;
  let passengerStand = null;
  const cards = [
    ['Macet Total', 'Drive Pak Haji to the port'],
    ['Kopor Hilang', 'Drop the rivals, then the briefcase'],
    ['Balap Liar', 'Steal the yellow Garuda GT'],
    ['Jebakan di Pelabuhan', 'Survive the ambush, then get home'],
  ];
  function dropPassenger() {
    passengerRode = false;
    passengerStand = null;
    if (!passenger) return;
    scene.remove(passenger);
    passenger = null;
  }
  function seatPassenger() {
    if (passenger) return;
    passenger = people.makePersonMesh({ rng: mulberry32(7), shirt: 0xf7f3ea, legs: 0x1a237e });
    scene.add(passenger);
  }
  function placePassenger() {
    if (!passenger) return;
    const v = G.playerCar;
    if (v) {
      passengerRode = true;
      const lx = -0.62, lz = 0.15;
      const s = Math.sin(v.angle), c = Math.cos(v.angle);
      passenger.position.set(v.x + lx * c + lz * s, 0.95, v.z - lx * s + lz * c);
      passenger.rotation.y = v.angle;
      passengerStand = { x: v.x + 2.4, z: v.z + 1.2 };
    } else if (!passengerRode) {
      const h = CFG.places.hotel;
      passenger.position.set(h[0] + 5, 0, h[1] - 7);
      passenger.rotation.y = Math.PI;
    } else if (passengerStand) {
      passenger.position.set(passengerStand.x, 0, passengerStand.z);
    }
  }
  const M = {
    index: 0, // next mission, 0..3; 4 means story done
    active: false,
    stage: 'idle',
    timer: 0,
    cp: 0,
    target: null,
    label: '',
    failed: null,
    completed: false,
  };
  function setTarget(x, z, label) {
    M.target = [x, z]; M.label = label;
    beacon.position.set(x, 0, z); beacon.visible = true;
    G.marker = { x, z, label };
  }
  function clearTarget() { M.target = null; beacon.visible = false; G.marker = null; }
  function placeItem(x, z, color) {
    removeItem();
    itemMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.7), new THREE.MeshLambertMaterial({ color }));
    itemMesh.position.set(x, 0.6, z); scene.add(itemMesh);
  }
  function removeItem() { if (itemMesh) { scene.remove(itemMesh); itemMesh = null; } }
  function cleanup() {
    people.clearEnemies();
    removeItem();
    dropPassenger();
    if (gtCar) { vehicles.removeVehicle(gtCar); gtCar = null; }
    clearTarget();
  }
  function startPlace() {
    const p = CFG.places;
    return [p.hotel, p.warehouse, p.hotel, p.port][M.index];
  }
  function start() {
    if (M.active || M.index >= 4) return false;
    M.active = true; M.failed = null;
    if (G.cardShow) G.cardShow(cards[M.index][0], cards[M.index][1]);
    const p = CFG.places;
    if (M.index === 0) {
      M.stage = 'drive'; M.timer = CFG.missionTime1;
      seatPassenger();
      placePassenger();
      setTarget(p.port[0], p.port[1], 'Port: deliver Pak Haji');
      G.announce('Macet Total: drive Pak Haji to the port. 150 seconds.');
    } else if (M.index === 1) {
      M.stage = 'fight';
      for (let i = 0; i < 3; i++) people.spawnEnemy(p.warehouse[0] + (i - 1) * 4, p.warehouse[1] + 3, 'rival');
      setTarget(p.warehouse[0], p.warehouse[1], 'Warehouse Yard: defeat the rivals');
      G.announce('Kopor Hilang: defeat the three rivals at the warehouse yard.');
    } else if (M.index === 2) {
      M.stage = 'steal';
      gtCar = vehicles.spawnMissionCar(p.hotel[0] + 6, p.hotel[1] + 6, 0xffd600, 'sport');
      gtCar.health = 100;
      setTarget(p.hotel[0] + 6, p.hotel[1] + 6, 'Hotel Merdeka: steal the yellow Garuda GT');
      G.announce('Balap Liar: steal the yellow Garuda GT coupe at the hotel.');
    } else {
      M.stage = 'wave1';
      for (let i = 0; i < 3; i++) people.spawnEnemy(p.port[0] + (i - 1) * 5, p.port[1] + 8, 'ambusher');
      setTarget(p.port[0], p.port[1], 'Port: survive the ambush');
      G.announce('Jebakan di Pelabuhan: survive the ambush at the port.');
    }
    return true;
  }
  function complete() {
    const pay = M.index === 2 && gtCar && gtCar.health < 50 ? 750 : CFG.pays[M.index];
    const name = CFG.missions[M.index].name;
    cleanup();
    G.cash += pay;
    if (G.cardShow) G.cardShow(name + ' complete', 'Paid $' + pay);
    M.index++;
    M.active = false; M.stage = 'idle';
    audio.cash();
    G.announce(name + ' complete. Paid $' + pay + '.');
    G.saveGame();
    if (M.index >= 4) {
      M.completed = true;
      G.announce('Debt cleared. Bimo is free. Story complete.');
    } else {
      const next = CFG.missions[M.index];
      setTarget(startPlace()[0], startPlace()[1], next.start + ': ' + next.name + ' (press E)');
      G.announce('Next job: ' + next.name + ' at ' + next.start + '.');
    }
  }
  function fail(reason) {
    if (!M.active) return;
    cleanup();
    M.active = false; M.stage = 'idle'; M.failed = reason;
    audio.fail();
    G.announce('Mission failed: ' + reason + '. Press E to retry.');
    const sp = startPlace();
    setTarget(sp[0], sp[1], CFG.missions[M.index].start + ': ' + CFG.missions[M.index].name + ' (press E)');
  }
  function near(x, z, r) {
    const p = G.player;
    return Math.hypot(p.x - x, p.z - z) < r;
  }
  function update(dt) {
    if (!M.active) return;
    const p = CFG.places;
    if (M.index === 0) {
      placePassenger();
      M.timer -= dt;
      if (M.timer <= 0) { fail('timeout'); return; }
      if (G.playerCar && near(p.port[0], p.port[1], 9)) { complete(); return; }
      if (G.playerCar && G.playerCar.health !== undefined && G.playerCar.health <= 0) { fail('mission car wrecked'); return; }
    } else if (M.index === 1) {
      if (M.stage === 'fight') {
        if (people.enemies.length === 0) {
          M.stage = 'take';
          placeItem(p.warehouse[0], p.warehouse[1], 0x8d6e63);
          setTarget(p.warehouse[0], p.warehouse[1], 'Take the briefcase');
        }
      } else if (M.stage === 'take') {
        if (near(p.warehouse[0], p.warehouse[1], 2.5)) {
          removeItem(); M.stage = 'deliver';
          setTarget(p.bengkel[0], p.bengkel[1], 'Bengkel Sumber Jaya: deliver the briefcase');
          G.announce('Briefcase taken. Bring it to Bengkel Sumber Jaya.');
        }
      } else if (M.stage === 'deliver') {
        if (near(p.bengkel[0], p.bengkel[1], 7)) complete();
      }
    } else if (M.index === 2) {
      if (M.stage === 'steal') {
        if (G.playerCar === gtCar) {
          M.stage = 'checkpoints'; M.cp = 0;
          setTarget(CHECKPOINTS_M3[0][0], CHECKPOINTS_M3[0][1], 'Checkpoint 1 of 3');
          G.announce('GT stolen. Hit all 3 checkpoints, then reach the chop shop.');
        }
      } else if (M.stage === 'checkpoints') {
        const cp = CHECKPOINTS_M3[M.cp];
        if (G.playerCar === gtCar && near(cp[0], cp[1], 10)) {
          M.cp++;
          audio.cash();
          if (M.cp >= 3) {
            M.stage = 'deliver';
            setTarget(p.chopShop[0], p.chopShop[1], 'Chop shop: deliver the GT');
          } else {
            setTarget(CHECKPOINTS_M3[M.cp][0], CHECKPOINTS_M3[M.cp][1], 'Checkpoint ' + (M.cp + 1) + ' of 3');
          }
        }
        if (gtCar && gtCar.health <= 0) { fail('mission car wrecked'); return; }
      } else if (M.stage === 'deliver') {
        if (G.playerCar === gtCar && near(p.chopShop[0], p.chopShop[1], 9)) complete();
        if (gtCar && gtCar.health <= 0) { fail('mission car wrecked'); return; }
      }
    } else if (M.index === 3) {
      if (M.stage === 'wave1') {
        if (people.enemies.length === 0) {
          M.stage = 'wave2';
          for (let i = 0; i < 4; i++) people.spawnEnemy(p.port[0] + (i - 2) * 4, p.port[1] + 10, 'ambusher');
          G.announce('Second wave. Four more ambushers.');
        }
      } else if (M.stage === 'wave2') {
        if (people.enemies.length === 0) {
          M.stage = 'take';
          placeItem(p.port[0], p.port[1] + 4, 0x2e7d32);
          setTarget(p.port[0], p.port[1] + 4, 'Take the money bag');
        }
      } else if (M.stage === 'take') {
        if (near(p.port[0], p.port[1] + 4, 2.5)) {
          removeItem(); M.stage = 'deliver';
          setTarget(p.home[0], p.home[1], 'Home: bring the money bag');
          G.announce('Money bag taken. Bring it home.');
        }
      } else if (M.stage === 'deliver') {
        if (near(p.home[0], p.home[1], 7)) complete();
      }
    }
  }
  // Idle marker: point at the next job start.
  function idleMarker() {
    if (M.active || M.index >= 4) return;
    const sp = startPlace();
    setTarget(sp[0], sp[1], CFG.missions[M.index].start + ': ' + CFG.missions[M.index].name + ' (press E)');
  }
  return { M, start, fail, complete, update, cleanup, idleMarker, get gtCar() { return gtCar; }, setGtCar(v) { gtCar = v; } };
}
