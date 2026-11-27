// People: pedestrians and enemies. Written in this session.
import * as THREE from 'three';
import { mulberry32, pick, range, clamp, angleLerp } from './random.js';
import { CFG } from './config.js';
import { audio } from './audio.js';

const SHIRTS = [0xffffff, 0x1565c0, 0xd81b60, 0x2e7d32, 0xef6c00, 0x6a1b9a, 0x00897b, 0xc62828];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const HIJABS = [0xd81b60, 0x1565c0, 0x2e7d32, 0x6a1b9a, 0xef6c00, 0x795548];

function makePersonMesh(style) {
  const g = new THREE.Group();
  const skin = pick(style.rng, SKINS);
  const shirt = style.shirt !== undefined ? style.shirt : pick(style.rng, SHIRTS);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32), new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.7; g.add(head);
  if (style.hijab) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: style.hijab }));
    h.position.y = 1.74; h.scale.set(1, 1.1, 1); g.add(h);
  }
  if (style.helmet) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    h.position.y = 1.76; g.add(h);
  }
  if (style.vest) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.36), new THREE.MeshLambertMaterial({ color: 0xffee58 }));
    v.position.y = 1.05; g.add(v);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.18, 10), new THREE.MeshLambertMaterial({ color: 0xffee58 }));
    hat.position.y = 1.95; g.add(hat);
  }
  const legM = new THREE.MeshLambertMaterial({ color: style.legs !== undefined ? style.legs : 0x333a44 });
  for (const lx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), legM);
    leg.position.set(lx, 0.3, 0); g.add(leg);
  }
  if (style.apron) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.8, 0.06), new THREE.MeshLambertMaterial({ color: 0x4e342e }));
    a.position.set(0, 1.0, 0.2); g.add(a);
  }
  return g;
}

export function createPeopleSystem(scene, G) {
  const rng = mulberry32(4242);
  const group = new THREE.Group(); scene.add(group);
  const peds = [];
  const enemies = [];
  const styles = [
    { shirt: 0xffffff, legs: 0x222222 }, // white shirt with tie look
    { shirt: 0x1a237e, legs: 0x222222 }, // blazer
    { shirt: 0x2e7d32, helmet: true }, // ojek jacket
    { shirt: 0x1565c0, legs: 0x1a237e }, // security uniform
    { apron: true }, // vendor
    { hijab: pick(rng, HIJABS) },
    { shirt: 0xf5f5f5, legs: 0x3a5a7a }, // student dress
    { vest: true }, // construction
    {}, // casual
  ];
  function spawnPed(x, z) {
    const style = Object.assign({ rng }, pick(rng, styles));
    const mesh = makePersonMesh(style);
    const p = { mesh, x, z, angle: rng() * Math.PI * 2, speed: range(rng, 1, 1.8), tx: x, tz: z, flee: 0 };
    mesh.position.set(x, 0, z); group.add(mesh); peds.push(p);
    return p;
  }
  for (let i = 0; i < 24; i++) {
    const road = pick(rng, CFG.roads);
    const along = range(rng, -90, 90);
    if (rng() > 0.5) spawnPed(road + 5, along); else spawnPed(along, road + 5);
  }
  function spawnEnemy(x, z, label) {
    const mesh = makePersonMesh({ rng, shirt: label === 'ambusher' ? 0x4e342e : 0xb71c1c, legs: 0x111111 });
    const e = { mesh, x, z, angle: 0, health: CFG.enemyHealth, speed: 3.2, attackT: 0, shootT: 1.15, stun: 0, label: label || 'rival', dead: false };
    mesh.position.set(x, 0, z); group.add(mesh); enemies.push(e);
    return e;
  }
  function clearEnemies() {
    // Iterate a snapshot so a mid-update death cannot crash mission cleanup.
    for (const e of [...enemies]) group.remove(e.mesh);
    enemies.length = 0;
  }
  function update(dt) {
    const p = G.player;
    for (const ped of peds) {
      if (ped.flee > 0) {
        ped.flee -= dt;
        const dx = ped.x - p.x, dz = ped.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        ped.x += (dx / d) * 4 * dt; ped.z += (dz / d) * 4 * dt;
      } else {
        const dx = ped.tx - ped.x, dz = ped.tz - ped.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.8) {
          const road = pick(rng, CFG.roads);
          if (rng() > 0.5) { ped.tx = road + 5; ped.tz = range(rng, -90, 90); }
          else { ped.tx = range(rng, -90, 90); ped.tz = road + 5; }
        } else {
          ped.x += (dx / d) * ped.speed * dt; ped.z += (dz / d) * ped.speed * dt;
          ped.angle = Math.atan2(dx, dz);
        }
      }
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.angle;
    }
    // Enemies chase the player and punch in range. Snapshot iteration for safety.
    for (const e of [...enemies]) {
      if (e.dead) continue;
      const dx = p.x - e.x, dz = p.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      e.angle = Math.atan2(dx, dz);
      e.stun -= dt;
      if (e.stun <= 0) {
        if (d > 8) { e.x += (dx / d) * e.speed * dt; e.z += (dz / d) * e.speed * dt; }
        else if (d > 3.4) { e.x += (-dz / d) * e.speed * 0.65 * dt; e.z += (dx / d) * e.speed * 0.65 * dt; }
      }
      e.attackT -= dt;
      if (d < 1.9 && e.attackT <= 0 && G.screen === 'play') {
        e.attackT = 0.9;
        G.damagePlayer(6);
        audio.punch();
      }
      if (G.screen === 'play' && d > 4 && d < 22 && e.stun <= 0) {
        e.shootT -= dt;
        if (e.shootT <= 0) {
          e.shootT = 1.45;
          if (G.tracer) G.tracer(e.x, 1.4, e.z, p.x, 1.2, p.z, 0xff8a65);
          audio.shot();
          const hit = d < 12 ? 0.85 : 0.5;
          if (Math.random() < hit) {
            if (G.playerCar) G.playerCar.health -= 4;
            G.damagePlayer(G.playerCar ? 2 : 5);
            G.shake = Math.max(G.shake || 0, 0.22);
          }
        }
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.angle;
    }
  }
  function scarePeds(x, z) {
    for (const ped of peds) {
      if (Math.hypot(ped.x - x, ped.z - z) < 12) ped.flee = 3;
    }
  }
  return { peds, enemies, spawnPed, spawnEnemy, clearEnemies, update, scarePeds, makePersonMesh, group };
}
