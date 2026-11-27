// Vehicles: traffic, bikes, buses, player driving, police routing. Written in this session.
import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, pick, range, clamp, angleLerp, dist2 } from './random.js';
import { nearestNode, bfsPath, snapToRoad } from './world.js';
import { audio } from './audio.js';

const CAR_COLORS = [0xd32f2f, 0x1565c0, 0xf9f9f9, 0x222222, 0x9e9e9e, 0xef6c00, 0x2e7d32, 0x7b1fa2];
const ROUNDABOUT_NODE = [40, -40];

function makeCarMesh(color, kind) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(kind === 'bus' ? 3 : 2, 0.9, kind === 'bus' ? 10 : 4.2),
    new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.7; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, kind === 'bus' ? 9 : 2.2),
    new THREE.MeshLambertMaterial({ color: 0x222831 }));
  cab.position.y = 1.5; cab.position.z = kind === 'bus' ? 0 : -0.2; g.add(cab);
  const wheelG = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelM = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelG, wheelM);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.6), new THREE.MeshLambertMaterial({ color: 0xffd54f }));
    sign.position.y = 2.1; g.add(sign);
  }
  if (kind === 'angkot') {
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    board.position.set(0, 1.2, 2.15); g.add(board);
  }
  return g;
}
function makeBikeMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.9), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.6; g.add(body);
  const rider = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.5), new THREE.MeshLambertMaterial({ color: 0x2e7d32 }));
  rider.position.y = 1.3; g.add(rider);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  helm.position.y = 1.95; g.add(helm);
  const wheelG = new THREE.CylinderGeometry(0.32, 0.32, 0.15, 8);
  const wheelM = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const wz of [0.8, -0.8]) {
    const w = new THREE.Mesh(wheelG, wheelM);
    w.rotation.z = Math.PI / 2; w.position.set(0, 0.32, wz); g.add(w);
  }
  return g;
}
function makePoliceMesh() {
  const g = makeCarMesh(0x1a237e, 'sedan');
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.5), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x880000 }));
  bar.position.y = 2.05; g.add(bar);
  g.userData.lightBar = bar;
  return g;
}

export function createVehicleSystem(scene, G) {
  const rng = mulberry32(777);
  const traffic = [];
  const bikes = [];
  const police = [];
  const group = new THREE.Group(); scene.add(group);
  function addTraffic(kind) {
    const node = [pick(rng, CFG.roads), pick(rng, CFG.roads)];
    const color = kind === 'taxi' ? 0xffc400 : kind === 'angkot' ? 0x43a047 : kind === 'bus' ? 0xc62828 : pick(rng, CAR_COLORS);
    const mesh = kind === 'bike' ? makeBikeMesh(pick(rng, CAR_COLORS)) : makeCarMesh(color, kind);
    const v = {
      kind, mesh, x: node[0], z: node[1], angle: pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      speed: kind === 'bus' ? 8 : kind === 'bike' ? 11 : range(rng, 8, 12),
      path: null, pathIdx: 0, lane: 2, weave: rng() * Math.PI * 2,
    };
    mesh.position.set(v.x, 0, v.z); mesh.rotation.y = v.angle;
    group.add(mesh);
    if (kind === 'bike') bikes.push(v); else traffic.push(v);
    return v;
  }
  for (let i = 0; i < 14; i++) addTraffic(pick(rng, ['sedan', 'sedan', 'mpv', 'taxi', 'angkot', 'van', 'pickup', 'truck']));
  addTraffic('bus'); addTraffic('bus');
  for (let i = 0; i < 8; i++) addTraffic('bike');
  function randomPath(v) {
    const from = nearestNode(v.x, v.z);
    const to = [pick(rng, CFG.roads), pick(rng, CFG.roads)];
    v.path = bfsPath(from, to, [ROUNDABOUT_NODE]);
    v.pathIdx = 0;
  }
  function driveAlong(v, dt, speed) {
    if (!v.path || v.pathIdx >= v.path.length) randomPath(v);
    const target = v.path[v.pathIdx];
    const dx = target[0] - v.x, dz = target[1] - v.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) { v.pathIdx++; return; }
    const want = Math.atan2(dx, dz);
    v.angle = angleLerp(v.angle, want, Math.min(1, dt * 3));
    // Left-hand traffic: keep to the left of the direction of travel.
    const lx = Math.cos(v.angle) * v.lane, lz = -Math.sin(v.angle) * v.lane;
    const tx = target[0] + lx, tz = target[1] + lz;
    const tdx = tx - v.x, tdz = tz - v.z;
    const td = Math.hypot(tdx, tdz) || 1;
    v.x += (tdx / td) * speed * dt;
    v.z += (tdz / td) * speed * dt;
    v.mesh.position.set(v.x, 0, v.z);
    v.mesh.rotation.y = v.angle;
  }
  function spawnPolice() {
    if (police.length >= 4) return null;
    const p = G.player;
    let node = nearestNode(p.x + range(rng, 50, 70) * (rng() > 0.5 ? 1 : -1), p.z + range(rng, 50, 70) * (rng() > 0.5 ? 1 : -1));
    node = [clamp(node[0], -80, 80), clamp(node[1], -80, 80)];
    if (node[0] === ROUNDABOUT_NODE[0] && node[1] === ROUNDABOUT_NODE[1]) node = [0, -40];
    const mesh = makePoliceMesh();
    const v = { kind: 'police', mesh, x: node[0], z: node[1], angle: 0, speed: 17, path: null, pathIdx: 0, repath: 0, lightT: 0, lane: 2, weave: 0, shootT: 0.8 };
    mesh.position.set(v.x, 0, v.z); group.add(mesh); police.push(v);
    return v;
  }
  function updatePolice(dt) {
    const p = G.player;
    const want = G.wanted > 0 ? Math.min(4, 1 + Math.floor(G.wanted / 2)) : 0;
    while (police.length < want) spawnPolice();
    while (police.length > want) { const v = police.pop(); group.remove(v.mesh); }
    for (const v of police) {
      v.lightT += dt;
      v.mesh.userData.lightBar.material.emissive.setHex(Math.floor(v.lightT * 4) % 2 ? 0xff0000 : 0x0000ff);
      v.repath -= dt;
      const pd = Math.hypot(p.x - v.x, p.z - v.z);
      if (pd < 25) {
        // Close pursuit: drive straight at the player, braking before turning.
        const want = Math.atan2(p.x - v.x, p.z - v.z);
        let diff = want - v.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const sp = Math.abs(diff) > 0.9 ? 5 : 19;
        v.angle = angleLerp(v.angle, want, Math.min(1, dt * 4));
        v.x += Math.sin(v.angle) * sp * dt;
        v.z += Math.cos(v.angle) * sp * dt;
      } else {
        if (v.repath <= 0 || !v.path || v.pathIdx >= v.path.length) {
          const from = nearestNode(v.x, v.z);
          const to = nearestNode(p.x, p.z);
          v.path = bfsPath(from, to, [ROUNDABOUT_NODE]);
          v.pathIdx = 0; v.repath = 2;
          // Roundabout-aware snap rescue: a police car off the grid snaps to its nearest road.
          const snapped = snapToRoad(v.x, v.z);
          if (Math.hypot(snapped[0] - v.x, snapped[1] - v.z) > 12) { v.x = snapped[0]; v.z = snapped[1]; }
        }
        driveAlong(v, dt, 17);
      }
      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.rotation.y = v.angle;
      if (pd < 5) G.bustMeter += dt;
      else if (G.screen === 'play' && G.wanted >= 2 && pd < 32) {
        v.shootT = (v.shootT || 0) - dt;
        if (v.shootT <= 0) {
          v.shootT = Math.max(0.7, 1.5 - G.wanted * 0.12);
          if (G.tracer) G.tracer(v.x, 1.5, v.z, p.x, 1.2, p.z, 0xffe082);
          audio.shot();
          G.shake = Math.max(G.shake || 0, 0.28);
          if (G.playerCar) G.playerCar.health -= 6;
          G.damagePlayer(G.playerCar ? 3 : 6);
        }
      }
    }
    if (police.length === 0) G.bustMeter = Math.max(0, G.bustMeter - dt);
  }
  function update(dt) {
    for (const v of traffic) {
      if (v.driven) continue;
      if (v.hold) {
        v.holdT = (v.holdT || 0) + dt;
        const crawl = Math.max(0.25, 1.3 + Math.sin(v.holdT * 0.85 + v.weave) * 1.2);
        const nx = v.x + Math.sin(v.angle) * crawl * dt;
        const nz = v.z + Math.cos(v.angle) * crawl * dt;
        if (Math.hypot(nx - v.homeX, nz - v.homeZ) < 7) { v.x = nx; v.z = nz; }
        else v.angle += Math.PI;
        v.mesh.position.set(v.x, 0, v.z);
        v.mesh.rotation.y = v.angle;
        continue;
      }
      driveAlong(v, dt, v.speed);
    }
    for (const v of bikes) {
      if (v.driven) continue;
      v.weave += dt * 2;
      const save = v.lane; v.lane = 2 + Math.sin(v.weave) * 1.6;
      driveAlong(v, dt, v.speed);
      v.lane = save;
    }
    updatePolice(dt);
    // Traffic avoids the player car roughly: slow when close ahead.
    const pc = G.playerCar;
    if (pc) {
      for (const v of [...traffic, ...bikes]) {
        if (v.hold) continue;
        const d = dist2(v.x, v.z, pc.x, pc.z);
        if (d < 36) { v.x += Math.sin(v.angle) * -0.5 * dt * 10; }
      }
    }
  }
  function nearestCar(x, z, maxD) {
    let best = null, bd = maxD * maxD;
    for (const v of [...traffic, ...bikes, ...police]) {
      const d = dist2(x, z, v.x, v.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  function removeVehicle(v) {
    group.remove(v.mesh);
    for (const arr of [traffic, bikes, police]) {
      const i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1);
    }
  }
  function spawnMissionCar(x, z, color, kind) {
    const mesh = makeCarMesh(color, kind || 'sport');
    const v = { kind: kind || 'sport', mesh, x, z, angle: 0, speed: 0, path: null, pathIdx: 0, lane: 2, weave: 0, missionCar: true, health: 100 };
    mesh.position.set(x, 0, z); group.add(mesh); traffic.push(v);
    return v;
  }
  function spawnJam(x, z, angle, color) {
    const v = spawnMissionCar(x, z, color, 'sedan');
    v.hold = true;
    v.angle = angle;
    v.homeX = x;
    v.homeZ = z;
    v.weave = (x + z) * 0.17;
    v.speed = 2;
    v.mesh.rotation.y = angle;
    return v;
  }
  return { traffic, bikes, police, update, nearestCar, removeVehicle, spawnMissionCar, spawnJam, makeCarMesh, makeBikeMesh, group };
}
