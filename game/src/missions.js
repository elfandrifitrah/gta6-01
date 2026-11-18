// The story: Bimo owes the fixer Bu Ratna $5,000, and four jobs pay it
// off. Each mission is a list of steps: go somewhere, take a car, beat the
// rivals, pick something up, deliver it, run by one small state machine.
// The manager owns the objective beacon, the mission spawns, the timers and
// the fail states; the game loop only calls update() and reads the tracker.
// Mission titles carry Indonesian flavour; every objective line is English.
import * as THREE from 'three';
import { PLACES } from './config.js';
import { Car } from './vehicles.js';
import { makePersonModel } from './people.js';

function makeBeacon(colorHex) {
  const group = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }),
  );
  pillar.position.y = 17;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: colorHex, fog: false }),
  );
  diamond.position.y = 4.5;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 2.9, 32),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.18;
  group.add(pillar, diamond, ring);
  group.visible = false;
  return { group, diamond, ring };
}

function makeBriefcase() {
  const group = new THREE.Group();
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.16), caseMat);
  body.position.y = 0.55;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.05, 0.17), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.6, roughness: 0.4 }));
  trim.position.y = 0.55;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.05), caseMat);
  handle.position.y = 0.78;
  group.add(body, trim, handle);
  return group;
}

function makeMoneyBag() {
  const group = new THREE.Group();
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshStandardMaterial({ color: 0xc9b083, roughness: 0.9 }));
  sack.scale.set(1, 0.85, 1);
  sack.position.y = 0.4;
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0x8a6f4a, roughness: 0.9 }));
  tie.position.y = 0.82;
  group.add(sack, tie);
  return group;
}

export const MISSIONS = [
  {
    id: 'macet',
    name: 'Macet Total',
    reward: 800,
    briefing: 'Bu Ratna: Bimo, macet total out there and my client cannot wait. Take the MPV, pick up Pak Haji at Hotel Merdeka, and get him to the port. Smooth, cepat, no scratches. $800.',
  },
  {
    id: 'kopor',
    name: 'Kopor Hilang',
    reward: 1200,
    briefing: 'Bu Ratna: The Kalongs lifted a briefcase of mine. It sits in their warehouse yard, east side. Take it back. Expect company. $1,200.',
  },
  {
    id: 'balap',
    name: 'Balap Liar',
    reward: 1500,
    briefing: 'Bu Ratna: A client wants a Garuda GT, no questions. There is a yellow one parked at the hotel. Bring it to the chop shop through my checkpoints, so I know it is clean. $1,500.',
  },
  {
    id: 'jebakan',
    name: 'Jebakan di Pelabuhan',
    reward: 1500,
    briefing: 'Bu Ratna: Last job, Bimo. Meet my buyer at the port. It is a setup: the Kalongs want the money and you. Take the bag anyway and bring it home. $1,500, and we are square.',
  },
];

export class MissionManager {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game; // duck-typed: player, people, addCar, removeCar, hooks, setHeat, addCash
    this.done = [];
    this.active = null;
    this.available = 0;
    this.storyComplete = false;
    this.beacon = makeBeacon(0xf2c94c);
    scene.add(this.beacon.group);
    this.startBeacon = makeBeacon(0x7fd4f2);
    scene.add(this.startBeacon.group);
    this.startBeacon.group.position.set(PLACES.bengkel.x, 0, PLACES.bengkel.z);
    this.time = 0;
  }

  get currentDef() {
    return this.available < MISSIONS.length ? MISSIONS[this.available] : null;
  }

  tracker() {
    if (this.active) {
      return {
        title: this.active.def.name,
        objective: this.active.stepLabel,
        timer: this.active.timer > 0 ? this.active.timer : null,
        reward: this.active.def.reward,
      };
    }
    if (this.currentDef) {
      return { title: 'Free roam', objective: `Next job: ${this.currentDef.name} — go to Bengkel Sumber Jaya`, timer: null, reward: 0 };
    }
    return { title: 'Story complete', objective: 'The debt is paid. Jakarta is yours — drive, explore, cause trouble.', timer: null, reward: 0 };
  }

  objectivePoint() {
    if (this.active && this.active.point) return this.active.point;
    if (!this.active && this.currentDef) return { x: PLACES.bengkel.x, z: PLACES.bengkel.z };
    return null;
  }

  startAvailable() {
    if (this.active || !this.currentDef) return false;
    const def = this.currentDef;
    const g = this.game;
    const runtime = {
      def,
      stepIndex: -1,
      stepLabel: '',
      point: null,
      timer: 0,
      timerRunning: false,
      cars: [],
      items: [],
      passenger: null,
      checkpointIndex: 0,
      wave: 0,
      payCut: false,
    };
    this.active = runtime;
    g.hooks.message(def.briefing, 7);
    g.hooks.sting(true);
    this.advance();
    return true;
  }

  advance() {
    const rt = this.active;
    const g = this.game;
    rt.stepIndex += 1;
    const steps = this.stepsFor(rt.def.id, rt);
    rt.steps = steps;
    if (rt.stepIndex >= steps.length) {
      this.complete();
      return;
    }
    const step = steps[rt.stepIndex];
    rt.step = step;
    rt.stepLabel = step.label;
    rt.point = step.point || null;
    if (step.enter) step.enter(rt, g);
  }

  stepsFor(id, rt) {
    if (id === 'macet') {
      return [
        {
          label: "Get in Bu Ratna's MPV",
          point: { x: -104, z: 80 },
          enter(r, game) {
            const car = new Car(game.scene, { x: -104, z: 80, heading: Math.PI, color: 0xd8d8d8, kind: 'mpv', driver: null, owned: true });
            game.addCar(car);
            r.cars.push(car);
            r.missionCar = car;
          },
          done(r, game) { return game.player.inCar && game.player.car === r.missionCar; },
        },
        {
          label: 'Pick up Pak Haji at Hotel Merdeka',
          point: { x: PLACES.hotel.x, z: PLACES.hotel.z },
          done(r, game) {
            const p = game.player;
            return p.inCar && Math.hypot(p.x - PLACES.hotel.x, p.z - PLACES.hotel.z) < 9 && Math.abs(p.car.speed) < 2;
          },
          onDone(r, game) {
            const model = makePersonModel({ shirt: 0xf0f0ea, pants: 0x2e3a4d, skin: 0xc98d5f, hat: 'cap', hatColor: 0xf0f0ea });
            model.group.position.set(0.5, 0.35, 0.1);
            model.group.scale.setScalar(0.92);
            model.parts.legL.visible = false;
            model.parts.legR.visible = false;
            r.missionCar.group.add(model.group);
            r.passenger = model;
            game.hooks.message('Pak Haji: The port, please. And do hurry — my boat leaves soon.', 5);
            r.timer = 150;
            r.timerRunning = true;
          },
        },
        {
          label: 'Deliver Pak Haji to the port',
          point: { x: PLACES.port.x, z: PLACES.port.z },
          done(r, game) {
            const p = game.player;
            return p.inCar && Math.hypot(p.x - PLACES.port.x, p.z - PLACES.port.z) < 10 && Math.abs(p.car.speed) < 2;
          },
          onDone(r, game) {
            if (r.passenger) {
              r.missionCar.group.remove(r.passenger.group);
              r.passenger = null;
            }
            game.hooks.message('Pak Haji: Excellent driving. Bu Ratna chooses her people well.', 4);
          },
        },
      ];
    }
    if (id === 'kopor') {
      return [
        {
          label: 'Go to the warehouse yard',
          point: { x: PLACES.gudang.x, z: PLACES.gudang.z },
          done(r, game) { return Math.hypot(game.player.x - PLACES.gudang.x, game.player.z - PLACES.gudang.z) < 11; },
          onDone(r, game) {
            for (const [x, z] of [[96, 8], [110, 6], [104, 16]]) {
              const e = game.people.spawnEnemy(x, z, { x, z });
              e.alert();
              r.enemies = r.enemies || [];
              r.enemies.push(e);
            }
            game.hooks.message('Kalongs: Hey! That case is ours now. Get him!', 4);
          },
        },
        {
          label: 'Deal with the rivals (0 left)',
          point: { x: PLACES.gudang.x, z: PLACES.gudang.z },
          update(r, game) {
            const left = game.people.aliveEnemies().length;
            r.stepLabel = `Deal with the rivals (${left} left)`;
          },
          done(r, game) { return game.people.aliveEnemies().length === 0; },
          onDone(r, game) {
            const item = makeBriefcase();
            item.position.set(108, 0, 14);
            game.scene.add(item);
            r.items.push(item);
            game.hooks.message('The briefcase is by the crates. Grab it.', 4);
          },
        },
        {
          label: 'Take the briefcase',
          point: { x: 108, z: 14 },
          done(r, game) {
            const p = game.player;
            return !p.inCar && Math.hypot(p.x - 108, p.z - 14) < 2.4;
          },
          onDone(r, game) {
            for (const item of r.items) game.scene.remove(item);
            r.items = [];
            game.setHeat(48);
            game.hooks.message('You took the briefcase. The Kalongs called the cops — get back to Bu Ratna.', 5);
          },
        },
        {
          label: 'Bring the briefcase to Bengkel Sumber Jaya',
          point: { x: PLACES.bengkel.x, z: PLACES.bengkel.z },
          done(r, game) { return Math.hypot(game.player.x - PLACES.bengkel.x, game.player.z - PLACES.bengkel.z) < 8; },
        },
      ];
    }
    if (id === 'balap') {
      const checkpoints = [
        { x: 37, z: -26 },
        { x: -26, z: 0 },
        { x: -78, z: 78 },
      ];
      return [
        {
          label: 'Steal the yellow Garuda GT at the hotel',
          point: { x: 112, z: -80 },
          enter(r, game) {
            const car = new Car(game.scene, { x: 112, z: -80, heading: Math.PI / 2, color: 0xe8c832, kind: 'coupe', driver: null });
            game.addCar(car);
            r.cars.push(car);
            r.missionCar = car;
          },
          done(r, game) { return game.player.inCar && game.player.car === r.missionCar; },
          onDone(r, game) {
            game.setHeat(30);
            game.hooks.message('Alarm! The hotel called it in. Hit the checkpoints, then the chop shop.', 5);
          },
        },
        {
          label: 'Hit the checkpoints (1 of 3)',
          point: checkpoints[0],
          update(r, game) {
            r.stepLabel = `Hit the checkpoints (${r.checkpointIndex + 1} of 3)`;
            r.point = checkpoints[r.checkpointIndex];
          },
          done(r, game) {
            const p = game.player;
            if (!p.inCar || p.car !== r.missionCar) return false;
            const cp = checkpoints[r.checkpointIndex];
            if (Math.hypot(p.x - cp.x, p.z - cp.z) < 9) {
              r.checkpointIndex += 1;
              game.hooks.pickup();
              if (r.checkpointIndex >= checkpoints.length) return true;
              game.hooks.message(`Checkpoint ${r.checkpointIndex} of 3.`, 2);
            }
            return false;
          },
        },
        {
          label: 'Deliver the Garuda GT to the chop shop',
          point: { x: PLACES.chopShop.x, z: PLACES.chopShop.z },
          done(r, game) {
            const p = game.player;
            return p.inCar && p.car === r.missionCar && Math.hypot(p.x - PLACES.chopShop.x, p.z - PLACES.chopShop.z) < 9 && Math.abs(p.car.speed) < 2;
          },
          onDone(r, game) {
            if (r.missionCar.health < 25) {
              r.payCut = true;
              game.hooks.message('Chop shop: You brought it back bent. Half pay.', 4);
            }
          },
        },
      ];
    }
    // jebakan: the ambush at the port.
    return [
      {
        label: 'Meet the buyer at the port',
        point: { x: PLACES.port.x, z: PLACES.port.z },
        done(r, game) { return Math.hypot(game.player.x - PLACES.port.x, game.player.z - PLACES.port.z) < 11; },
        onDone(r, game) {
          r.wave = 1;
          for (const [x, z] of [[96, 144], [112, 142], [104, 136]]) {
            const e = game.people.spawnEnemy(x, z, { x, z });
            e.alert();
          }
          game.hooks.message('It is an ambush! The Kalongs are here for the money!', 4);
        },
      },
      {
        label: 'Survive the ambush — wave 1',
        point: { x: PLACES.port.x, z: PLACES.port.z },
        update(r, game) {
          const left = game.people.aliveEnemies().length;
          r.stepLabel = `Survive the ambush — wave ${r.wave} (${left} left)`;
          if (r.wave === 1 && left === 0) {
            r.wave = 2;
            for (const [x, z] of [[92, 140], [116, 148]]) {
              const e = game.people.spawnEnemy(x, z, { x, z });
              e.alert();
            }
            game.hooks.message('Wave 2! More Kalongs coming off the pier!', 4);
          }
        },
        done(r, game) { return r.wave === 2 && game.people.aliveEnemies().length === 0; },
        onDone(r, game) {
          const item = makeMoneyBag();
          item.position.set(100, 0, 146);
          game.scene.add(item);
          r.items.push(item);
          game.hooks.message('The money bag is on the dock. Take it and run.', 4);
        },
      },
      {
        label: 'Take the money bag',
        point: { x: 100, z: 146 },
        done(r, game) {
          const p = game.player;
          return !p.inCar && Math.hypot(p.x - 100, p.z - 146) < 2.4;
        },
        onDone(r, game) {
          for (const item of r.items) game.scene.remove(item);
          r.items = [];
          const car = new Car(game.scene, { x: 92, z: 134, heading: Math.PI, color: 0x3f8f8a, kind: 'sedan', driver: null, owned: true });
          game.addCar(car);
          r.cars.push(car);
          game.setHeat(68);
          game.hooks.message('Four stars and rising. Get to Bu Ratna — the teal sedan is yours.', 5);
        },
      },
      {
        label: 'Bring the money to Bengkel Sumber Jaya',
        point: { x: PLACES.bengkel.x, z: PLACES.bengkel.z },
        done(r, game) { return Math.hypot(game.player.x - PLACES.bengkel.x, game.player.z - PLACES.bengkel.z) < 8; },
      },
    ];
  }

  complete() {
    const rt = this.active;
    const g = this.game;
    const pay = rt.payCut ? Math.round(rt.def.reward / 2) : rt.def.reward;
    g.addCash(pay);
    this.done.push(rt.def.id);
    this.available += 1;
    if (this.available >= MISSIONS.length) {
      this.storyComplete = true;
      g.hooks.banner('DEBT CLEARED', `Bu Ratna: We are square, Bimo. Jakarta is yours now. +$${pay}`);
    } else {
      g.hooks.banner('JOB DONE', `${rt.def.name} complete. +$${pay}`);
    }
    g.hooks.sting(true);
    g.hooks.missionComplete(rt.def.id, pay);
    this.cleanupRuntime(rt, true);
    this.active = null;
  }

  fail(reason) {
    if (!this.active) return;
    const rt = this.active;
    const g = this.game;
    g.hooks.banner('JOB FAILED', reason);
    g.hooks.sting(false);
    g.hooks.missionFailed(rt.def.id, reason);
    this.cleanupRuntime(rt, false);
    this.active = null;
  }

  cleanupRuntime(rt, keepCars) {
    const g = this.game;
    for (const item of rt.items || []) g.scene.remove(item);
    if (rt.passenger && rt.missionCar) rt.missionCar.group.remove(rt.passenger.group);
    if (!keepCars) {
      // A failed job takes its cars with it, so a retry spawns a fresh one
      // instead of stacking duplicates. The car the player sits in stays:
      // removing it under the player would strand them.
      for (const car of rt.cars || []) {
        if (car !== g.player.car) g.removeCar(car);
      }
    }
    g.people.clearEnemies();
    rt.items = [];
  }

  // Called when the player is busted or wasted mid-mission.
  onPlayerDown(reason) {
    if (this.active) this.fail(reason);
  }

  update(dt, game) {
    this.time += dt;
    const bob = Math.sin(this.time * 2.2) * 0.35;
    this.beacon.diamond.rotation.y += dt * 1.6;
    this.beacon.diamond.position.y = 4.5 + bob;
    this.startBeacon.diamond.rotation.y += dt * 1.2;
    this.startBeacon.diamond.position.y = 4.5 + bob;
    this.startBeacon.group.visible = !this.active && !!this.currentDef;

    if (!this.active) {
      this.beacon.group.visible = false;
      return;
    }
    const rt = this.active;
    const step = rt.step;
    if (!step) return;
    if (rt.timerRunning) {
      rt.timer -= dt;
      if (rt.timer <= 0) {
        rt.timer = 0;
        rt.timerRunning = false;
        this.fail('Out of time.');
        return;
      }
    }
    if (step.update) step.update(rt, game);
    if (rt.point) {
      this.beacon.group.visible = true;
      this.beacon.group.position.set(rt.point.x, 0, rt.point.z);
    } else {
      this.beacon.group.visible = false;
    }
    // A mission car that gets wrecked fails the jobs that need it.
    if (rt.missionCar && rt.missionCar.wrecked && (rt.def.id === 'macet' || rt.def.id === 'balap')) {
      this.fail('The car was wrecked.');
      return;
    }
    if (step.done && step.done(rt, game)) {
      if (step.onDone) step.onDone(rt, game);
      this.advance();
    }
  }

  nearStartMarker(player) {
    return !this.active && !!this.currentDef
      && Math.hypot(player.x - PLACES.bengkel.x, player.z - PLACES.bengkel.z) < 7;
  }

  applySave(doneList, storyComplete) {
    this.done = [...doneList];
    this.available = this.done.length;
    this.storyComplete = storyComplete;
  }
}
