// The Jakarta fleet: sedans, SUVs, MPVs, vans, coupes, angkot minibuses,
// taxis, pickups, trucks, orange-and-blue bajaj three-wheelers, articulated
// red-and-white buses on the busway, and motorbikes of every kind with
// riders. All shapes are original low-poly geometry; no badges, no real
// model names. Traffic keeps left. The roundabout circulates clockwise, as
// in Indonesia, with the island on the driver's right.
import * as THREE from 'three';
import { COLORS, CORRIDOR_X, DRIVING, HALF, ROAD_CENTRES, ROUNDABOUT, TRAFFIC_SPEED } from './config.js';
import { makeRng } from './random.js';
import { makePersonModel } from './people.js';

const glassMat = new THREE.MeshStandardMaterial({ color: COLORS.glass, roughness: 0.15, metalness: 0.4 });
const tyreMat = new THREE.MeshStandardMaterial({ color: COLORS.tyre, roughness: 0.95 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffedb5, emissiveIntensity: 1.8 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.3, metalness: 0.7 });
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
wheelGeo.rotateZ(Math.PI / 2);
const bigWheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.32, 12);
bigWheelGeo.rotateZ(Math.PI / 2);

function routeBoardTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 64, 23);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

// One car model per kind. Returns the group, wheel meshes, steering pivots,
// a per-car brake-light material, and the police light bar when present.
export function makeCarModel(kind, paint, police) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: police ? COLORS.policePaint : paint, roughness: 0.35, metalness: 0.35 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x8a1111, emissive: 0xff2222, emissiveIntensity: 0.6 });
  const wheels = [];
  const pivots = [];
  let wheelZ = 1.45;
  let track = 0.86;

  function addWheel(x, z, big) {
    const pivot = new THREE.Group();
    pivot.position.set(x, big ? 0.44 : 0.36, z);
    const mesh = new THREE.Mesh(big ? bigWheelGeo : wheelGeo, tyreMat);
    mesh.castShadow = true;
    pivot.add(mesh);
    group.add(pivot);
    wheels.push(mesh);
    return pivot;
  }

  if (kind === 'sedan' || kind === 'taxi') {
    group.add(box(1.9, 0.62, 4.4, bodyMat, 0, 0.62, 0));
    group.add(box(1.7, 0.55, 2.1, glassMat, 0, 1.15, -0.25));
    group.add(box(1.72, 0.12, 2.0, bodyMat, 0, 1.44, -0.25));
    if (kind === 'taxi') {
      group.add(box(0.7, 0.22, 0.3, new THREE.MeshStandardMaterial({ color: 0xffd94d, emissive: 0xcc9900, emissiveIntensity: 0.5 }), 0, 1.62, -0.25));
    }
  } else if (kind === 'suv') {
    group.add(box(2.0, 0.85, 4.5, bodyMat, 0, 0.78, 0));
    group.add(box(1.85, 0.75, 2.7, glassMat, 0, 1.5, -0.3));
    group.add(box(1.87, 0.1, 2.6, bodyMat, 0, 1.9, -0.3));
    group.add(box(0.08, 0.08, 2.4, trimMat, -0.8, 2.0, -0.3));
    group.add(box(0.08, 0.08, 2.4, trimMat, 0.8, 2.0, -0.3));
    wheelZ = 1.5;
    track = 0.9;
  } else if (kind === 'mpv') {
    group.add(box(1.95, 0.8, 4.6, bodyMat, 0, 0.72, 0));
    group.add(box(1.8, 0.8, 3.3, glassMat, 0, 1.45, -0.1));
    group.add(box(1.82, 0.1, 3.2, bodyMat, 0, 1.88, -0.1));
    wheelZ = 1.55;
    track = 0.88;
  } else if (kind === 'van') {
    group.add(box(2.0, 1.5, 4.6, bodyMat, 0, 1.05, -0.2));
    group.add(box(1.8, 0.7, 0.9, glassMat, 0, 1.5, 1.95));
    group.add(box(2.02, 0.5, 4.0, glassMat, 0, 1.35, -0.3));
    wheelZ = 1.55;
    track = 0.9;
  } else if (kind === 'coupe') {
    group.add(box(1.85, 0.5, 4.5, bodyMat, 0, 0.52, 0));
    group.add(box(1.5, 0.45, 1.7, glassMat, 0, 0.98, -0.35));
    group.add(box(1.7, 0.08, 0.5, trimMat, 0, 0.85, -2.05));
    group.add(box(0.12, 0.18, 0.3, trimMat, -0.7, 0.75, -2.05));
    group.add(box(0.12, 0.18, 0.3, trimMat, 0.7, 0.75, -2.05));
    wheelZ = 1.5;
  } else if (kind === 'angkot') {
    group.add(box(1.9, 1.45, 4.2, bodyMat, 0, 1.05, 0));
    group.add(box(1.92, 0.6, 3.4, glassMat, 0, 1.45, -0.2));
    group.add(box(1.92, 0.22, 4.22, new THREE.MeshStandardMaterial({ color: 0xffd94d, roughness: 0.6 }), 0, 0.62, 0));
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.28), new THREE.MeshBasicMaterial({ map: routeBoardTexture('KOTA 01') }));
    board.position.set(0, 1.9, 2.12);
    group.add(board);
    wheelZ = 1.45;
    track = 0.88;
  } else if (kind === 'pickup') {
    group.add(box(1.9, 0.6, 4.6, bodyMat, 0, 0.6, 0));
    group.add(box(1.8, 0.75, 1.6, bodyMat, 0, 1.25, 0.9));
    group.add(box(1.7, 0.5, 1.4, glassMat, 0, 1.3, 0.95));
    group.add(box(1.7, 0.45, 1.9, trimMat, 0, 1.1, -1.2));
    group.add(box(0.8, 0.6, 0.8, new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 1 }), -0.4, 1.55, -1.3));
    wheelZ = 1.55;
    track = 0.9;
  } else if (kind === 'truck') {
    group.add(box(2.0, 0.9, 1.8, bodyMat, 0, 0.9, 2.6));
    group.add(box(1.85, 0.7, 1.2, glassMat, 0, 1.5, 2.7));
    group.add(box(2.1, 2.3, 4.6, new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.7 }), 0, 1.6, -1.2));
    wheelZ = 2.4;
    track = 0.95;
  }
  // Bumpers, headlights, brake lights, mirrors.
  group.add(box(1.95, 0.22, 0.25, trimMat, 0, 0.42, 2.25));
  group.add(box(1.95, 0.22, 0.25, trimMat, 0, 0.42, -2.25));
  group.add(box(0.34, 0.2, 0.1, headMat, -0.62, 0.78, 2.24));
  group.add(box(0.34, 0.2, 0.1, headMat, 0.62, 0.78, 2.24));
  group.add(box(0.34, 0.2, 0.1, brakeMat, -0.62, 0.78, -2.24));
  group.add(box(0.34, 0.2, 0.1, brakeMat, 0.62, 0.78, -2.24));
  group.add(box(0.12, 0.1, 0.22, chromeMat, -1.0, 1.05, 0.7));
  group.add(box(0.12, 0.1, 0.22, chromeMat, 1.0, 1.05, 0.7));
  const big = kind === 'suv' || kind === 'truck' || kind === 'van';
  pivots.push(addWheel(-track, wheelZ, big), addWheel(track, wheelZ, big));
  addWheel(-track, -wheelZ, big);
  addWheel(track, -wheelZ, big);

  let lightBar = null;
  if (police) {
    group.add(box(1.92, 0.16, 4.42, new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.5 }), 0, 0.95, 0));
    const redMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0xff2222, emissiveIntensity: 2 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x2244cc, emissive: 0x2244ff, emissiveIntensity: 2 });
    group.add(box(1.0, 0.1, 0.36, trimMat, 0, 1.5, -0.25));
    group.add(box(0.42, 0.18, 0.3, redMat, -0.3, 1.62, -0.25));
    group.add(box(0.42, 0.18, 0.3, blueMat, 0.3, 1.62, -0.25));
    lightBar = { redMat, blueMat };
  }
  return { group, wheels, pivots, brakeMat, lightBar };
}

// Bajaj: orange front, blue cabin, three wheels, small canopy.
export function makeBajajModel() {
  const group = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: COLORS.bajajOrange, roughness: 0.5 });
  const blue = new THREE.MeshStandardMaterial({ color: COLORS.bajajBlue, roughness: 0.5 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x8a1111, emissive: 0xff2222, emissiveIntensity: 0.6 });
  group.add(box(1.3, 0.6, 1.1, orange, 0, 0.6, 0.85));
  group.add(box(1.4, 0.85, 1.6, blue, 0, 0.85, -0.5));
  group.add(box(1.42, 0.1, 1.7, orange, 0, 1.45, -0.5));
  group.add(box(1.1, 0.5, 0.1, glassMat, 0, 1.05, 0.35));
  group.add(box(0.24, 0.16, 0.08, headMat, 0, 0.7, 1.42));
  group.add(box(0.2, 0.14, 0.08, brakeMat, -0.45, 0.7, -1.32));
  group.add(box(0.2, 0.14, 0.08, brakeMat, 0.45, 0.7, -1.32));
  const wheels = [];
  const frontPivot = new THREE.Group();
  frontPivot.position.set(0, 0.3, 1.15);
  const frontWheel = new THREE.Mesh(wheelGeo, tyreMat);
  frontWheel.scale.setScalar(0.85);
  frontPivot.add(frontWheel);
  group.add(frontPivot);
  wheels.push(frontWheel);
  for (const side of [-0.62, 0.62]) {
    const pivot = new THREE.Group();
    pivot.position.set(side, 0.3, -0.85);
    const wheel = new THREE.Mesh(wheelGeo, tyreMat);
    wheel.scale.setScalar(0.85);
    pivot.add(wheel);
    group.add(pivot);
    wheels.push(wheel);
  }
  return { group, wheels, pivots: [frontPivot], brakeMat, lightBar: null };
}

// Articulated bus: two sections, a concertina joint, red-and-white livery.
export function makeBusModel() {
  const group = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: COLORS.busRed, roughness: 0.55 });
  const white = new THREE.MeshStandardMaterial({ color: COLORS.busWhite, roughness: 0.55 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x8a1111, emissive: 0xff2222, emissiveIntensity: 0.6 });
  function section(z) {
    const s = new THREE.Group();
    s.add(box(2.5, 1.9, 5.4, white, 0, 1.55, 0));
    s.add(box(2.52, 0.7, 5.42, red, 0, 0.75, 0));
    s.add(box(2.52, 0.8, 4.6, glassMat, 0, 2.0, 0));
    s.position.z = z;
    return s;
  }
  group.add(section(3.0));
  group.add(section(-3.0));
  group.add(box(2.3, 1.7, 0.7, trimMat, 0, 1.5, 0));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: routeBoardTexture('KOTA - SUDIRMAN') }));
  board.position.set(0, 2.35, 5.72);
  group.add(board);
  group.add(box(0.4, 0.24, 0.1, headMat, -0.85, 0.9, 5.72));
  group.add(box(0.4, 0.24, 0.1, headMat, 0.85, 0.9, 5.72));
  group.add(box(0.4, 0.24, 0.1, brakeMat, -0.85, 0.9, -5.72));
  group.add(box(0.4, 0.24, 0.1, brakeMat, 0.85, 0.9, -5.72));
  const wheels = [];
  for (const z of [4.4, 1.6, -1.6, -4.4]) {
    for (const side of [-1.15, 1.15]) {
      const pivot = new THREE.Group();
      pivot.position.set(side, 0.44, z);
      const wheel = new THREE.Mesh(bigWheelGeo, tyreMat);
      pivot.add(wheel);
      group.add(pivot);
      wheels.push(wheel);
    }
  }
  return { group, wheels, pivots: [], brakeMat, lightBar: null };
}

// Motorbikes. Kinds: scooter, underbone, sport, ojek, delivery.
// The rider is a full person model posed sitting; twoRiders adds a passenger.
export function makeBikeModel(kind, riderOpts, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: opts.paint ?? 0x333a42, roughness: 0.4, metalness: 0.3 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x8a1111, emissive: 0xff2222, emissiveIntensity: 0.6 });
  const wheelGeoBike = new THREE.CylinderGeometry(0.32, 0.32, 0.14, 12);
  wheelGeoBike.rotateZ(Math.PI / 2);
  const wheels = [];
  function addBikeWheel(z) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.32, z);
    const wheel = new THREE.Mesh(wheelGeoBike, tyreMat);
    pivot.add(wheel);
    group.add(pivot);
    wheels.push(wheel);
    return pivot;
  }
  const frontPivot = addBikeWheel(0.85);
  addBikeWheel(-0.85);
  if (kind === 'scooter' || kind === 'ojek') {
    group.add(box(0.5, 0.7, 0.5, paint, 0, 0.75, 0.62));
    group.add(box(0.42, 0.14, 0.8, trimMat, 0, 0.32, 0.05));
    group.add(box(0.46, 0.5, 0.9, paint, 0, 0.62, -0.45));
    group.add(box(0.44, 0.12, 0.8, trimMat, 0, 0.9, -0.45));
    group.add(box(0.5, 0.35, 0.06, glassMat, 0, 1.2, 0.6));
  } else if (kind === 'sport') {
    group.add(box(0.5, 0.55, 1.5, paint, 0, 0.65, 0.1));
    group.add(box(0.4, 0.35, 0.6, paint, 0, 0.95, 0.55));
    group.add(box(0.4, 0.1, 0.7, trimMat, 0, 0.88, -0.5));
  } else {
    group.add(box(0.42, 0.4, 1.4, paint, 0, 0.6, 0));
    group.add(box(0.36, 0.3, 0.5, paint, 0, 0.85, 0.3));
    group.add(box(0.4, 0.1, 0.8, trimMat, 0, 0.82, -0.4));
  }
  group.add(box(0.6, 0.06, 0.08, trimMat, 0, 1.02, 0.7));
  group.add(box(0.2, 0.14, 0.08, headMat, 0, 0.8, 0.92));
  group.add(box(0.18, 0.12, 0.08, brakeMat, 0, 0.75, -0.92));
  if (kind === 'delivery') {
    group.add(box(0.55, 0.55, 0.5, new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.6 }), 0, 1.15, -0.55));
  }
  function seatRider(rider, z, armsForward) {
    rider.group.position.set(0, 0.42, z);
    rider.parts.legL.rotation.x = -1.25;
    rider.parts.legR.rotation.x = -1.25;
    rider.parts.armL.rotation.x = armsForward ? -1.05 : -1.2;
    rider.parts.armR.rotation.x = armsForward ? -1.05 : -1.2;
    group.add(rider.group);
    return rider;
  }
  const rider = seatRider(makePersonModel(riderOpts || { shirt: 0x3a3f4a, pants: 0x2e3a4d, skin: 0xa86a42, hat: 'helmet' }), -0.25, true);
  let rider2 = null;
  if (opts.twoRiders) {
    rider2 = seatRider(makePersonModel(riderOpts || { shirt: 0xc94f43, pants: 0x4a3a2e, skin: 0xc98d5f, hat: 'helmet' }), -0.72, false);
  }
  return { group, wheels, pivots: [frontPivot], brakeMat, lightBar: null, rider, rider2 };
}

export class Car {
  constructor(scene, opts) {
    this.kind = opts.kind || 'sedan';
    this.police = !!opts.police;
    this.isBus = this.kind === 'bus';
    this.isBajaj = this.kind === 'bajaj';
    let model;
    if (this.isBus) model = makeBusModel();
    else if (this.isBajaj) model = makeBajajModel();
    else model = makeCarModel(this.kind, opts.color, this.police);
    this.model = model;
    this.group = model.group;
    scene.add(this.group);
    this.x = opts.x;
    this.z = opts.z;
    this.heading = opts.heading || 0;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.wrecked = false;
    this.driver = opts.driver || null;
    this.owned = !!opts.owned;
    this.heatGiven = false;
    this.braking = false;
    this.radius = this.isBus ? 3.0 : this.isBajaj ? 1.4 : DRIVING.radius;
    this.maxSpeed = this.isBus ? 12 : this.isBajaj ? 13 : this.kind === 'coupe' ? DRIVING.maxSpeed + 4 : this.kind === 'van' || this.kind === 'truck' ? DRIVING.maxSpeed - 8 : DRIVING.maxSpeed;
    if (this.police) this.maxSpeed = DRIVING.maxSpeed + 4;
    this.sirenPhase = Math.random() * 10;
    this.wheelSpin = 0;
    this.smokeAcc = 0;
    this.stuckT = 0;
    this.reverseT = 0;
    this.detourT = 0;
    this.detourX = 0;
    this.detourZ = 0;
    this.syncMesh();
  }

  syncMesh() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    for (const wheel of this.model.wheels) wheel.rotation.x = this.wheelSpin;
    for (const pivot of this.model.pivots) pivot.rotation.y = this.steer;
    this.model.brakeMat.emissiveIntensity = this.braking ? 3 : 0.6;
    if (this.model.lightBar) {
      const on = Math.sin(this.sirenPhase * 9) > 0;
      this.model.lightBar.redMat.emissiveIntensity = on ? 2.6 : 0.2;
      this.model.lightBar.blueMat.emissiveIntensity = on ? 0.2 : 2.6;
    }
  }

  damage(amount, hooks) {
    if (this.wrecked) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.wrecked = true;
      this.speed = 0;
      if (hooks && hooks.wrecked) hooks.wrecked(this);
    }
  }

  // One physics step. control: { throttle -1..1, steer -1..1, handbrake }.
  // Returns the impact strength when a crash happened this step, else 0.
  drive(dt, control, world, hooks) {
    if (this.wrecked) {
      this.speed *= Math.max(0, 1 - 3 * dt);
      this.syncMesh();
      return 0;
    }
    const throttle = control.throttle || 0;
    const steerInput = control.steer || 0;
    this.braking = throttle < 0 && this.speed > 0.5;
    if (throttle > 0) this.speed += throttle * DRIVING.accel * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed += throttle * DRIVING.brake * dt;
      else this.speed += throttle * DRIVING.accel * 0.6 * dt;
    }
    this.speed -= this.speed * DRIVING.drag * dt;
    if (control.handbrake) this.speed *= Math.max(0, 1 - 1.9 * dt);
    this.speed = Math.max(-DRIVING.reverseMax, Math.min(this.maxSpeed, this.speed));
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;

    const speedFactor = 1 / (1 + Math.abs(this.speed) * 0.035);
    const steerTarget = steerInput * DRIVING.steerMax * speedFactor;
    const steerRate = 3.2 * dt;
    this.steer += Math.max(-steerRate, Math.min(steerRate, steerTarget - this.steer));
    let yawRate = (this.speed / DRIVING.wheelBase) * Math.tan(this.steer);
    if (control.handbrake && Math.abs(this.speed) > 6) yawRate += steerInput * 1.4 * Math.sign(this.speed);
    this.heading += yawRate * dt;

    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const hit = world.collideCircle(nx, nz, this.radius);
    let impact = 0;
    if (hit.hit) {
      const speedBefore = Math.abs(this.speed);
      if (speedBefore > 4) {
        impact = speedBefore;
        this.damage(speedBefore * 0.9, hooks);
        this.speed *= 0.35;
        if (hooks && hooks.crash) hooks.crash(speedBefore, hit.x, hit.z);
      } else {
        this.speed *= 0.5;
      }
    }
    this.x = hit.x;
    this.z = hit.z;
    this.wheelSpin += (this.speed / 0.36) * dt;
    if (this.police) this.sirenPhase += dt;
    if (this.health < 45 && hooks && hooks.smoke) {
      this.smokeAcc += dt;
      if (this.smokeAcc > 0.12) {
        this.smokeAcc = 0;
        hooks.smoke(this.x, 1.2, this.z, this.wrecked ? 2 : 1);
      }
    }
    this.syncMesh();
    return impact;
  }

  // Steering input that aims the car at a point, for AI drivers.
  steerToward(tx, tz, slowRadius) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    let throttle = 1;
    if (slowRadius && dist < slowRadius) throttle = Math.max(0.25, dist / slowRadius);
    if (Math.abs(diff) > 2.2 && this.speed < 2) throttle = -0.6;
    return { throttle, steer, handbrake: false, dist, diff, want };
  }

  dispose(scene) {
    scene.remove(this.group);
  }
}

export class Bike {
  constructor(scene, opts) {
    this.kind = opts.kind || 'scooter';
    this.isBike = true;
    const model = makeBikeModel(this.kind, opts.riderOpts, { paint: opts.color, twoRiders: !!opts.twoRiders });
    this.model = model;
    this.group = model.group;
    scene.add(this.group);
    this.x = opts.x;
    this.z = opts.z;
    this.heading = opts.heading || 0;
    this.speed = 0;
    this.steer = 0;
    this.health = 60;
    this.wrecked = false;
    this.driver = opts.driver || 'traffic';
    this.owned = false;
    this.heatGiven = false;
    this.braking = false;
    this.radius = 0.9;
    this.maxSpeed = this.kind === 'sport' ? 30 : 24;
    this.wheelSpin = 0;
    this.stuckT = 0;
    this.reverseT = 0;
    this.detourT = 0;
    this.detourX = 0;
    this.detourZ = 0;
    this.weaveT = Math.random() * 10;
    this.syncMesh();
  }

  syncMesh() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    this.group.rotation.z = this.wrecked ? 1.35 : -this.steer * 0.18;
    for (const wheel of this.model.wheels) wheel.rotation.x = this.wheelSpin;
    for (const pivot of this.model.pivots) pivot.rotation.y = this.steer;
    this.model.brakeMat.emissiveIntensity = this.braking ? 3 : 0.6;
  }

  damage(amount, hooks) {
    if (this.wrecked) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.wrecked = true;
      this.speed = 0;
      if (hooks && hooks.wrecked) hooks.wrecked(this);
    }
  }

  drive(dt, control, world, hooks) {
    if (this.wrecked) {
      this.syncMesh();
      return 0;
    }
    const throttle = control.throttle || 0;
    const steerInput = control.steer || 0;
    this.braking = throttle < 0 && this.speed > 0.5;
    if (throttle > 0) this.speed += throttle * 18 * dt;
    else if (throttle < 0) this.speed += throttle * 26 * dt;
    this.speed -= this.speed * 0.5 * dt;
    this.speed = Math.max(-4, Math.min(this.maxSpeed, this.speed));
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    const steerTarget = steerInput * 0.6 / (1 + Math.abs(this.speed) * 0.03);
    const steerRate = 4 * dt;
    this.steer += Math.max(-steerRate, Math.min(steerRate, steerTarget - this.steer));
    this.heading += (this.speed / 1.7) * Math.tan(this.steer) * dt;
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const hit = world.collideCircle(nx, nz, this.radius);
    let impact = 0;
    if (hit.hit) {
      const speedBefore = Math.abs(this.speed);
      if (speedBefore > 4) {
        impact = speedBefore;
        this.damage(speedBefore * 1.6, hooks);
        this.speed *= 0.3;
        if (hooks && hooks.crash) hooks.crash(speedBefore, hit.x, hit.z);
      } else {
        this.speed *= 0.5;
      }
    }
    this.x = hit.x;
    this.z = hit.z;
    this.wheelSpin += (this.speed / 0.32) * dt;
    this.syncMesh();
    return impact;
  }

  steerToward(tx, tz, slowRadius) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.4));
    let throttle = 1;
    if (slowRadius && dist < slowRadius) throttle = Math.max(0.25, dist / slowRadius);
    if (Math.abs(diff) > 2.2 && this.speed < 2) throttle = -0.5;
    return { throttle, steer, handbrake: false, dist, diff, want };
  }

  dispose(scene) {
    scene.remove(this.group);
  }
}

// Push two overlapping vehicles apart and trade speed along the impact line.
export function resolveCarPair(a, b, hooks) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const minDist = a.radius + b.radius - 0.6;
  if (dist >= minDist || dist < 0.001) return;
  const nx = dx / dist;
  const nz = dz / dist;
  const overlap = minDist - dist;
  a.x -= nx * overlap * 0.5;
  a.z -= nz * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.z += nz * overlap * 0.5;
  const relSpeed = Math.abs(a.speed - b.speed);
  if (relSpeed > 3) {
    const avg = (a.speed + b.speed) / 2;
    a.speed = avg * 0.7;
    b.speed = avg * 0.7;
    const dmg = relSpeed * 0.7;
    a.damage(a.isBike ? dmg * 1.6 : dmg, hooks);
    b.damage(b.isBike ? dmg * 1.6 : dmg, hooks);
    if (hooks && hooks.crash) hooks.crash(relSpeed, (a.x + b.x) / 2, (a.z + b.z) / 2);
    if (hooks && hooks.carHit) hooks.carHit(a, b, relSpeed);
  } else {
    a.speed *= 0.85;
    b.speed *= 0.85;
  }
  a.syncMesh();
  b.syncMesh();
}

// Roundabout routing: clockwise circulation, island on the right.
// Angles follow the heading convention: point = centre + R * (sin, cos).
function roundaboutArc(entryAngle, exitAngle) {
  let delta = entryAngle - exitAngle;
  while (delta <= 0) delta += Math.PI * 2;
  if (delta >= Math.PI * 2 - 0.01) delta = Math.PI * 1.5;
  const points = [];
  for (let t = Math.PI / 4; t <= delta + 0.01; t += Math.PI / 4) {
    const a = entryAngle - t;
    points.push({ x: ROUNDABOUT.x + Math.sin(a) * ROUNDABOUT.circleRadius, z: ROUNDABOUT.z + Math.cos(a) * ROUNDABOUT.circleRadius });
  }
  return points;
}

function entryLegAngle(x, z) {
  const dx = x - ROUNDABOUT.x;
  const dz = z - ROUNDABOUT.z;
  if (Math.abs(dz) > Math.abs(dx)) return dz > 0 ? 0 : Math.PI;
  return dx > 0 ? Math.PI / 2 : -Math.PI / 2;
}

function nearestCentre(v) {
  return ROAD_CENTRES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
}

// One grid line from `from` toward `toward`, or `from` when already on the
// nearest line to the target. Lets a patrol route intersection by
// intersection instead of aiming through buildings.
function stepCentre(from, toward) {
  const fromIdx = ROAD_CENTRES.indexOf(nearestCentre(from));
  const toIdx = ROAD_CENTRES.indexOf(nearestCentre(toward));
  if (fromIdx < toIdx) return ROAD_CENTRES[fromIdx + 1];
  if (fromIdx > toIdx) return ROAD_CENTRES[fromIdx - 1];
  return from;
}

// Smallest wrapped difference between two headings, in (-PI, PI].
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Next road-grid node from (cx, cz) toward the suspect's node (px, pz).
// The roundabout node is a fountain, not a road, so it is never returned:
// when every direct step would cross it, the patrol sidesteps around it
// on the other axis. Returns null when already on the suspect's node.
function nextNode(cx, cz, px, pz) {
  if (px === cx && pz === cz) return null;
  const cand = [];
  if (px !== cx) cand.push([stepCentre(cx, px), cz]);
  if (pz !== cz) cand.push([cx, stepCentre(cz, pz)]);
  if (Math.abs(pz - cz) > Math.abs(px - cx)) cand.reverse();
  for (const [nx, nz] of cand) {
    if (nx === ROUNDABOUT.x && nz === ROUNDABOUT.z) continue;
    return [nx, nz];
  }
  if (cz === ROUNDABOUT.z) {
    const nz = cz - 52 >= ROAD_CENTRES[0] ? cz - 52 : cz + 52;
    return [cx, nz];
  }
  const nx = cx - 52 >= ROAD_CENTRES[0] ? cx - 52 : cx + 52;
  return [nx, cz];
}

export class TrafficManager {
  constructor(scene, world, rng, carCount, bikeCount) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.cars = [];
    this.bikes = [];
    this.carCount = carCount;
    this.bikeCount = bikeCount;
    for (let i = 0; i < carCount; i += 1) this.spawnCar(true);
    for (let i = 0; i < bikeCount; i += 1) this.spawnBike(true);
  }

  randomRoadPoint(near, minDist, maxDist, corridorBias) {
    for (let tries = 0; tries < 24; tries += 1) {
      const alongX = this.rng.chance(0.5);
      // Congestion: the Sudirman corridor draws more traffic.
      const centre = corridorBias && this.rng.chance(0.4) ? CORRIDOR_X : this.rng.pick(ROAD_CENTRES);
      const pos = this.rng.range(-HALF + 8, HALF - 8);
      const x = alongX ? pos : centre;
      const z = alongX ? centre : pos;
      if (Math.hypot(x - ROUNDABOUT.x, z - ROUNDABOUT.z) < 18) continue;
      if (near) {
        const d = Math.hypot(x - near.x, z - near.z);
        if (d < minDist || d > maxDist) continue;
      }
      return { x, z, alongX };
    }
    return { x: 0, z: ROAD_CENTRES[0], alongX: true };
  }

  spawnCar(anywhere, near) {
    const spot = this.randomRoadPoint(anywhere ? null : near, 55, 110, true);
    const heading = spot.alongX ? (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (this.rng.chance(0.5) ? 0 : Math.PI);
    const kind = this.rng.pick(['sedan', 'sedan', 'suv', 'mpv', 'mpv', 'van', 'angkot', 'taxi', 'pickup', 'bajaj', 'bajaj', 'truck']);
    let color = this.rng.pick(COLORS.carPaint);
    if (kind === 'suv') color = this.rng.pick(COLORS.suvPaint);
    if (kind === 'taxi') color = COLORS.taxiPaint;
    if (kind === 'angkot') color = COLORS.angkotPaint;
    const car = new Car(this.scene, { x: spot.x, z: spot.z, heading, color, kind, driver: 'traffic' });
    car.waypoint = this.nextWaypoint(car);
    car.cruise = (kind === 'bajaj' ? 6.5 : kind === 'truck' ? 7 : TRAFFIC_SPEED) * this.rng.range(0.85, 1.1);
    car.circle = null;
    this.cars.push(car);
    return car;
  }

  spawnBike(anywhere, near) {
    const spot = this.randomRoadPoint(anywhere ? null : near, 45, 100, true);
    const heading = spot.alongX ? (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (this.rng.chance(0.5) ? 0 : Math.PI);
    const kind = this.rng.pick(['scooter', 'scooter', 'scooter', 'underbone', 'underbone', 'sport', 'ojek', 'ojek', 'delivery']);
    const riderOpts = kind === 'ojek'
      ? { shirt: COLORS.ojekGreen, pants: 0x2e3a4d, skin: this.rng.pick(COLORS.skin), hat: 'helmet' }
      : { shirt: this.rng.pick(COLORS.shirt), pants: this.rng.pick(COLORS.pants), skin: this.rng.pick(COLORS.skin), hat: this.rng.chance(0.7) ? 'helmet' : null };
    const bike = new Bike(this.scene, {
      x: spot.x, z: spot.z, heading, kind, riderOpts,
      color: this.rng.pick([0x333a42, 0xc23a2e, 0x2e5f8a, 0xe8e8e8, 0x1a1a1a]),
      twoRiders: kind !== 'delivery' && this.rng.chance(0.3),
    });
    bike.waypoint = this.nextWaypoint(bike);
    bike.cruise = TRAFFIC_SPEED * this.rng.range(1.1, 1.5);
    bike.circle = null;
    this.bikes.push(bike);
    return bike;
  }

  nextWaypoint(vehicle) {
    const centres = ROAD_CENTRES;
    const movingX = Math.abs(Math.sin(vehicle.heading)) > 0.7;
    const dir = movingX ? Math.sign(Math.sin(vehicle.heading)) : Math.sign(Math.cos(vehicle.heading));
    const coord = movingX ? vehicle.x : vehicle.z;
    let next = null;
    for (const c of centres) {
      if (dir > 0 && c > coord + 4) { next = c; break; }
      if (dir < 0 && c < coord - 4) next = c;
    }
    if (next === null) {
      next = dir > 0 ? centres[centres.length - 1] : centres[0];
      return { x: movingX ? next : nearestCentre(vehicle.x), z: movingX ? nearestCentre(vehicle.z) : next, turn: true };
    }
    const turn = this.rng.chance(0.45);
    return { x: movingX ? next : nearestCentre(vehicle.x), z: movingX ? nearestCentre(vehicle.z) : next, turn };
  }

  // Left-hand traffic: the lane sits to the left of the direction of travel.
  // On the corridor the lane moves out, clear of the busway median. The
  // offset follows the direction TO the target, not the current heading,
  // so it stays put while the car turns instead of swinging the target
  // behind it and stalling the car at intersections.
  laneOffset(vehicle, target) {
    const onCorridor = Math.abs(target.x - CORRIDOR_X) < 2 || (Math.abs(vehicle.x - CORRIDOR_X) < 6 && Math.abs(Math.sin(vehicle.heading)) < 0.7);
    const lane = onCorridor ? 4.2 : 3;
    const want = Math.atan2(target.x - vehicle.x, target.z - vehicle.z);
    const s = Math.sin(want);
    const c = Math.cos(want);
    return { x: c * lane, z: -s * lane, lane };
  }

  maybeEnterRoundabout(vehicle) {
    if (vehicle.circle) return;
    const dx = ROUNDABOUT.x - vehicle.x;
    const dz = ROUNDABOUT.z - vehicle.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 34 || dist < 4) return;
    // Only cars heading toward the roundabout join the circle, so
    // through-traffic on the corridor and the cross street routes around
    // the fountain instead of driving into it.
    const fx = Math.sin(vehicle.heading);
    const fz = Math.cos(vehicle.heading);
    if ((dx * fx + dz * fz) / dist < 0.3) return;
    const entry = entryLegAngle(vehicle.x, vehicle.z);
    const wp = vehicle.waypoint;
    let exit = wp ? entryLegAngle(wp.x, wp.z) : entry;
    if (Math.abs(exit - entry) < 0.01) {
      const legs = [0, Math.PI / 2, Math.PI, -Math.PI / 2].filter((a) => Math.abs(a - entry) > 0.01);
      exit = this.rng.pick(legs);
    }
    vehicle.circle = { points: roundaboutArc(entry, exit), index: 0 };
  }

  updateVehicle(dt, vehicle, player, allVehicles, hooks, isBike) {
    if (vehicle.wrecked) return;
    // A stolen car belongs to the player: the AI must not drive it too.
    if (player && player.car === vehicle) return;
    vehicle.weaveT = (vehicle.weaveT || 0) + dt;
    this.maybeEnterRoundabout(vehicle);
    let target;
    if (vehicle.circle) {
      target = vehicle.circle.points[vehicle.circle.index];
      const d = Math.hypot(target.x - vehicle.x, target.z - vehicle.z);
      if (d < 4) {
        vehicle.circle.index += 1;
        if (vehicle.circle.index >= vehicle.circle.points.length) {
          vehicle.circle = null;
          vehicle.waypoint = this.nextWaypoint(vehicle);
          target = vehicle.waypoint;
        } else {
          target = vehicle.circle.points[vehicle.circle.index];
        }
      }
    } else {
      target = vehicle.waypoint;
    }
    const lane = this.laneOffset(vehicle, target);
    let tx = target.x + lane.x;
    let tz = target.z + lane.z;
    if (isBike) {
      // Motorbikes weave through the flow.
      const weave = Math.sin(vehicle.weaveT * 0.9) * (lane.lane > 3.5 ? 0.7 : 1.1);
      tx += Math.cos(vehicle.heading) * weave;
      tz += -Math.sin(vehicle.heading) * weave;
    }
    const ctrl = vehicle.steerToward(tx, tz, 12);
    // Stuck rescue: back out for a moment, then detour to the nearest
    // intersection to get back on the road grid instead of grinding a
    // building face the waypoint pulls it along.
    if (vehicle.reverseT > 0) {
      vehicle.reverseT -= dt;
      vehicle.drive(dt, { throttle: -0.7, steer: -ctrl.steer, handbrake: false }, this.world, hooks);
      return;
    }
    if (vehicle.detourT > 0) {
      vehicle.detourT -= dt;
      const dCtrl = vehicle.steerToward(vehicle.detourX, vehicle.detourZ, 0);
      vehicle.drive(dt, { throttle: 0.7, steer: dCtrl.steer, handbrake: false }, this.world, hooks);
      if (dCtrl.dist < 5) vehicle.detourT = 0;
      if (Math.abs(vehicle.speed) < 0.5) {
        vehicle.stuckT += dt;
        if (vehicle.stuckT > 1.5) { vehicle.detourT = 0; vehicle.stuckT = 0; }
      } else {
        vehicle.stuckT = 0;
      }
      return;
    }
    let blocked = false;
    const look = isBike ? 5 : 7;
    const aheadX = vehicle.x + Math.sin(vehicle.heading) * look;
    const aheadZ = vehicle.z + Math.cos(vehicle.heading) * look;
    for (const other of allVehicles) {
      if (other === vehicle || other.wrecked || other.isBus) continue;
      if (Math.hypot(other.x - aheadX, other.z - aheadZ) < (isBike ? 3.2 : 4.5)) { blocked = true; break; }
    }
    if (player && !player.inCar && Math.hypot(player.x - aheadX, player.z - aheadZ) < 3.5) blocked = true;
    // Traffic never reverses to face its target: a slow creep plus steering
    // turns the car around, while reversing oscillates it against the
    // waypoint and freezes it at intersections.
    let throttle = blocked ? (vehicle.speed > 0.5 ? -1 : 0) : Math.max(0.25, Math.min(1, ctrl.throttle));
    if (isBike && blocked) throttle = Math.max(throttle, 0.25);
    if (vehicle.speed > vehicle.cruise) throttle = Math.min(throttle, 0);
    vehicle.drive(dt, { throttle, steer: ctrl.steer, handbrake: false }, this.world, hooks);
    // Stuck rescue: reverse out, then detour to the nearest intersection.
    // After three rescues without progress, the car is wedged on a corner
    // the detour cannot route around, so it is placed back on the nearest
    // road point instead of looping forever.
    if (Math.abs(vehicle.speed) < 0.5 && throttle > 0) {
      vehicle.stuckT += dt;
      if (vehicle.stuckT > 2.5) {
        const last = vehicle.rescuePos;
        const moved = last ? Math.hypot(vehicle.x - last.x, vehicle.z - last.z) : Infinity;
        vehicle.rescueCount = moved < 5 ? (vehicle.rescueCount || 0) + 1 : 1;
        vehicle.rescuePos = { x: vehicle.x, z: vehicle.z };
        if (vehicle.rescueCount >= 3) {
          const cx = nearestCentre(vehicle.x);
          const cz = nearestCentre(vehicle.z);
          if (Math.abs(cx - vehicle.x) < Math.abs(cz - vehicle.z)) vehicle.x = cx;
          else vehicle.z = cz;
          vehicle.rescueCount = 0;
          vehicle.reverseT = 0;
          vehicle.detourT = 0;
          vehicle.waypoint = this.nextWaypoint(vehicle);
        } else {
          vehicle.detourX = nearestCentre(vehicle.x);
          vehicle.detourZ = nearestCentre(vehicle.z);
          vehicle.detourT = 3;
          vehicle.reverseT = 1.0;
        }
        vehicle.stuckT = 0;
      }
    } else {
      vehicle.stuckT = 0;
    }
    // Arrival is measured against the raw waypoint: the lane-offset target
    // moves as the car turns, so measuring against it can stall the car
    // just short of the intersection forever.
    if (!vehicle.circle && Math.hypot(vehicle.waypoint.x - vehicle.x, vehicle.waypoint.z - vehicle.z) < 6) {
      if (vehicle.waypoint.turn) {
        const goX = this.rng.chance(0.5);
        const pick = this.rng.pick(ROAD_CENTRES);
        vehicle.waypoint = goX ? { x: pick, z: nearestCentre(vehicle.z), turn: false } : { x: nearestCentre(vehicle.x), z: pick, turn: false };
        if (Math.hypot(vehicle.waypoint.x - vehicle.x, vehicle.waypoint.z - vehicle.z) < 6) vehicle.waypoint = this.nextWaypoint(vehicle);
      } else {
        vehicle.waypoint = this.nextWaypoint(vehicle);
      }
    }
  }

  update(dt, player, allVehicles, hooks) {
    for (const car of this.cars) this.updateVehicle(dt, car, player, allVehicles, hooks, false);
    for (const bike of this.bikes) this.updateVehicle(dt, bike, player, allVehicles, hooks, true);
    for (let i = this.cars.length - 1; i >= 0; i -= 1) {
      const car = this.cars[i];
      if (player && car === player.car) continue;
      const far = player && Math.hypot(car.x - player.x, car.z - player.z) > 200;
      if (car.wrecked || far) {
        car.dispose(this.scene);
        this.cars.splice(i, 1);
        this.spawnCar(false, player);
      }
    }
    for (let i = this.bikes.length - 1; i >= 0; i -= 1) {
      const bike = this.bikes[i];
      if (player && bike === player.car) continue;
      const far = player && Math.hypot(bike.x - player.x, bike.z - player.z) > 200;
      if (bike.wrecked || far) {
        bike.dispose(this.scene);
        this.bikes.splice(i, 1);
        this.spawnBike(false, player);
      }
    }
  }
}

// Buses shuttle the Sudirman corridor on the busway median, stopping at the
// shelters. They stay in their separated lane and never meet other traffic.
export class BusManager {
  constructor(scene, world, rng, count) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.buses = [];
    this.stops = [-78, 78];
    for (let i = 0; i < count; i += 1) {
      const dir = i % 2 === 0 ? 1 : -1;
      const bus = new Car(scene, {
        x: CORRIDOR_X + (dir > 0 ? 1.4 : -1.4),
        z: dir > 0 ? -120 + i * 20 : 120 - i * 20,
        heading: dir > 0 ? 0 : Math.PI,
        kind: 'bus',
        driver: 'bus',
      });
      bus.dir = dir;
      bus.wait = 0;
      bus.lastStop = null;
      bus.cruise = 9;
      this.buses.push(bus);
    }
  }

  update(dt, playerCar, hooks) {
    for (const bus of this.buses) {
      if (bus.wrecked) continue;
      if (bus.wait > 0) {
        bus.wait -= dt;
        bus.drive(dt, { throttle: 0, steer: 0, handbrake: false }, this.world, hooks);
        continue;
      }
      const targetZ = bus.dir > 0 ? HALF - 6 : -HALF + 6;
      const laneX = CORRIDOR_X + (bus.dir > 0 ? 1.4 : -1.4);
      const ctrl = bus.steerToward(laneX, targetZ, 10);
      let throttle = Math.min(1, ctrl.throttle);
      if (bus.speed > bus.cruise) throttle = Math.min(throttle, 0);
      // Stop at shelters, once per pass.
      for (const stopZ of this.stops) {
        if (Math.abs(bus.z - stopZ) < 5 && bus.lastStop !== stopZ) {
          bus.lastStop = stopZ;
          bus.wait = 4;
          throttle = 0;
        }
      }
      if (Math.abs(bus.z - targetZ) < 8) {
        bus.dir *= -1;
        bus.lastStop = null;
      }
      bus.drive(dt, { throttle, steer: ctrl.steer, handbrake: false }, this.world, hooks);
      if (Math.abs(bus.speed) < 0.5 && throttle > 0) {
        bus.stuckT += dt;
        if (bus.stuckT > 2.5) {
          bus.heading = ctrl.want;
          bus.stuckT = 0;
        }
      } else {
        bus.stuckT = 0;
      }
      if (playerCar && !playerCar.wrecked) resolveCarPair(bus, playerCar, hooks);
    }
  }
}

export class PoliceManager {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.cars = [];
  }

  desired(stars, policeByStar) {
    return policeByStar[Math.min(stars, policeByStar.length - 1)];
  }

  spawnNear(player) {
    const spot = (() => {
      for (let tries = 0; tries < 24; tries += 1) {
        const alongX = this.rng.chance(0.5);
        const centre = this.rng.pick(ROAD_CENTRES);
        const pos = this.rng.range(-HALF + 8, HALF - 8);
        const x = alongX ? pos : centre;
        const z = alongX ? centre : pos;
        const d = Math.hypot(x - player.x, z - player.z);
        const clearOfRoundabout = Math.hypot(x - ROUNDABOUT.x, z - ROUNDABOUT.z) > 14;
        if (d > 55 && d < 110 && clearOfRoundabout) return { x, z };
      }
      return { x: player.x + 70, z: player.z };
    })();
    const car = new Car(this.scene, {
      x: spot.x,
      z: spot.z,
      heading: Math.atan2(player.x - spot.x, player.z - spot.z),
      color: COLORS.policePaint,
      kind: 'sedan',
      driver: 'police',
      police: true,
    });
    this.cars.push(car);
    return car;
  }

  update(dt, player, playerVel, stars, policeByStar, hooks) {
    const want = this.desired(stars, policeByStar);
    // Wrecked patrol cars do not count: the pursuit reinforces up to the
    // wanted level instead of thinning out as the player wrecks cars.
    while (this.cars.filter((c) => !c.wrecked).length < want) this.spawnNear(player);
    for (const car of this.cars) {
      if (car.wrecked) continue;
      // A stolen patrol car belongs to the player until they leave it.
      if (car === player.car) continue;
      if (want === 0) {
        car.pwx = undefined;
        const tx = Math.abs(car.x) > Math.abs(car.z) ? Math.sign(car.x) * (HALF + 4) : car.x;
        const tz = Math.abs(car.x) > Math.abs(car.z) ? car.z : Math.sign(car.z) * (HALF + 4);
        const ctrl = car.steerToward(tx, tz, 8);
        car.drive(dt, { throttle: 0.8, steer: ctrl.steer, handbrake: false }, this.world, hooks);
        if (Math.abs(car.speed) < 0.5) {
          car.stuckT += dt;
          if (car.stuckT > 3) {
            car.heading = ctrl.want;
            car.stuckT = 0;
          }
        } else {
          car.stuckT = 0;
        }
        continue;
      }
      const lead = 0.45;
      const tx = player.x + (playerVel ? playerVel.x * lead : 0);
      const tz = player.z + (playerVel ? playerVel.z * lead : 0);
      const ctrl = car.steerToward(tx, tz, 0);
      const dist = ctrl.dist;
      const playerSpeed = playerVel ? Math.hypot(playerVel.x, playerVel.z) : 0;
      // Never back away from a suspect already cornered.
      if (dist < 6 && playerSpeed < 3) {
        car.reverseT = 0;
        car.detourT = 0;
      }
      // Stuck rescue: back out for a moment, then resume the route.
      if (car.reverseT > 0) {
        car.reverseT -= dt;
        car.drive(dt, { throttle: -0.8, steer: -ctrl.steer, handbrake: false }, this.world, hooks);
        continue;
      }
      let throttle = 1;
      let handbrake = false;
      let steer = ctrl.steer;
      if (dist >= 30) {
        // Grid mode: route intersection by intersection toward the
        // suspect's block instead of aiming straight through buildings.
        // The waypoint re-picks itself once the car reaches it, so the
        // patrol follows the road grid all the way to the final leg.
        if (car.pwx === undefined || Math.hypot(car.pwx - car.x, car.pwz - car.z) < 6) {
          const node = nextNode(nearestCentre(car.x), nearestCentre(car.z), nearestCentre(player.x), nearestCentre(player.z));
          if (node) {
            car.pwx = node[0];
            car.pwz = node[1];
          } else {
            car.pwx = tx;
            car.pwz = tz;
          }
        }
        steer = car.steerToward(car.pwx, car.pwz, 4).steer;
      } else if (playerSpeed < 3 && dist < 4) {
        // Parked on the suspect: brake and hold.
        throttle = 0;
        handbrake = true;
      } else if (playerSpeed < 3 && dist < 12) {
        // Creep in close before stopping.
        throttle = 0.25;
      }
      if (dist < 30 && Math.abs(angleDiff(ctrl.want, car.heading)) > 1.0 && Math.abs(car.speed) > 5) {
        // Facing away from a close suspect after an overshoot: brake
        // first, turn, then re-accelerate, instead of arcing wide at
        // speed into the nearest building.
        throttle = 0;
        handbrake = true;
      }
      if (car.speed > 34) throttle = Math.min(throttle, 0.2);
      car.drive(dt, { throttle, steer, handbrake }, this.world, hooks);
      if (Math.abs(car.speed) < 1.0 && throttle > 0) {
        car.stuckT += dt;
        if (car.stuckT > 1.0) {
          // The anchor only resets after real progress, so a car cycling
          // in one spot reaches the snap instead of resetting forever.
          if (car.rescueCount === undefined || Math.hypot(car.x - car.rescueX, car.z - car.rescueZ) > 15) {
            car.rescueCount = 0;
            car.rescueX = car.x;
            car.rescueZ = car.z;
          }
          car.rescueCount += 1;
          if (car.rescueCount >= 2) {
            // Wedged after two rescues with no progress: pop onto the
            // nearest intersection and resume the chase from the grid.
            // Never onto the roundabout node itself: that is the fountain.
            let sx = nearestCentre(car.x);
            let sz = nearestCentre(car.z);
            if (sx === ROUNDABOUT.x && sz === ROUNDABOUT.z) {
              const around = [
                [ROUNDABOUT.x, ROUNDABOUT.z - 52],
                [ROUNDABOUT.x - 52, ROUNDABOUT.z],
                [ROUNDABOUT.x + 52, ROUNDABOUT.z],
                [ROUNDABOUT.x, ROUNDABOUT.z + 52],
              ];
              let best = around[0];
              for (const [ax, az] of around) {
                if (Math.hypot(ax - car.x, az - car.z) < Math.hypot(best[0] - car.x, best[1] - car.z)) best = [ax, az];
              }
              [sx, sz] = best;
            }
            car.x = sx;
            car.z = sz;
            car.heading = Math.atan2(tx - car.x, tz - car.z);
            car.speed = 0;
            car.rescueCount = 0;
            car.pwx = undefined;
          }
          car.reverseT = 1.2;
          car.stuckT = 0;
        }
      } else {
        car.stuckT = 0;
      }
    }
    for (let i = this.cars.length - 1; i >= 0; i -= 1) {
      const car = this.cars[i];
      if (car === player.car) continue;
      const far = Math.hypot(car.x - player.x, car.z - player.z) > 130;
      if ((want === 0 && far) || (car.wrecked && want === 0)) {
        car.dispose(this.scene);
        this.cars.splice(i, 1);
      }
    }
  }

  nearestDist(player) {
    let best = Infinity;
    for (const car of this.cars) {
      if (car.wrecked || car === player.car) continue;
      best = Math.min(best, Math.hypot(car.x - player.x, car.z - player.z));
    }
    return best;
  }
}
