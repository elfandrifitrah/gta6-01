// Jakarta Heat world: procedural city geometry, road grid, routing. Written in this session.
import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, range, pick, clamp } from './random.js';

const ROADS = CFG.roads;
export function nearestNode(x, z) {
  let bx = ROADS[0], bz = ROADS[0], bd = 1e18;
  for (const rx of ROADS) for (const rz of ROADS) {
    const d = (x - rx) * (x - rx) + (z - rz) * (z - rz);
    if (d < bd) { bd = d; bx = rx; bz = rz; }
  }
  return [bx, bz];
}
export function bfsPath(from, to, avoid) {
  const key = (n) => n[0] + ',' + n[1];
  const avoidSet = new Set((avoid || []).map(key));
  const start = key(from), goal = key(to);
  if (start === goal) return [from];
  const prev = new Map([[start, null]]);
  const q = [from];
  while (q.length) {
    const n = q.shift();
    for (const d of [[40, 0], [-40, 0], [0, 40], [0, -40]]) {
      const m = [n[0] + d[0], n[1] + d[1]];
      if (m[0] < -80 || m[0] > 80 || m[1] < -80 || m[1] > 80) continue;
      const k = key(m);
      if (avoidSet.has(k) || prev.has(k)) continue;
      prev.set(k, n);
      if (k === goal) {
        const path = [m]; let cur = n;
        while (cur) { path.unshift(cur); cur = prev.get(key(cur)); }
        return path;
      }
      q.push(m);
    }
  }
  return [from, to];
}
export function snapToRoad(x, z) {
  const n = nearestNode(x, z);
  const dx = Math.abs(x - n[0]), dz = Math.abs(z - n[1]);
  if (dx < dz) return [n[0], z];
  return [x, n[1]];
}

function mat(color, opts) { return new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {})); }
function box(scene, w, h, d, x, y, z, color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z); scene.add(m); return m;
}
function cyl(scene, rt, rb, h, x, y, z, color, seg, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat(color, opts));
  m.position.set(x, y, z); scene.add(m); return m;
}
function textTexture(text, bg, fg, w, h) {
  const c = document.createElement('canvas'); c.width = w || 256; c.height = h || 64;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c); return t;
}
function signPlane(scene, text, x, y, z, ry, w, h, bg, fg) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w || 8, h || 2),
    new THREE.MeshBasicMaterial({ map: textTexture(text, bg || '#0b5fa5', fg || '#ffffff') }));
  m.position.set(x, y, z); m.rotation.y = ry || 0; scene.add(m); return m;
}

export function buildWorld(scene) {
  const rng = mulberry32(20261122);
  scene.background = new THREE.Color(0x2e4a7a);
  scene.fog = new THREE.Fog(0xe8905a, 120, 320);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a4a3a, 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb060, 1.6);
  sun.position.set(-60, 80, -40); scene.add(sun);
  // Ground, bay water, roads.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat(0x4a6b3f));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0); scene.add(ground);
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(260, 60), mat(0x1e5f8a));
  bay.rotation.x = -Math.PI / 2; bay.position.set(0, 0, -135); scene.add(bay);
  for (const r of ROADS) {
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(220, 8), mat(0x33363c));
    hRoad.rotation.x = -Math.PI / 2; hRoad.position.set(0, 0, r); scene.add(hRoad);
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(8, 220), mat(0x33363c));
    vRoad.rotation.x = -Math.PI / 2; vRoad.position.set(r, 0, 0); scene.add(vRoad);
    for (let d = -100; d <= 100; d += 10) {
      box(scene, 0.4, 0.02, 3, r + 2.2, 0.02, d, 0xd8d8d8);
      box(scene, 3, 0.02, 0.4, d, 0.02, r + 2.2, 0xd8d8d8);
    }
  }
  // Sudirman busway median lane on x = 0, red, with shelters.
  const busway = new THREE.Mesh(new THREE.PlaneGeometry(4, 200), mat(0x9e2b25));
  busway.rotation.x = -Math.PI / 2; busway.position.set(0, 0.02, 0); scene.add(busway);
  for (const z of [-60, -20, 20, 60]) {
    box(scene, 6, 3, 8, 5, 1.5, z, 0xcc2222);
    box(scene, 6.5, 0.3, 8.5, 5, 3.1, z, 0xdddddd);
  }
  const colliders = [];
  // Roundabout at (40,-40): ring, fountain at centre, flower sculpture.
  const rb = CFG.places.roundabout;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 0.3, 24), mat(0x33363c));
  ring.position.set(rb[0], 0.1, rb[1]); scene.add(ring);
  cyl(scene, 5, 6, 1.2, rb[0], 0.6, rb[1], 0x7fb3d5, 20);
  cyl(scene, 0.4, 0.8, 4, rb[0], 2.5, rb[1], 0xdddddd, 10);
  const flower = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), mat(0xff5fa2, { emissive: 0x881144 }));
  flower.position.set(rb[0], 5.2, rb[1]); flower.scale.y = 0.6; scene.add(flower);
  colliders.push({ x: rb[0], z: rb[1], r: 6 });
  // Monument plaza at (-20,-20): tapered obelisk with gold flame.
  const mo = CFG.places.monument;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), mat(0xb8a888));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(mo[0], 0.05, mo[1]); scene.add(plaza);
  cyl(scene, 2.2, 4.5, 26, mo[0], 13, mo[1], 0xe8e0cc, 4);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5, 8), mat(0xffc400, { emissive: 0xaa7700 }));
  flame.position.set(mo[0], 28.5, mo[1]); scene.add(flame);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cyl(scene, 0.08, 0.08, 7, mo[0] + Math.cos(a) * 14, 3.5, mo[1] + Math.sin(a) * 14, 0x888888, 6);
    box(scene, 1.6, 1, 0.1, mo[0] + Math.cos(a) * 14, 6.2, mo[1] + Math.sin(a) * 14, i % 2 ? 0xffffff : 0xdd1111);
  }
  colliders.push({ x: mo[0], z: mo[1], r: 5 });
  // Ondel-ondel puppets near the plaza.
  for (const [ox, oz, col] of [[-32, -8, 0xd81b60], [-8, -32, 0x1e88e5]]) {
    cyl(scene, 0.9, 1.3, 5, ox, 2.5, oz, col, 8);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), mat(0xffcc99));
    head.position.set(ox, 6, oz); scene.add(head);
    box(scene, 2.4, 0.5, 2.4, ox, 7.2, oz, 0xffd54f);
  }
  // Wayang silhouette panels along the plaza edge.
  for (let i = 0; i < 4; i++) box(scene, 3, 4, 0.2, -34 + i * 9, 2, -4, 0x1a1a1a);
  // Mosque at (20,-60): gold dome, four minarets.
  const mq = CFG.places.mosque;
  box(scene, 18, 6, 14, mq[0], 3, mq[1], 0xf5f0e0);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffc400, { emissive: 0x664400 }));
  dome.position.set(mq[0], 6, mq[1]); scene.add(dome);
  for (const [dx, dz] of [[-9, -7], [9, -7], [-9, 7], [9, 7]]) cyl(scene, 0.7, 0.9, 16, mq[0] + dx, 8, mq[1] + dz, 0xffffff, 8);
  colliders.push({ x: mq[0], z: mq[1], r: 10 });
  // Glass towers along the Sudirman corridor (x near 0).
  const towerCols = [0x2a6f9e, 0x3a7fbf, 0x5a4a8a, 0x2f8f7a];
  for (let i = 0; i < 8; i++) {
    const tx = i % 2 ? 14 : -14, tz = -70 + i * 20;
    const h = 22 + rng() * 26;
    const t = box(scene, 10, h, 10, tx, h / 2, tz, towerCols[i % 4], { emissive: 0x112233 });
    t.material = new THREE.MeshLambertMaterial({ color: towerCols[i % 4], emissive: 0x223344 });
    box(scene, 11, 1, 11, tx, h + 0.5, tz, 0xffaa00);
    colliders.push({ x: tx, z: tz, r: 7 });
  }
  // Billboards with invented brands.
  const bbData = [[-14, -70, 'KOPI SENJA', 0x6d2c0c], [14, -30, 'TEH MELATI', 0x1b5e20], [-14, 10, 'SABUN WANGI', 0x880e4f], [14, 50, 'ES KRIM PELANGI', 0x4a148c]];
  for (const [x, z, txt, bg] of bbData) {
    box(scene, 1, 12, 1, x, 6, z, 0x555555);
    signPlane(scene, txt, x, 13, z, 0, 14, 4, '#' + bg.toString(16).padStart(6, '0'), '#ffffff');
  }
  // Generic blocks: buildings, kampung houses, shophouses, warungs.
  const blocks = [];
  for (const bx of [-60, -20, 20, 60]) for (const bz of [-60, -20, 20, 60]) blocks.push([bx, bz]);
  const special = new Set(['-20,-20', '20,-60', '60,60', '-60,60', '60,-60', '60,20', '60,-20', '-60,-20', '-20,60', '-60,20']);
  for (const [bx, bz] of blocks) {
    if (special.has(bx + ',' + bz)) continue;
    const n = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const w = 8 + rng() * 8, d = 8 + rng() * 8, h = 5 + rng() * 14;
      const x = bx + (rng() - 0.5) * 14, z = bz + (rng() - 0.5) * 14;
      box(scene, w, h, d, x, h / 2, z, pick(rng, [0x9a7b5a, 0x7a8a9a, 0xb0a090, 0x8a6a5a, 0x6a7a5a]));
      box(scene, w + 0.6, 0.8, d + 0.6, x, h + 0.4, z, 0x553322);
      colliders.push({ x, z, r: Math.max(w, d) * 0.7 });
    }
  }
  // Kota Tua colonial shophouses at (60,60).
  for (let i = 0; i < 5; i++) {
    const x = 48 + i * 6;
    box(scene, 5.5, 7, 8, x, 3.5, 62, 0xe8dcc0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 2.5, 4), mat(0x8a3324));
    roof.position.set(x, 8.2, 62); roof.rotation.y = Math.PI / 4; scene.add(roof);
    box(scene, 4, 2, 0.3, x, 2, 57.8, 0x3a5a7a);
  }
  // Kampung quarters: pitched corrugated roofs, laundry lines, small musholla.
  for (const [kx, kz] of [CFG.places.kampungA, CFG.places.kampungB]) {
    for (let i = 0; i < 6; i++) {
      const x = kx + (rng() - 0.5) * 22, z = kz + (rng() - 0.5) * 22;
      box(scene, 5, 3, 4.5, x, 1.5, z, pick(rng, [0xc0a080, 0xa0b0c0, 0xd0c0a0]));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2, 4), mat(0xb03a2e));
      roof.position.set(x, 4, z); roof.rotation.y = Math.PI / 4; scene.add(roof);
    }
    for (let i = 0; i < 3; i++) {
      const x = kx + (rng() - 0.5) * 18, z = kz + (rng() - 0.5) * 18;
      box(scene, 6, 0.1, 0.1, x, 3, z, 0x333333);
      for (let j = 0; j < 3; j++) box(scene, 0.8, 1.1, 0.05, x - 2 + j * 2, 2.4, z, pick(rng, [0xff5252, 0x448aff, 0xffd54f, 0x69f0ae]));
    }
    box(scene, 4, 3, 4, kx + 10, 1.5, kz + 8, 0xffffff);
    const md = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2e7d32));
    md.position.set(kx + 10, 3, kz + 8); scene.add(md);
  }
  // Hotel Merdeka (60,20), warehouse (60,-20), bengkel (-60,-20), chop shop (-20,60), home (-60,20).
  box(scene, 14, 24, 12, 60, 12, 20, 0x3a6ea5, { emissive: 0x0a2030 });
  signPlane(scene, 'HOTEL MERDEKA', 60, 26, 14, 0, 14, 3, '#7a1f1f', '#ffe082');
  colliders.push({ x: 60, z: 20, r: 9 });
  box(scene, 18, 7, 12, 60, 3.5, -20, 0x8a8a8a);
  box(scene, 19, 0.8, 13, 60, 7.4, -20, 0x444444);
  signPlane(scene, 'WAREHOUSE', 60, 9, -13.5, 0, 12, 2.5, '#333333', '#ffffff');
  colliders.push({ x: 60, z: -20, r: 10 });
  box(scene, 12, 5, 10, -60, 2.5, -20, 0x9a7b2a);
  signPlane(scene, 'BENGKEL SUMBER JAYA', -60, 6.5, -14.5, 0, 14, 2.5, '#1b5e20', '#ffffff');
  colliders.push({ x: -60, z: -20, r: 7 });
  box(scene, 12, 5, 10, -20, 2.5, 60, 0x5a3a6a);
  signPlane(scene, 'CHOP SHOP', -20, 6.5, 54.5, 0, 10, 2.5, '#4a148c', '#ffffff');
  colliders.push({ x: -20, z: 60, r: 7 });
  box(scene, 7, 4, 6, -60, 2, 20, 0xd0b090);
  const hr = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2.2, 4), mat(0xb03a2e));
  hr.position.set(-60, 5.1, 20); hr.rotation.y = Math.PI / 4; scene.add(hr);
  colliders.push({ x: -60, z: 20, r: 5 });
  // Port at z -100: cranes, containers, fishing boats.
  for (let i = 0; i < 3; i++) {
    const x = -50 + i * 50;
    box(scene, 3, 22, 3, x, 11, -100, 0xffa000);
    box(scene, 24, 2, 2, x, 20, -100, 0xffa000);
    box(scene, 2, 8, 2, x + 10, 16, -100, 0xffa000);
  }
  for (let i = 0; i < 10; i++) {
    const x = -70 + (i % 5) * 14, z = -96 + Math.floor(i / 5) * 6;
    box(scene, 8, 2.5, 3, x, 1.25, z, pick(rng, [0xc62828, 0x1565c0, 0x2e7d32, 0xef6c00]));
  }
  for (let i = 0; i < 4; i++) {
    const x = -60 + i * 40;
    box(scene, 10, 1.5, 3, x, 0.7, -122, 0x6d4c41);
    box(scene, 2, 3, 2, x, 2.5, -122, 0xffffff);
  }
  // Elevated toll road on the west edge, coastal flyover over the bay.
  box(scene, 8, 1, 220, -104, 8, 0, 0x555a60);
  for (let z = -100; z <= 100; z += 20) box(scene, 2, 8, 2, -104, 4, z, 0x777777);
  box(scene, 220, 1, 8, 0, 8, -112, 0x555a60);
  for (let x = -100; x <= 100; x += 20) box(scene, 2, 8, 2, x, 4, -112, 0x777777);
  // MRT line on the north edge with two stations.
  box(scene, 220, 0.6, 3, 0, 5, -90, 0x888888);
  for (let z = -100; z <= -80; z += 10) box(scene, 1.5, 5, 1.5, -100, 2.5, z, 0x777777);
  for (let z = -100; z <= -80; z += 10) box(scene, 1.5, 5, 1.5, 100, 2.5, z, 0x777777);
  const mrtTrain = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 3), mat(0xe0e0e0));
    car.position.x = i * 10; mrtTrain.add(car);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(9.1, 0.8, 3.1), mat(0x1565c0));
    stripe.position.x = i * 10; stripe.position.y = -0.5; mrtTrain.add(stripe);
  }
  mrtTrain.position.set(-80, 6.8, -90); scene.add(mrtTrain);
  for (const [sx, sz] of [CFG.places.mrtA, CFG.places.mrtB]) {
    box(scene, 10, 4, 6, sx, 2, sz, 0xdddddd);
    signPlane(scene, 'MRT', sx, 5.5, sz + 3.2, 0, 6, 2, '#1565c0', '#ffffff');
  }
  // Street signs, warung stalls, palms, banyans, cones, ojek and bajaj stands.
  const signSpots = [[-4, -80], [4, -40], [-4, 0], [4, 40], [-80, -4], [-40, 4], [0, -4], [40, 4]];
  CFG.signs.forEach((s, i) => {
    const [x, z] = signSpots[i % signSpots.length];
    box(scene, 0.2, 3, 0.2, x, 1.5, z, 0x666666);
    signPlane(scene, s, x, 3.2, z, 0, 7, 1.4, '#0b5fa5', '#ffffff');
  });
  CFG.warungs.forEach((w, i) => {
    const x = -70 + i * 45, z = 70;
    box(scene, 5, 2.5, 4, x, 1.25, z, 0x8d6e63);
    box(scene, 5.5, 0.3, 4.5, x, 2.7, z, pick(rng, [0xd81b60, 0x00897b, 0xf9a825]));
    signPlane(scene, w.toUpperCase(), x, 3.6, z + 2.3, 0, 8, 1.6, '#333333', '#ffe082');
  });
  for (let i = 0; i < 26; i++) {
    const x = range(rng, -95, 95), z = range(rng, -95, 95);
    if (Math.abs(x % 40) < 6 || Math.abs(z % 40) < 6) continue;
    cyl(scene, 0.25, 0.35, 5, x, 2.5, z, 0x6d4c41, 6);
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), mat(0x2e7d32));
    top.position.set(x, 5.8, z); top.scale.y = 0.55; scene.add(top);
  }
  for (let i = 0; i < 8; i++) {
    const x = range(rng, -90, 90), z = range(rng, -90, 90);
    cyl(scene, 0.3, 0.3, 0.7, x, 0.35, z, 0xff6d00, 8);
  }
  for (const [ox, oz] of [[-20, 44], [20, -44]]) {
    box(scene, 6, 2.5, 4, ox, 1.25, oz, 0x2e7d32);
    signPlane(scene, 'OJEK', ox, 3.4, oz + 2.2, 0, 5, 1.5, '#2e7d32', '#ffffff');
  }
  box(scene, 6, 2.5, 4, -44, 1.25, 20, 0xef6c00);
  signPlane(scene, 'BAJAJ', -44, 3.4, 22.2, 0, 5, 1.5, '#ef6c00', '#ffffff');
  // Umbul-umbul pennants along Sudirman.
  for (let z = -80; z <= 80; z += 16) {
    cyl(scene, 0.06, 0.06, 5, -6, 2.5, z, 0x888888, 5);
    box(scene, 0.7, 2.2, 0.05, -6, 4, z, z % 32 === 0 ? 0xdd1111 : 0xffffff);
  }
  return {
    colliders,
    update(dt, t) {
      mrtTrain.position.x = -80 + ((t * 6) % 200);
      if (mrtTrain.position.x > 90) mrtTrain.position.x = -110;
    },
  };
}
export function collideCircle(colliders, x, z, r) {
  for (const c of colliders) {
    const dx = x - c.x, dz = z - c.z;
    const d2 = dx * dx + dz * dz, rr = c.r + r;
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      return { x: c.x + (dx / d) * rr, z: c.z + (dz / d) * rr };
    }
  }
  return null;
}
