// Jakarta Heat's city: roads, blocks, buildings, props, traffic routes and the
// mission landmarks, all generated from one seeded stream so the same seed
// always builds the same Jakarta. Coordinates are world units; the world is
// 2600 wide and 2000 tall, north is up (smaller y).

import { WORLD, PALETTE, SIGN_TEXTS } from './config.js';
import { createRng } from './rng.js';

const PLAZA = { x: 760, y: 690, r: 250 };
const WATER_Y = 1900;

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
}

export function buildCity(seed) {
  const rng = createRng(seed);

  // Roads: avenues run north-south, streets east-west, alleys thread the kampung.
  const roads = [
    { x1: 520, y1: 0, x2: 520, y2: 2000, w: 84, name: 'Jl. Hayam Wuruk', kind: 'avenue' },
    { x1: 1300, y1: 0, x2: 1300, y2: 2000, w: 128, name: 'Jl. Sudirman', kind: 'avenue' },
    { x1: 2080, y1: 0, x2: 2080, y2: 2000, w: 84, name: 'Jl. Raya Kampung', kind: 'avenue' },
    { x1: 0, y1: 360, x2: 2600, y2: 360, w: 72, name: 'Jl. Thamrin', kind: 'street' },
    { x1: 0, y1: 1000, x2: 2600, y2: 1000, w: 72, name: 'Jl. Merdeka', kind: 'street' },
    { x1: 0, y1: 1640, x2: 2600, y2: 1640, w: 96, name: 'Jl. Pelabuhan', kind: 'street' },
    { x1: 300, y1: 1740, x2: 2500, y2: 1740, w: 64, name: 'Jl. Dermaga', kind: 'street' },
    { x1: 1850, y1: 80, x2: 1850, y2: 940, w: 36, name: 'Gg. Melati', kind: 'alley' },
    { x1: 2280, y1: 80, x2: 2280, y2: 940, w: 36, name: 'Gg. Kenanga', kind: 'alley' },
    { x1: 1700, y1: 560, x2: 2520, y2: 560, w: 36, name: 'Gg. Mawar', kind: 'alley' },
    { x1: 1700, y1: 800, x2: 2520, y2: 800, w: 36, name: 'Gg. Flamboyan', kind: 'alley' },
  ];

  const colliders = [];
  const buildings = [];
  const props = [];

  const xBands = [[40, 478], [562, 1236], [1364, 2038], [2122, 2560]];
  const yBands = [[40, 324], [396, 964], [1036, 1592]];
  const wallSets = {
    tower: [PALETTE.wallGlass, PALETTE.wallSlate, PALETTE.wallCream],
    block: [PALETTE.wallCream, PALETTE.wallTerra, PALETTE.wallBrick, PALETTE.wallSlate],
    house: [PALETTE.wallCream, PALETTE.wallTerra, '#d8b98a', '#c9a0a0', '#a8b89a'],
  };

  for (const [bx0, bx1] of xBands) {
    for (const [by0, by1] of yBands) {
      const kampung = bx0 >= 1700 && by1 <= 964;
      const nearPlaza = bx0 < PLAZA.x + PLAZA.r && bx1 > PLAZA.x - PLAZA.r && by0 < PLAZA.y + PLAZA.r && by1 > PLAZA.y - PLAZA.r;
      const cols = kampung ? 3 : bx1 - bx0 > 420 ? 2 : 1;
      const rows = kampung ? 2 : 1;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const lot = {
            x: bx0 + ((bx1 - bx0) / cols) * cx,
            y: by0 + ((by1 - by0) / rows) * cy,
            w: (bx1 - bx0) / cols,
            h: (by1 - by0) / rows,
          };
          const centre = { x: lot.x + lot.w / 2, y: lot.y + lot.h / 2 };
          if (nearPlaza && Math.hypot(centre.x - PLAZA.x, centre.y - PLAZA.y) < PLAZA.r + 40) continue;
          // Bu Ratna's warung courtyard stays open in every seed: the stall
          // is a mission landmark, and its marker must never sit inside a
          // building. The clearing runs south to Jl. Merdeka for access.
          if (lot.x < 1300 && lot.x + lot.w > 1060 && lot.y < 1000 && lot.y + lot.h > 820) continue;
          // The Sudirman/Thamrin crossing stays open: cars need room to
          // swing through the turn without clipping the corner blocks.
          if (lot.x < 1420 && lot.x + lot.w > 1180 && lot.y < 470 && lot.y + lot.h > 270) continue;
          // Every avenue/street crossing stays open for the same reason:
          // turning room at all nine intersections, not just the main one.
          let crossesJunction = false;
          for (const jx of [520, 1300, 2080]) {
            for (const jy of [360, 1000, 1640]) {
              if (lot.x < jx + 120 && lot.x + lot.w > jx - 120 && lot.y < jy + 95 && lot.y + lot.h > jy - 95) crossesJunction = true;
            }
          }
          if (crossesJunction) continue;
          if (rng.chance(0.12)) continue; // empty lot: a yard, a car park, a patch of grass
          const inset = kampung ? rng.range(8, 16) : rng.range(16, 30);
          const w = Math.max(46, lot.w - inset * 2);
          const d = Math.max(40, lot.h - inset * 2);
          const x = lot.x + (lot.w - w) / 2 + rng.range(-6, 6);
          const y = lot.y + (lot.h - d) / 2 + rng.range(-6, 6);
          const nearAvenue = Math.abs(centre.x - 1300) < 420;
          let kind = 'block';
          let h = rng.range(30, 68);
          if (kampung) {
            kind = 'house';
            h = rng.range(16, 28);
          } else if (nearAvenue && rng.chance(0.55)) {
            kind = 'tower';
            h = rng.range(80, 180);
          }
          const walls = wallSets[kind];
          const building = {
            x, y, w, d, h,
            wall: rng.pick(walls),
            roof: kind === 'house' ? PALETTE.roofTile : rng.chance(0.5) ? PALETTE.roofFlat : PALETTE.roofDark,
            kind,
            cols: Math.max(2, Math.floor(w / 26)),
            rows: Math.max(2, Math.floor(d / 24)),
            litSeed: rng.int(0, 100000),
            sign: null,
            awning: kampung && rng.chance(0.3),
          };
          if ((kind === 'tower' || kind === 'block') && rng.chance(0.22)) building.sign = rng.pick(SIGN_TEXTS);
          buildings.push(building);
          colliders.push({ x: x + 3, y: y + 3, w: w - 6, h: d - 6 });
        }
      }
    }
  }

  // The monument and its pool anchor the plaza; both are solid.
  props.push({ kind: 'monument', x: PLAZA.x, y: PLAZA.y });
  colliders.push({ x: PLAZA.x - 30, y: PLAZA.y - 30, w: 60, h: 60 });
  colliders.push({ x: PLAZA.x - 70, y: PLAZA.y + 52, w: 140, h: 56 });

  // The port: warehouse, cranes, container stacks, and the sea itself.
  const warehouse = { x: 1820, y: 1700, w: 300, d: 90, h: 46, wall: PALETTE.wallSlate, roof: PALETTE.roofDark, kind: 'warehouse', cols: 8, rows: 2, litSeed: 7, sign: 'GUDANG 7', awning: false };
  buildings.push(warehouse);
  colliders.push({ x: 1820, y: 1700, w: 300, h: 90 });
  const containerColors = ['#b4552d', '#3f7d8c', '#c98f1f', '#6e7683', '#7d8f57'];
  for (let i = 0; i < 14; i += 1) {
    // Wide aisles: the lane between the rows stays walkable for the ledger
    // run, and the gaps between stacks fit a person slipping through.
    const cx = 1540 + (i % 7) * 150 + rng.range(-14, 14);
    const cy = 1790 + Math.floor(i / 7) * 72 + rng.range(-4, 4);
    props.push({ kind: 'container', x: cx, y: cy, w: 96, d: 28, color: containerColors[i % containerColors.length], stacked: rng.chance(0.4) });
    colliders.push({ x: cx, y: cy, w: 96, h: 28 });
  }
  for (const craneX of [900, 1500, 2280]) {
    props.push({ kind: 'crane', x: craneX, y: 1864 });
    colliders.push({ x: craneX - 22, y: 1842, w: 44, h: 44 });
  }
  colliders.push({ x: 0, y: WATER_Y, w: WORLD.width, h: WORLD.height - WATER_Y });

  // Palms down the Sudirman median and around the plaza.
  for (let y = 90; y < 1960; y += 110) {
    props.push({ kind: 'palm', x: 1300 + (y % 220 === 90 ? -14 : 14), y, lean: rng.range(-0.2, 0.2) });
  }
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    props.push({ kind: 'palm', x: PLAZA.x + Math.cos(a) * 205, y: PLAZA.y + Math.sin(a) * 205, lean: rng.range(-0.15, 0.15) });
  }
  // Street lamps at the main intersections.
  for (const lx of [520, 1300, 2080]) {
    for (const ly of [360, 1000, 1640]) {
      props.push({ kind: 'lamp', x: lx + 52, y: ly + 52 });
      props.push({ kind: 'lamp', x: lx - 52, y: ly - 52 });
    }
  }
  // Billboards with fictional Jakarta brands.
  const boards = [
    { x: 1180, y: 300, text: 'KOPI SENJA' }, { x: 1420, y: 900, text: 'SELAMAT DATANG' },
    { x: 460, y: 1080, text: 'BANK NUSANTARA' }, { x: 2140, y: 420, text: 'BIOSKOP REX' },
    { x: 600, y: 1560, text: 'NASI GORENG 88' }, { x: 2340, y: 1500, text: 'MAL SENJA' },
  ];
  for (const b of boards) props.push({ kind: 'billboard', ...b });
  // Warung stalls, food carts, planters, roadwork cones, kampung laundry lines.
  props.push({ kind: 'stall', x: 1180, y: 900, big: true });
  props.push({ kind: 'stall', x: 2140, y: 950, big: false });
  props.push({ kind: 'stall', x: 560, y: 420, big: false });
  for (const [cx, cy] of [[700, 340], [1500, 1020], [1980, 620], [900, 1620]]) props.push({ kind: 'cart', x: cx, y: cy });
  for (let i = 0; i < 12; i += 1) {
    props.push({ kind: 'planter', x: rng.range(100, 2500), y: rng.range(100, 1600) });
  }
  for (const [cx, cy] of [[1240, 700], [1252, 730], [1360, 1200], [1372, 1230]]) props.push({ kind: 'cone', x: cx, y: cy });
  for (let i = 0; i < 6; i += 1) {
    props.push({ kind: 'laundry', x: rng.range(1760, 2440), y: rng.range(140, 900) });
  }

  // Traffic loops follow road centre lines; drivers offset to their right side.
  const routes = [
    { points: [[1300, 200], [1300, 1560], [520, 1560], [520, 440], [1300, 440]], lane: 26, kinds: ['sedan', 'taxi', 'van'] },
    { points: [[2080, 200], [2080, 1560], [1300, 1560], [1300, 440], [2080, 440]], lane: 24, kinds: ['sedan', 'taxi', 'van'] },
    { points: [[1850, 560], [2280, 560], [2280, 800], [1850, 800]], lane: 9, kinds: ['bajaj', 'bike'] },
    { points: [[400, 1640], [2400, 1640], [2400, 1740], [400, 1740]], lane: 22, kinds: ['van', 'sedan', 'truck'] },
  ];

  // Sidewalk sample points for wandering pedestrians.
  const sidewalkPoints = [];
  for (const road of roads) {
    if (road.kind === 'alley') continue;
    const horizontal = road.y1 === road.y2;
    const len = horizontal ? road.x2 - road.x1 : road.y2 - road.y1;
    for (let d = 60; d < len; d += 130) {
      for (const side of [-1, 1]) {
        const px = horizontal ? road.x1 + d : road.x1 + side * (road.w / 2 + 16);
        const py = horizontal ? road.y1 + side * (road.w / 2 + 16) : road.y1 + d;
        if (px < 30 || px > WORLD.width - 30 || py < 30 || py > WORLD.height - 30) continue;
        if (Math.hypot(px - PLAZA.x, py - PLAZA.y) < PLAZA.r - 30) continue;
        let blocked = false;
        for (const c of colliders) if (circleHitsRect(px, py, 8, c)) { blocked = true; break; }
        if (!blocked) sidewalkPoints.push({ x: px, y: py });
      }
    }
  }

  // Parked cars wait at curbs, away from intersections.
  const parkedSpots = [];
  const spotRoads = [
    { x: 520, vertical: true }, { x: 1300, vertical: true }, { x: 2080, vertical: true },
    { y: 360, vertical: false }, { y: 1000, vertical: false }, { y: 1640, vertical: false },
  ];
  for (const sr of spotRoads) {
    for (let i = 0; i < 5; i += 1) {
      const along = rng.range(160, 1840);
      const road = roads.find((r) => (sr.vertical ? r.x1 === sr.x && r.y1 === 0 : r.y1 === sr.y && r.x1 === 0));
      const w = road ? road.w : 80;
      const px = sr.vertical ? sr.x + (w / 2 + 20) * (i % 2 === 0 ? 1 : -1) : along;
      const py = sr.vertical ? along : sr.y + (w / 2 + 20) * (i % 2 === 0 ? 1 : -1);
      if (Math.hypot(px - PLAZA.x, py - PLAZA.y) < PLAZA.r + 20) continue;
      let blocked = false;
      for (const c of colliders) if (circleHitsRect(px, py, 26, c)) { blocked = true; break; }
      if (!blocked) parkedSpots.push({ x: px, y: py, heading: sr.vertical ? 0 : Math.PI / 2 });
    }
  }

  return {
    seed,
    roads,
    buildings,
    colliders,
    props,
    routes,
    sidewalkPoints,
    parkedSpots,
    plaza: PLAZA,
    waterY: WATER_Y,
    markers: {
      warung: { x: 1180, y: 900 },
      dropNorth: { x: 1300, y: 300 },
      kampungAlley: { x: 2100, y: 620 },
      raceStart: { x: 1300, y: 1500 },
      portYard: { x: 1900, y: 1830 },
      ledger: { x: 2050, y: 1840 },
    },
    raceGates: [
      { x: 1300, y: 1000 }, { x: 1300, y: 440 }, { x: 1700, y: 360 }, { x: 2080, y: 700 },
      { x: 2080, y: 1400 }, { x: 1700, y: 1640 }, { x: 900, y: 1640 }, { x: 1300, y: 1500 },
    ],
    thiefWaypoints: [
      { x: 1850, y: 560 }, { x: 2100, y: 560 }, { x: 2280, y: 560 }, { x: 2280, y: 800 },
      { x: 2050, y: 800 }, { x: 1850, y: 800 }, { x: 1850, y: 620 }, { x: 2100, y: 620 },
    ],
    guardPosts: [
      { x: 1760, y: 1800 }, { x: 1840, y: 1865 }, { x: 1940, y: 1790 }, { x: 2030, y: 1855 }, { x: 2120, y: 1800 },
    ],
  };
}

/** Push a circle out of every collider it touches; returns the corrected position. */
export function collideCircle(city, x, y, radius) {
  let hit = false;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const c of city.colliders) {
      const nx = Math.max(c.x, Math.min(x, c.x + c.w));
      const ny = Math.max(c.y, Math.min(y, c.y + c.h));
      const dx = x - nx;
      const dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        y = ny + (dy / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pushLeft = x - c.x + radius;
        const pushRight = c.x + c.w - x + radius;
        const pushUp = y - c.y + radius;
        const pushDown = c.y + c.h - y + radius;
        const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (m === pushLeft) x = c.x - radius;
        else if (m === pushRight) x = c.x + c.w + radius;
        else if (m === pushUp) y = c.y - radius;
        else y = c.y + c.h + radius;
      }
    }
  }
  // The world edge is a wall: clamp the centre inside the map and report
  // a hit, so callers that only apply corrections on a hit still enforce it.
  const cx = Math.max(radius, Math.min(WORLD.width - radius, x));
  const cy = Math.max(radius, Math.min(WORLD.height - radius, y));
  if (cx !== x || cy !== y) hit = true;
  return { x: cx, y: cy, hit };
}

export function pointBlocked(city, x, y, radius) {
  for (const c of city.colliders) if (circleHitsRect(x, y, radius, c)) return true;
  return false;
}

/** Spiral out from a point until open ground is found; never spawns inside a wall. */
export function findFreeSpot(city, x, y, radius) {
  if (!pointBlocked(city, x, y, radius)) return { x, y };
  for (let ring = 1; ring <= 10; ring += 1) {
    const step = radius * 2 * ring;
    for (let a = 0; a < 12; a += 1) {
      const angle = (a / 12) * Math.PI * 2;
      const px = x + Math.cos(angle) * step;
      const py = y + Math.sin(angle) * step;
      if (px > radius && px < WORLD.width - radius && py > radius && py < WORLD.height - radius && !pointBlocked(city, px, py, radius)) {
        return { x: px, y: py };
      }
    }
  }
  return { x, y };
}

/** True when a point sits on a road surface, within an optional extra margin. */
export function pointOnRoad(city, x, y, pad = 0) {
  for (const r of city.roads) {
    const horizontal = r.y1 === r.y2;
    if (horizontal) {
      if (x >= r.x1 - pad && x <= r.x2 + pad && Math.abs(y - r.y1) <= r.w / 2 + pad) return true;
    } else if (y >= r.y1 - pad && y <= r.y2 + pad && Math.abs(x - r.x1) <= r.w / 2 + pad) return true;
  }
  return false;
}
