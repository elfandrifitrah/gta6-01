// Jakarta Heat: the game loop. Boots the renderer, builds the city, wires
// the player, traffic, buses, police, missions and HUD together, and runs
// the wanted system, car stealing, combat, bust/waste and save/load. The
// loop runs on a fixed 60 Hz step; rendering happens once per animation
// frame. A debug handle (window.__pv) and a shot-staging hook (?shot=name)
// support headless verification and screenshot capture.
//
// Import order is deliberate: the dossier lists sources in import order, so
// the systems that prove completeness (missions, HUD, people, vehicles)
// come before the world builder, whose work the screenshots show.
import * as THREE from 'three';
import { BIKE_COUNT, BUS_COUNT, BUST_PENALTY, DEBT_TOTAL, DRIVING, PARKED_COUNT, PED_COUNT, PLACES, PLAYER_START, SEED_DEFAULT, START_CASH, TRAFFIC_COUNT, WANTED, WASTE_PENALTY } from './config.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { CameraRig, Particles, createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { BusManager, Car, PoliceManager, TrafficManager, makeBajajModel, makeBikeModel, makeCarModel, resolveCarPair } from './vehicles.js';
import { PeopleManager, PlayerCharacter, makePersonModel } from './people.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { clearSave, hasSave, loadGame, saveGame } from './save.js';
import { makeRng } from './random.js';
import { createWorld } from './world.js';

const STEP = 1 / 60;

function starsFor(heat) {
  let stars = 0;
  for (const threshold of WANTED.starAt) {
    if (heat >= threshold) stars += 1;
  }
  return stars;
}

class Game {
  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.shotName = params.get('shot');
    this.seed = Number(params.get('seed')) || SEED_DEFAULT;
    this.rng = makeRng(this.seed);
    this.canvas = document.getElementById('game-canvas');
    const { renderer } = createRenderer(this.canvas);
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
    this.input = new Input(this.canvas);
    this.audio = new AudioSys();
    this.hud = new HUD(document);
    this.particles = new Particles(this.scene);
    this.cameraRig = new CameraRig(this.camera);

    // The world needs the vehicle and person factories for its set dressing:
    // parked bikes at ojek stands, bajaj at their stand, cars on the toll
    // road and the flyover. They arrive as a plain object, no import cycle.
    this.world = createWorld(this.scene, this.seed, { makeCarModel, makeBikeModel, makeBajajModel, makePersonModel });
    this.player = new PlayerCharacter(this.scene, PLAYER_START);
    this.player.inCar = false;
    this.player.car = null;
    this.people = new PeopleManager(this.scene, this.world, this.rng, PED_COUNT);
    this.traffic = new TrafficManager(this.scene, this.world, this.rng, TRAFFIC_COUNT, BIKE_COUNT);
    this.buses = new BusManager(this.scene, this.world, this.rng, BUS_COUNT);
    this.police = new PoliceManager(this.scene, this.world, this.rng);
    this.parkedCars = [];
    this.extraCars = [];
    this.spawnParkedCars();

    this.cash = START_CASH;
    this.earned = 0;
    this.heat = 0;
    this.lastCrimeT = -100;
    this.evadeT = 0;
    this.bustT = 0;
    this.time = 0;
    this.screen = 'title';
    this.endKind = 'wasted';
    this.prevX = this.player.x;
    this.prevZ = this.player.z;
    this.velX = 0;
    this.velZ = 0;
    this.exhaustT = 0;
    this.screechT = 0;
    this.shotCamera = null;
    this.shotFrames = 0;
    this.titleAngle = 0;
    this.acc = 0;
    this.lastNow = 0;

    this.hooks = this.buildHooks();
    const gameCtx = {
      scene: this.scene,
      player: this.player,
      people: this.people,
      addCar: (car) => this.addCar(car),
      removeCar: (car) => this.removeCar(car),
      hooks: this.hooks,
      setHeat: (v) => this.setHeat(v),
      addCash: (v) => this.addCash(v),
    };
    this.missions = new MissionManager(this.scene, gameCtx);
    this.hud.bindButtons({
      start: () => this.startGame(false),
      continue: () => this.startGame(true),
      resume: () => this.resume(),
      save: () => this.saveNow(false),
      restart: () => { clearSave(); window.location.reload(); },
      endOk: () => this.respawnAfterEnd(),
      mute: () => this.toggleMute(),
    });
    this.hud.setContinueAvailable(hasSave(), 'Continue');
    this.hud.setMuted(false);
    this.hud.showScreen('title');
    this.cameraRig.snapTo({ x: 0, y: 6, z: 0 }, Math.PI);
  }

  spawnParkedCars() {
    const spots = [
      { x: -96, z: 82, heading: Math.PI / 2, kind: 'sedan', color: 0x2e5f8a },
      { x: 96, z: -84, heading: -Math.PI / 2, kind: 'suv', color: 0xe8e8e8 },
      { x: 88, z: -92, heading: 0, kind: 'mpv', color: 0x333a42 },
      { x: 96, z: 112, heading: Math.PI, kind: 'pickup', color: 0x8a2f3d },
      { x: -112, z: -92, heading: Math.PI / 2, kind: 'van', color: 0xd8d8d8 },
      { x: 116, z: 140, heading: 0, kind: 'sedan', color: 0xd9a441 },
    ];
    for (let i = 0; i < Math.min(PARKED_COUNT, spots.length); i += 1) {
      const s = spots[i];
      const car = new Car(this.scene, { x: s.x, z: s.z, heading: s.heading, kind: s.kind, color: s.color, driver: null });
      this.parkedCars.push(car);
    }
  }

  addCar(car) {
    this.extraCars.push(car);
  }

  removeCar(car) {
    const i = this.extraCars.indexOf(car);
    if (i >= 0) this.extraCars.splice(i, 1);
    car.dispose(this.scene);
  }

  allCars() {
    const list = [...this.parkedCars, ...this.extraCars, ...this.traffic.cars, ...this.traffic.bikes, ...this.police.cars, ...this.buses.buses];
    if (this.player.car && !list.includes(this.player.car)) list.push(this.player.car);
    return list;
  }

  buildHooks() {
    const game = this;
    return {
      message(text, seconds) { game.hud.message(text, seconds); },
      banner(title, sub) { game.hud.banner(title, sub); },
      sting(good) { game.audio.sting(good); },
      pickup() { game.audio.pickup(); },
      crash(strength, x, z) {
        game.audio.crash(strength / 30);
        game.particles.sparks(x, 0.8, z);
        game.cameraRig.shake(Math.min(0.7, strength / 40));
      },
      smoke(x, y, z, strength) { game.particles.smoke(x, y, z, strength); },
      wrecked(car) {
        game.particles.smoke(car.x, 1.2, car.z, 2.5);
        game.audio.crash(0.8);
      },
      carHit(a, b, relSpeed) {
        if (a === game.player.car || b === game.player.car) {
          game.cameraRig.shake(Math.min(0.6, relSpeed / 40));
          const other = a === game.player.car ? b : a;
          if (relSpeed > 6) {
            game.hud.damageFlash();
            if (other.police) game.addHeat(WANTED.hitCop);
          }
        }
      },
      shotFired(origin, end, hitSomeone) {
        const dir = { x: end.x - origin.x, y: end.y - origin.y, z: end.z - origin.z };
        const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
        game.particles.muzzle(origin.x, origin.y, origin.z, { x: dir.x / len, y: dir.y / len, z: dir.z / len });
        game.particles.tracer(origin, end);
        game.audio.shot();
        game.addHeat(WANTED.shot);
        game.people.scareNearby(origin.x, origin.z, 24);
        if (hitSomeone) game.particles.bloodPuff(end.x, end.y, end.z);
      },
      enemyShot(origin, end) {
        const dir = { x: end.x - origin.x, y: end.y - origin.y, z: end.z - origin.z };
        const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
        game.particles.muzzle(origin.x, origin.y, origin.z, { x: dir.x / len, y: dir.y / len, z: dir.z / len });
        game.particles.tracer(origin, end);
        game.audio.shot();
      },
      enemyHitPlayer(amount) {
        game.player.damage(amount, game.hooks);
        game.hud.damageFlash();
      },
      punchSwung() { game.audio.punch(); },
      punchHit() { game.cameraRig.shake(0.15); },
      pedDown(ped, killed) {
        game.addHeat(killed ? WANTED.killPed : WANTED.hitPed);
        game.particles.bloodPuff(ped.x, 1, ped.z);
        game.people.scareNearby(ped.x, ped.z, 20);
      },
      enemyDown() { game.audio.pickup(); },
      playerHurt() { game.hud.damageFlash(); },
      playerDown() { game.onPlayerDown(); },
      reloaded() { game.audio.click(); },
      reloadStart() { game.audio.click(); },
      missionComplete() { game.saveNow(true); },
      missionFailed() { /* the banner says it all */ },
    };
  }

  get stars() {
    return starsFor(this.heat);
  }

  setHeat(value) {
    this.heat = Math.max(this.heat, Math.min(100, value));
    this.lastCrimeT = this.time;
    this.evadeT = 0;
  }

  addHeat(value) {
    this.heat = Math.min(100, this.heat + value);
    this.lastCrimeT = this.time;
    this.evadeT = 0;
  }

  addCash(value) {
    this.cash += value;
    this.earned += value;
  }

  get debt() {
    return Math.max(0, DEBT_TOTAL - this.earned);
  }

  startGame(useSave) {
    this.audio.init();
    this.audio.click();
    if (useSave) {
      const data = loadGame();
      if (data) {
        this.cash = data.cash;
        this.earned = data.earned;
        this.missions.applySave(data.missionsDone, data.storyComplete);
        this.player.revive(data.player.x, data.player.z, data.player.heading);
        this.player.health = data.player.health;
        this.hud.message('Save loaded. Welcome back to Jakarta.', 4);
      }
    }
    this.screen = 'play';
    this.hud.showScreen('play');
    this.cameraRig.snapTo({ x: this.player.x, y: 1.6, z: this.player.z }, this.player.heading);
    if (!useSave) this.hud.message('Bu Ratna needs you at the bengkel. Follow the blue beacon.', 6);
  }

  resume() {
    this.screen = 'play';
    this.hud.showScreen('play');
    this.audio.click();
  }

  pause() {
    if (this.screen !== 'play') return;
    this.screen = 'pause';
    this.hud.showScreen('pause');
  }

  toggleMute() {
    const muted = this.audio.toggleMute();
    this.hud.setMuted(muted);
  }

  saveNow(silent) {
    const ok = saveGame({
      cash: this.cash,
      earned: this.earned,
      missionsDone: this.missions.done,
      storyComplete: this.missions.storyComplete,
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading, health: this.player.health },
    });
    if (!silent) this.hud.message(ok ? 'Game saved.' : 'Save failed: storage is unavailable.', 3);
    return ok;
  }

  nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.allCars()) {
      if (car.wrecked || car.isBus) continue;
      const d = Math.hypot(car.x - this.player.x, car.z - this.player.z);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }

  enterCar(car) {
    this.player.car = car;
    this.player.inCar = true;
    this.player.setVisible(false);
    if (!car.owned && !car.heatGiven && (car.driver === 'traffic' || car.driver === null || car.driver === 'police')) {
      car.heatGiven = true;
      this.addHeat(WANTED.steal);
      this.hud.message(car.driver === 'police' ? 'You stole a police car. That will not go unnoticed.' : 'You stole the car. The owner called it in.', 4);
    }
    if (car.driver === 'traffic' || car.driver === 'police') car.driver = null;
    car.owned = true;
    this.cameraRig.snapTo({ x: car.x, y: 1.8, z: car.z }, car.heading);
    this.audio.click();
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.speed = 0;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    const spot = this.world.collideCircle(car.x + side.x * 2.6, car.z + side.z * 2.6, this.player.radius);
    this.player.x = spot.x;
    this.player.z = spot.z;
    this.player.heading = car.heading;
    this.player.inCar = false;
    this.player.car = null;
    this.player.setVisible(true);
    this.player.syncMesh();
    this.cameraRig.snapTo({ x: this.player.x, y: 1.6, z: this.player.z }, this.player.heading);
  }

  teleportPlayer(x, z, heading) {
    if (this.player.inCar) this.exitCar();
    this.player.x = x;
    this.player.z = z;
    if (heading !== undefined) this.player.heading = heading;
    this.player.syncMesh();
    this.cameraRig.snapTo({ x, y: 1.6, z }, this.player.heading);
  }

  onPlayerDown() {
    this.missions.onPlayerDown('Bimo is down. The job is off.');
    this.endKind = 'wasted';
    this.screen = 'end';
    this.hud.showEnd('WASTED', 'The hospital patched you up. The bill cost 15% of your cash.');
    this.audio.sting(false);
  }

  onBusted() {
    this.missions.onPlayerDown('Busted. The job is off.');
    this.endKind = 'busted';
    this.screen = 'end';
    this.hud.showEnd('BUSTED', 'The police took 15% of your cash and dropped you at the station.');
    this.audio.sting(false);
    if (this.player.inCar) {
      this.player.car.speed = 0;
      this.player.inCar = false;
      this.player.car = null;
      this.player.setVisible(true);
    }
  }

  respawnAfterEnd() {
    const penalty = Math.round(this.cash * (this.endKind === 'busted' ? BUST_PENALTY : WASTE_PENALTY));
    this.cash = Math.max(0, this.cash - penalty);
    this.heat = 0;
    this.evadeT = 0;
    this.bustT = 0;
    const spot = this.endKind === 'busted' ? PLACES.police : PLACES.hospital;
    this.player.revive(spot.x, spot.z, Math.PI);
    this.screen = 'play';
    this.hud.showScreen('play');
    this.cameraRig.snapTo({ x: spot.x, y: 1.6, z: spot.z }, Math.PI);
    this.audio.click();
  }

  update(dt) {
    this.time += dt;
    const input = this.input;
    const player = this.player;

    if (input.pressed('KeyP') || input.pressed('Escape')) {
      if (this.screen === 'play') this.pause();
      else if (this.screen === 'pause') this.resume();
    }
    if (input.pressed('KeyM')) this.toggleMute();
    if (this.screen !== 'play') {
      if (this.screen === 'title') this.updateAmbient(dt);
      return;
    }

    // Wanted decay and evasion.
    if (this.heat > 0 && this.time - this.lastCrimeT > WANTED.decayDelay) {
      this.heat = Math.max(0, this.heat - WANTED.decayRate * dt);
    }
    const nearestPolice = this.police.nearestDist(player);
    if (this.stars > 0 && nearestPolice > WANTED.evadeRadius) {
      this.evadeT += dt;
      if (this.evadeT > WANTED.evadeTime) {
        this.heat = 0;
        this.evadeT = 0;
        this.hud.message('You lost them. The heat is off.', 4);
      }
    } else {
      this.evadeT = 0;
    }

    // Interact: mission start, car enter/exit.
    if (input.pressed('KeyE')) {
      if (this.missions.nearStartMarker(player)) {
        this.missions.startAvailable();
      } else if (player.inCar) {
        this.exitCar();
      } else {
        const car = this.nearestCar(DRIVING.enterRange);
        if (car) this.enterCar(car);
      }
    }

    if (player.inCar && player.car) {
      this.updateDriving(dt, input);
    } else {
      this.updateOnFoot(dt, input);
    }

    // Velocity tracking for the police pursuit lead.
    this.velX = (player.x - this.prevX) / dt;
    this.velZ = (player.z - this.prevZ) / dt;
    this.prevX = player.x;
    this.prevZ = player.z;

    const cars = this.allCars();
    this.traffic.update(dt, player, cars, this.hooks);
    this.buses.update(dt, player.car, this.hooks);
    this.police.update(dt, player, { x: this.velX, z: this.velZ }, this.stars, WANTED.policeByStar, this.hooks);
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        resolveCarPair(cars[i], cars[j], this.hooks);
      }
    }
    this.checkPedCollisions();
    this.people.update(dt, player, this.hooks);
    this.missions.update(dt, this);
    this.world.update(dt, this.time, { x: player.x, z: player.z });
    this.particles.update(dt);
    this.audio.setEngine(player.inCar, player.inCar ? Math.abs(player.car.speed) / DRIVING.maxSpeed : 0);
    this.audio.setSiren(this.stars);

    // Busted check: police close and the player pinned down. The timer
    // decays instead of resetting, so a circling patrol car still corners
    // a player who stays put.
    if (this.stars > 0 && !player.dead) {
      const pinned = player.inCar ? Math.abs(player.car.speed) < 2 : Math.abs(player.speed) < 0.5;
      const range = player.inCar ? WANTED.bustCarRange : WANTED.bustFootRange;
      const limit = player.inCar ? WANTED.bustCarTime : WANTED.bustFootTime;
      if (nearestPolice < range && pinned) {
        this.bustT += dt;
        if (this.bustT > limit) this.onBusted();
      } else {
        this.bustT = Math.max(0, this.bustT - dt * 0.5);
      }
    }

    // Prompts.
    if (this.missions.nearStartMarker(player)) {
      this.hud.prompt(`Press E to start the job: ${this.missions.currentDef.name}`);
    } else if (player.inCar) {
      this.hud.prompt('Press E to get out — Space is the handbrake');
    } else {
      const car = this.nearestCar(DRIVING.enterRange);
      this.hud.prompt(car ? 'Press E to get in the car' : null);
    }

    const tracker = this.missions.tracker();
    this.hud.update(dt, {
      health: player.health,
      cash: this.cash,
      debt: this.debt,
      stars: this.stars,
      ammo: player.ammo,
      reloading: player.reloadTimer > 0,
      inCar: player.inCar,
      speed: player.inCar ? player.car.speed : 0,
      playing: true,
      tracker,
      objective: this.missions.objectivePoint(),
      police: this.police.cars.filter((c) => !c.wrecked).map((c) => ({ x: c.x, z: c.z })),
      enemies: this.people.aliveEnemies().map((e) => ({ x: e.x, z: e.z })),
      playerX: player.x,
      playerZ: player.z,
      heading: player.inCar ? player.car.heading : player.heading,
    });
  }

  updateDriving(dt, input) {
    const player = this.player;
    const car = player.car;
    const axis = input.axis();
    const handbrake = input.down('Space');
    car.drive(dt, { throttle: axis.y, steer: -axis.x, handbrake }, this.world, this.hooks);
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    this.exhaustT += dt;
    if (this.exhaustT > 0.09 && Math.abs(car.speed) > 2) {
      this.exhaustT = 0;
      this.particles.exhaust(car.x, 0.4, car.z, car.heading);
    }
    if (handbrake && Math.abs(car.speed) > 6) {
      this.particles.dust(car.x - Math.sin(car.heading) * 1.6, 0.3, car.z - Math.cos(car.heading) * 1.6);
      this.screechT += dt;
      if (this.screechT > 0.7) {
        this.screechT = 0;
        this.audio.screech();
      }
    }
    this.updateCamera(dt, { x: car.x, y: 1.8, z: car.z }, car.heading, true, Math.abs(car.speed) / DRIVING.maxSpeed);
  }

  updateOnFoot(dt, input) {
    const player = this.player;
    const axis = input.axis();
    const aiming = input.mouseDown;
    player.aiming = aiming;
    // Movement is camera-relative: forward is where the camera looks.
    const yaw = this.cameraRig.yaw;
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    let mx = fwdX * axis.y + rightX * axis.x;
    let mz = fwdZ * axis.y + rightZ * axis.x;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const faceHeading = aiming ? yaw + Math.PI : null;
    player.update(dt, mx, mz, input.down('ShiftLeft') || input.down('ShiftRight'), faceHeading, this.world, this.hooks);
    if (input.pressed('KeyF')) {
      player.punch([...this.people.aliveEnemies(), ...this.people.peds], this.hooks);
    }
    if (input.pressed('KeyR')) player.startReload(this.hooks);
    if (aiming) {
      const origin = { x: player.x, y: 1.35, z: player.z };
      const dir = { x: Math.sin(player.heading), y: -0.02, z: Math.cos(player.heading) };
      player.shoot(origin, dir, [...this.people.aliveEnemies(), ...this.people.peds], this.hooks);
    }
    this.updateCamera(dt, { x: player.x, y: 1.6, z: player.z }, player.heading, false, 0);
  }

  updateCamera(dt, target, heading, driving, speedNorm) {
    if (this.shotCamera) {
      const sc = this.shotCamera;
      const pivot = new THREE.Vector3(sc.target.x, sc.target.y, sc.target.z);
      const off = new THREE.Vector3(
        Math.sin(sc.yaw) * Math.cos(sc.pitch),
        -Math.sin(sc.pitch),
        Math.cos(sc.yaw) * Math.cos(sc.pitch),
      ).multiplyScalar(sc.distance);
      this.camera.position.copy(pivot).add(off);
      this.camera.lookAt(pivot);
      return;
    }
    this.cameraRig.update(dt, target, heading, driving, speedNorm, this.input);
  }

  updateAmbient(dt) {
    // Behind the title screen the city stays alive: traffic flows, the
    // world animates, and the camera drifts gently west of the square,
    // looking east across the monument toward the skyscraper corridor.
    this.time += dt;
    this.titleAngle += dt * 0.05;
    const cars = this.allCars();
    const ghost = { x: 0, z: 0, inCar: true };
    this.traffic.update(dt, ghost, cars, this.hooks);
    this.buses.update(dt, null, this.hooks);
    this.people.update(dt, ghost, this.hooks);
    this.missions.update(dt, this);
    this.world.update(dt, this.time, { x: 0, z: 0 });
    this.particles.update(dt);
    const t = this.titleAngle;
    this.camera.position.set(-70 + Math.sin(t * 2) * 6, 34, Math.sin(t * 1.3) * 10);
    this.camera.lookAt(0, 16, 0);
  }

  checkPedCollisions() {
    const player = this.player;
    if (!player.inCar || !player.car) return;
    const car = player.car;
    if (Math.abs(car.speed) < 3) return;
    for (const ped of this.people.peds) {
      if (ped.dead || ped.downTimer > 0) continue;
      const d = Math.hypot(ped.x - car.x, ped.z - car.z);
      if (d < car.radius + 0.4) {
        ped.knockback = { x: (ped.x - car.x) / (d || 1), z: (ped.z - car.z) / (d || 1), force: 8 };
        ped.damage(Math.abs(car.speed) * 3.2, this.hooks);
        this.cameraRig.shake(0.25);
        this.audio.crash(0.4);
      }
    }
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const rawDt = Math.min(0.1, (now - (this.lastNow || now)) / 1000);
    this.lastNow = now;
    if (this.screen === 'pause') {
      this.input.endFrame();
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.acc += rawDt;
    let steps = 0;
    while (this.acc >= STEP && steps < 3) {
      this.update(STEP);
      this.acc -= STEP;
      steps += 1;
    }
    if (steps === 3) this.acc = 0;
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
    if (this.shotName && !window.__shotReady) {
      this.shotFrames += 1;
      if (this.shotFrames > 40) window.__shotReady = true;
    }
  }

  run() {
    // Debug handle for headless verification. Read-only state plus a few
    // helpers; the game itself never depends on it.
    const self = this;
    window.__pv = {
      game: self,
      player: self.player,
      missions: self.missions,
      traffic: self.traffic,
      police: self.police,
      buses: self.buses,
      people: self.people,
      world: self.world,
      hud: self.hud,
      input: self.input,
      get screen() { return self.screen; },
      get cash() { return self.cash; },
      get heat() { return self.heat; },
      get stars() { return self.stars; },
      setHeat: (v) => self.setHeat(v),
      addHeat: (v) => self.addHeat(v),
      teleport: (x, z, heading) => self.teleportPlayer(x, z, heading),
      startMission: () => self.missions.startAvailable(),
    };
    if (this.shotName) {
      // The title shot keeps the title screen up; every other shot starts
      // the game and stages a live scene.
      if (this.shotName !== 'title') this.startGame(false);
      stageShot(this, this.shotName);
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}

const game = new Game();
game.run();
