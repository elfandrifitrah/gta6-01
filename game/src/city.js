// Jakarta Heat's city: a procedural Jakarta built from one seed. A wide Sudirman-style
// avenue runs north to south, a monument plaza anchors the north, kampung alleys fill the
// south-west, and a working port with water closes the east edge.

import { BUILDING_COLORS, PALETTE, SIGN_TEXTS, TOWER_COLORS, WORLD } from './config.js';
import { createRng } from './rng.js';

const ROAD_COORDS = [-180, -120, -60, 0, 60, 120, 180];
const PLAZA = { x0: -42, x1: 42, z0: -172, z1: -128 };

function halfAt(coord) { return coord === WORLD.avenueX ? WORLD.avenueHalf : WORLD.roadHalf; }

function isKampung(cx, cz) { return cx < -30 && cz > 30; }
function isTowerBlock(cx, cz) { return Math.abs(cx) === 30 && cz >= -90 && cz <= 90; }

export function generateCity(seed) {
  const rng = createRng(seed);
  const buildings = [];
  const props = [];
  const signs = [];
  const ground = [];
  const colliders = [];
  const skyline = [];

  function addCollider(x, z, w, d) {
    colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  }
  function addBuilding(x, z, w, d, h, color, kind) {
    const b = { x, z, w, d, h, color, kind, winSeed: rng.int(0, 9999), lit: rng.chance(0.5) };
    buildings.push(b);
    addCollider(x, z, w, d);
    return b;
  }

  // Ground: dirt base, water, roads, port concrete, sidewalks, plaza paving.
  ground.push({ pts: [[-260, -260], [260, -260], [260, 260], [-260, 260]], y: -0.06, color: PALETTE.grass, kind: 'base' });
  ground.push({ pts: [[WORLD.waterX, -260], [300, -260], [300, 260], [WORLD.waterX, 260]], y: -0.02, color: PALETTE.water, kind: 'water' });
  for (const c of ROAD_COORDS) {
    const h = halfAt(c);
    ground.push({ pts: [[c - h, -240], [c + h, -240], [c + h, 240], [c - h, 240]], y: 0.02, color: PALETTE.road, kind: 'road' });
    ground.push({ pts: [[-240, c - WORLD.roadHalf], [240, c - WORLD.roadHalf], [240, c + WORLD.roadHalf], [-240, c + WORLD.roadHalf]], y: 0.02, color: PALETTE.road, kind: 'road' });
  }
  ground.push({ pts: [[180, -240], [WORLD.waterX, -240], [WORLD.waterX, 240], [180, 240]], y: 0.06, color: PALETTE.port, kind: 'port' });
  ground.push({ pts: [[PLAZA.x0, PLAZA.z0], [PLAZA.x1, PLAZA.z0], [PLAZA.x1, PLAZA.z1], [PLAZA.x0, PLAZA.z1]], y: 0.12, color: PALETTE.plaza, kind: 'plaza' });
  ground.push({ pts: [[-30, -162], [30, -162], [30, -138], [-30, -138]], y: 0.14, color: [188, 166, 138], kind: 'plaza' });
  ground.push({ pts: [[-14, -158], [14, -158], [14, -142], [-14, -142]], y: 0.16, color: [204, 182, 152], kind: 'plaza' });

  // Lane dashes on the avenue and the cross streets.
  for (let z = -110; z < 240; z += 9) {
    ground.push({ pts: [[-0.35, z], [0.35, z], [0.35, z + 3.4], [-0.35, z + 3.4]], y: 0.04, color: PALETTE.roadLine, kind: 'dash' });
  }
  for (const c of [-120, 0, 120]) {
    for (let x = -230; x < 180; x += 9) {
      ground.push({ pts: [[x, c - 0.35], [x + 3.4, c - 0.35], [x + 3.4, c + 0.35], [x, c + 0.35]], y: 0.04, color: PALETTE.roadLine, kind: 'dash' });
    }
  }

  // Blocks between the roads.
  for (let i = 0; i < ROAD_COORDS.length - 1; i += 1) {
    for (let j = 0; j < ROAD_COORDS.length - 1; j += 1) {
      const x0 = ROAD_COORDS[i] + halfAt(ROAD_COORDS[i]);
      const x1 = ROAD_COORDS[i + 1] - halfAt(ROAD_COORDS[i + 1]);
      const z0 = ROAD_COORDS[j] + WORLD.roadHalf;
      const z1 = ROAD_COORDS[j + 1] - WORLD.roadHalf;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (cx > -45 && cx < 45 && cz > -175 && cz < -125) continue; // the plaza stays open
      ground.push({ pts: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y: 0.1, color: PALETTE.sidewalk, kind: 'walk' });
      const bw = x1 - x0;
      const bd = z1 - z0;
      if (cx === -30 && cz === 30) {
        // Bu Ratna's block: buildings only at the back, the warung corner stays open.
        addBuilding(-40, 44, 16, 12, 12, rng.pick(BUILDING_COLORS), 'block');
        addBuilding(-20, 42, 14, 12, 18, rng.pick(BUILDING_COLORS), 'block');
      } else if (cx === -150 && cz === 150) {
        // The mission alley block: houses ring a courtyard that always stays open.
        for (const [ox, oz] of [[16, 16], [16, -16], [-16, 16], [-16, -16], [16, 0], [-16, 0], [0, 16], [0, -16]]) {
          addBuilding(cx + ox, cz + oz, 9, 9, rng.range(4, 7), rng.pick(BUILDING_COLORS), 'house');
        }
      } else if (isKampung(cx, cz)) {
        for (let gx = 0; gx < 3; gx += 1) {
          for (let gz = 0; gz < 3; gz += 1) {
            if (rng.chance(0.14)) continue;
            const hx = x0 + 4 + gx * ((bw - 8) / 3) + rng.range(-1, 1);
            const hz = z0 + 4 + gz * ((bd - 8) / 3) + rng.range(-1, 1);
            addBuilding(hx, hz, rng.range(7, 10), rng.range(7, 10), rng.range(3.5, 7), rng.pick(BUILDING_COLORS), 'house');
          }
        }
        if (rng.chance(0.7)) {
          const sx = x0 + rng.range(6, bw - 6);
          const sz = z0 + rng.range(6, bd - 6);
          props.push({ kind: 'stall', x: sx, z: sz, rot: rng.range(0, Math.PI * 2), sign: rng.pick(SIGN_TEXTS) });
          addCollider(sx, sz, 4, 3);
        }
      } else if (isTowerBlock(cx, cz)) {
        const n = rng.chance(0.5) ? 1 : 2;
        for (let t = 0; t < n; t += 1) {
          const tx = n === 1 ? cx : x0 + bw * (0.28 + 0.44 * t);
          const tz = cz + rng.range(-6, 6);
          addBuilding(tx, tz, rng.range(16, 22), rng.range(16, 22), rng.range(30, 62), rng.pick(TOWER_COLORS), 'tower');
        }
      } else {
        const cols = rng.chance(0.5) ? 2 : 1;
        for (let gx = 0; gx < cols; gx += 1) {
          for (let gz = 0; gz < 2; gz += 1) {
            const bx = x0 + bw * ((gx + 0.5) / cols) + rng.range(-2, 2);
            const bz = z0 + bd * (gz === 0 ? 0.28 : 0.72) + rng.range(-2, 2);
            const b = addBuilding(bx, bz, rng.range(13, 19), rng.range(11, 15), rng.range(9, 26), rng.pick(BUILDING_COLORS), 'block');
            if (rng.chance(0.3)) {
              const s = rng.pick(SIGN_TEXTS);
              signs.push({ x: bx, y: rng.range(4.5, 6.5), z: bz + b.d / 2 + 0.6, w: 9, h: 2.6, text: s[0], sub: s[1], bg: [24, 22, 30], fg: [255, 214, 130] });
            }
          }
        }
      }
      // Street trees on the block corners.
      for (const [tx, tz] of [[x0 + 2, z0 + 2], [x1 - 2, z0 + 2], [x0 + 2, z1 - 2], [x1 - 2, z1 - 2]]) {
        if (rng.chance(0.6)) {
          props.push({ kind: 'tree', x: tx, z: tz, s: rng.range(0.8, 1.3), rot: rng.range(0, 6) });
          addCollider(tx, tz, 0.8, 0.8);
        }
      }
    }
  }

  // The monument: stepped base, tapering shaft, flame, flags, planters.
  props.push({ kind: 'monument', x: 0, z: -150 });
  addCollider(0, -150, 12, 12);
  for (const [fx, fz] of [[-20, -160], [20, -160], [-20, -140], [20, -140]]) {
    props.push({ kind: 'flagpole', x: fx, z: fz });
    addCollider(fx, fz, 0.6, 0.6);
  }
  for (const [px, pz] of [[-30, -150], [30, -150], [-10, -166], [10, -166], [-10, -134], [10, -134]]) {
    props.push({ kind: 'planter', x: px, z: pz });
    addCollider(px, pz, 3, 3);
  }

  // Bu Ratna's warung, the story's home corner.
  props.push({ kind: 'stall', x: -44, z: 14, rot: 0.6, sign: ['WARUNG BU RATNA', 'nasi goreng · kopi tubruk'] });
  addCollider(-44, 14, 5, 4);
  signs.push({ x: -44, y: 5.2, z: 14, w: 12, h: 3, text: 'WARUNG BU RATNA', sub: 'nasi goreng · kopi tubruk', bg: [120, 30, 26], fg: [255, 232, 180] });

  // Avenue billboards.
  const boards = [
    [-14, -60, 'SELAMAT DATANG', 'di Jakarta'],
    [14, 20, 'JAKARTA HEAT', 'a fictional Jakarta · 2026'],
    [-14, 110, 'MONAS', 'Jakarta 2026'],
    [14, -100, 'KOPI', 'kopi tubruk asli'],
  ];
  for (const [bx, bz, text, sub] of boards) {
    props.push({ kind: 'billboard', x: bx, z: bz });
    addCollider(bx, bz, 1.2, 1.2);
    signs.push({ x: bx, y: 9, z: bz, w: 16, h: 5, text, sub, bg: [30, 26, 44], fg: [255, 214, 130] });
  }

  // Street lamps along the roads.
  for (const c of ROAD_COORDS) {
    for (let t = -210; t <= 210; t += 60) {
      const lx = c + halfAt(c) + 1.2;
      props.push({ kind: 'lamp', x: lx, z: t });
      props.push({ kind: 'lamp', x: t, z: c + WORLD.roadHalf + 1.2 });
    }
  }

  // The port: warehouses, container stacks, cranes, a quay wall.
  // Three warehouses along the quay; the mission warehouse stands apart at (212, 90),
  // so no two warehouse colliders overlap and the ledger stays reachable.
  for (let i = 0; i < 3; i += 1) {
    const wz = -150 + i * 90;
    addBuilding(206, wz, 22, 34, 12, [150, 142, 128], 'warehouse');
  }
  addBuilding(212, 90, 24, 30, 13, [168, 120, 90], 'warehouse');
  const containerColors = [[180, 60, 40], [40, 110, 160], [200, 140, 40], [60, 130, 80], [150, 150, 150]];
  for (let i = 0; i < 26; i += 1) {
    const cx = rng.range(190, 224);
    const cz = rng.range(-170, 170);
    if (Math.abs(cz - 90) < 24 && cx > 198) continue;
    // Keep the mission's port points clear: gate, ledger approach, escape car.
    if (Math.hypot(cx - 187, cz - 30) < 14) continue;
    if (Math.hypot(cx - 212, cz - 109) < 12) continue;
    if (Math.hypot(cx - 192, cz - 112) < 12) continue;
    const stack = rng.int(1, 3);
    for (let s = 0; s < stack; s += 1) {
      props.push({ kind: 'container', x: cx, z: cz, y: s * 2.7, color: rng.pick(containerColors), rot: rng.chance(0.5) ? 0 : Math.PI / 2 });
    }
    addCollider(cx, cz, 7, 3.2);
  }
  for (const cz of [-120, -20, 80, 170]) {
    props.push({ kind: 'crane', x: 226, z: cz });
    addCollider(226, cz, 4, 4);
  }
  props.push({ kind: 'quay', x: 231, z: 0 });

  // Far skyline silhouettes beyond the playable edge.
  for (let i = 0; i < 30; i += 1) {
    const a = (i / 30) * Math.PI * 2 + rng.range(-0.05, 0.05);
    const r = WORLD.skylineR + rng.range(-12, 18);
    skyline.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, w: rng.range(18, 34), h: rng.range(38, 95), d: rng.range(18, 30) });
  }

  // Road graph: intersections with neighbours, minus the avenue edge cut by the plaza.
  const nodes = [];
  const nodeAt = new Map();
  for (const x of ROAD_COORDS) {
    for (const z of ROAD_COORDS) {
      const node = { x, z, links: [] };
      nodes.push(node);
      nodeAt.set(`${x},${z}`, node);
    }
  }
  for (const node of nodes) {
    for (const [dx, dz] of [[60, 0], [-60, 0], [0, 60], [0, -60]]) {
      const other = nodeAt.get(`${node.x + dx},${node.z + dz}`);
      if (!other) continue;
      if (node.x === 0 && other.x === 0 && ((node.z === -180 && other.z === -120) || (node.z === -120 && other.z === -180))) continue;
      node.links.push(other);
    }
  }

  const places = {
    warung: { x: -44, z: 14 },
    playerStart: { x: -60, z: 20 },
    missionCar: { x: -60, z: 36 },
    plaza: { x: 0, z: -150 },
    plazaContact: { x: 10, z: -138 },
    kampungAlley: { x: -150, z: 150 },
    suitcase: { x: -153, z: 153 },
    raceStart: { x: 0, z: 80 },
    portGate: { x: 187, z: 30 },
    warehouse: { x: 212, z: 90 },
    ledger: { x: 212, z: 109 },
    escapeCar: { x: 192, z: 112 },
    hospital: { x: 60, z: 30 },
    policePost: { x: -60, z: -30 },
  };

  return { seed, roads: ROAD_COORDS, ground, buildings, props, signs, colliders, skyline, nodes, places };
}

/** Push a circle out of building colliders, the world edge and the water. Returns hit flag. */
export function collideCircle(city, pos, radius) {
  let hit = false;
  const limit = WORLD.half - 2;
  if (pos.x < -limit) { pos.x = -limit; hit = true; }
  if (pos.x > WORLD.waterX - 2) { pos.x = WORLD.waterX - 2; hit = true; }
  if (pos.z < -limit) { pos.z = -limit; hit = true; }
  if (pos.z > limit) { pos.z = limit; hit = true; }
  for (const c of city.colliders) {
    const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius;
      pos.z = nz + (dz / d) * radius;
    } else {
      const pushLeft = pos.x - c.x0 + radius;
      const pushRight = c.x1 - pos.x + radius;
      const pushUp = pos.z - c.z0 + radius;
      const pushDown = c.z1 - pos.z + radius;
      const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (m === pushLeft) pos.x = c.x0 - radius;
      else if (m === pushRight) pos.x = c.x1 + radius;
      else if (m === pushUp) pos.z = c.z0 - radius;
      else pos.z = c.z1 + radius;
    }
  }
  return hit;
}

export function onRoad(city, x, z) {
  if (x >= 180 && x <= WORLD.waterX) return true;
  if (x >= PLAZA.x0 && x <= PLAZA.x1 && z >= PLAZA.z0 && z <= PLAZA.z1) return true;
  for (const c of ROAD_COORDS) {
    if (Math.abs(x - c) < halfAt(c)) return true;
    if (Math.abs(z - c) < WORLD.roadHalf) return true;
  }
  return false;
}

export function nearestNode(city, x, z) {
  let best = city.nodes[0];
  let bd = Infinity;
  for (const n of city.nodes) {
    const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

export function randomRoadPoint(rng, city) {
  const vertical = rng.chance(0.5);
  const c = rng.pick(ROAD_COORDS);
  const t = rng.range(-220, 220);
  const lane = (rng.chance(0.5) ? 1 : -1) * (halfAt(c) - 3);
  return vertical ? { x: c + lane, z: t } : { x: t, z: c + lane };
}
