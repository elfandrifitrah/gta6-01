// The living city: traffic that follows the road loops, motorbikes that weave,
// parked cars waiting to be borrowed, and pedestrians who stroll, pause and
// run when trouble starts. Everything recycles around the camera.

import { CAR } from './config.js';
import { collideCircle, pointOnRoad } from './city.js';
import { clamp, damp, dist, dampAngle, wrapAngle } from './vec.js';

const CAR_COLORS = ['#e8e4da', '#c0c4c8', '#3a3f46', '#a83a32', '#3a5a8c', '#d8b13c', '#5a7a4a', '#7a4a8c'];
const PED_SHIRTS = ['#d86a4a', '#4a7ad8', '#e8c84a', '#7ab86a', '#c86a9a', '#e8e4da', '#4ac8b8', '#8c6a4a'];
const SPEEDS = { sedan: 135, taxi: 155, van: 115, truck: 95, bajaj: 125, bike: 195 };

let nextCarId = 1;

export function makeCar(kind, x, y, heading, color) {
  const sizes = {
    sedan: { w: 62, d: 30 }, taxi: { w: 62, d: 30 }, van: { w: 72, d: 32 },
    truck: { w: 84, d: 34 }, bajaj: { w: 40, d: 26 }, bike: { w: 34, d: 16 },
  };
  const size = sizes[kind] || sizes.sedan;
  return {
    id: nextCarId,
    kind, x, y, heading, speed: 0, vx: 0, vy: 0,
    w: size.w, d: size.d, color: color || CAR_COLORS[0],
    route: -1, waypoint: 0, driver: true, parked: false,
    hp: 100, brakeLight: false, race: false, rival: false, dead: false, missionCar: false,
  };
}
nextCarId = 1;

function routeTarget(city, car) {
  const route = city.routes[car.route];
  const point = route.points[car.waypoint];
  const next = route.points[(car.waypoint + 1) % route.points.length];
  const dx = next[0] - point[0];
  const dy = next[1] - point[1];
  const len = Math.hypot(dx, dy) || 1;
  // Right-hand traffic: ride to the right of the direction of travel.
  const lane = route.lane;
  return { x: point[0] + (-dy / len) * lane, y: point[1] + (dx / len) * lane };
}

function carAhead(S, car) {
  const fx = Math.cos(car.heading);
  const fy = Math.sin(car.heading);
  let nearest = Infinity;
  for (const other of S.cars) {
    if (other === car || other.parked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead < 10 || ahead > 110) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 34 && ahead < nearest) nearest = ahead;
  }
  return nearest;
}

function stepRouteCar(S, car, dt) {
  const route = S.city.routes[car.route];
  const target = routeTarget(S.city, car);
  const d = dist(car.x, car.y, target.x, target.y);
  if (d < 46) {
    car.waypoint = (car.waypoint + 1) % route.points.length;
    return;
  }
  const wantHeading = Math.atan2(target.y - car.y, target.x - car.x);
  car.heading = dampAngle(car.heading, wantHeading, 3.2, dt);
  let cruise = SPEEDS[car.kind] || 130;
  if (S.jam && car.route <= 1) cruise *= 0.45;
  const ahead = carAhead(S, car);
  if (ahead < 70) cruise = Math.min(cruise, Math.max(0, (ahead - 30) * 2.2));
  if (car.kind === 'bike') {
    cruise *= 1.15;
    car.heading = wrapAngle(car.heading + Math.sin(S.time * 2.1 + car.id) * 0.35 * dt);
  }
  car.speed = damp(car.speed, cruise, 1.6, dt);
  car.vx = Math.cos(car.heading) * car.speed;
  car.vy = Math.sin(car.heading) * car.speed;
  const px = car.x;
  const py = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const fixed = collideCircle(S.city, car.x, car.y, car.d * 0.5);
  car.x = fixed.x;
  car.y = fixed.y;
  // Unstuck: a car shoved off the road grinds against a wall forever and
  // blocks the street. After 2.5s of trying without moving, put it back
  // on its route point; background traffic already pops at recycle.
  const moved = dist(px, py, car.x, car.y);
  if (car.speed > 30 && moved < car.speed * dt * 0.25) {
    car.stuckT = (car.stuckT || 0) + dt;
  } else {
    car.stuckT = 0;
  }
  // A car stopped dead in a frozen queue is stuck too, even though its
  // speed reads low: if it has not moved at all for 4s, put it back.
  if (moved < 0.2) {
    car.stillT = (car.stillT || 0) + dt;
  } else {
    car.stillT = 0;
  }
  if (car.stuckT > 2.5 || car.stillT > 4) {
    car.x = target.x;
    car.y = target.y;
    car.stuckT = 0;
    car.stillT = 0;
  }
}

function stepPed(S, ped, dt) {
  const threat = S.threat;
  if (threat && dist(ped.x, ped.y, threat.x, threat.y) < 190 && ped.state !== 'down') {
    ped.state = 'flee';
    ped.fleeT = 2.5;
  }
  if (ped.state === 'down') {
    ped.downT -= dt;
    if (ped.downT <= 0) {
      ped.state = 'flee';
      ped.fleeT = 3;
    }
    return;
  }
  if (ped.state === 'flee') {
    ped.fleeT -= dt;
    const away = Math.atan2(ped.y - (threat ? threat.y : ped.y), ped.x - (threat ? threat.x : ped.x));
    ped.heading = dampAngle(ped.heading, away, 6, dt);
    ped.x += Math.cos(ped.heading) * 240 * dt;
    ped.y += Math.sin(ped.heading) * 240 * dt;
    if (ped.fleeT <= 0) ped.state = 'walk';
  } else {
    if (ped.pauseT > 0) {
      ped.pauseT -= dt;
      return;
    }
    if (!ped.tx) {
      const p = S.city.sidewalkPoints[Math.floor(Math.random() * S.city.sidewalkPoints.length)];
      if (p && dist(ped.x, ped.y, p.x, p.y) < 520) {
        ped.tx = p.x;
        ped.ty = p.y;
      } else {
        ped.pauseT = 1 + Math.random() * 2;
        return;
      }
    }
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 14) {
      ped.tx = null;
      ped.pauseT = 1 + Math.random() * 3;
      return;
    }
    ped.heading = dampAngle(ped.heading, Math.atan2(ped.ty - ped.y, ped.tx - ped.x), 5, dt);
    ped.x += Math.cos(ped.heading) * ped.speed * dt;
    ped.y += Math.sin(ped.heading) * ped.speed * dt;
  }
  const fixed = collideCircle(S.city, ped.x, ped.y, 13);
  ped.x = fixed.x;
  ped.y = fixed.y;
  ped.phase += dt * 6;
}

export function createTraffic(city, rng) {
  const cars = [];
  const peds = [];
  for (let i = 0; i < 16; i += 1) {
    const routeIdx = i % city.routes.length;
    const route = city.routes[routeIdx];
    const kind = rng.pick(route.kinds);
    const seg = Math.floor(rng.next() * route.points.length);
    const a = route.points[seg];
    const b = route.points[(seg + 1) % route.points.length];
    const t = rng.next();
    const car = makeCar(kind, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0]), rng.pick(CAR_COLORS));
    car.id = nextCarId;
    nextCarId += 1;
    car.route = routeIdx;
    car.waypoint = (seg + 1) % route.points.length;
    if (kind === 'taxi') car.color = '#e8c84a';
    if (kind === 'bajaj') car.color = '#e87e2c';
    cars.push(car);
  }
  for (const spot of city.parkedSpots) {
    const kind = rng.pick(['sedan', 'sedan', 'van', 'taxi']);
    const car = makeCar(kind, spot.x, spot.y, spot.heading, rng.pick(CAR_COLORS));
    car.id = nextCarId;
    nextCarId += 1;
    car.parked = true;
    car.driver = false;
    if (kind === 'taxi') car.color = '#e8c84a';
    cars.push(car);
  }
  for (let i = 0; i < 22; i += 1) {
    const p = city.sidewalkPoints[Math.floor(rng.next() * city.sidewalkPoints.length)] || { x: 1300, y: 500 };
    peds.push({
      x: p.x, y: p.y, tx: null, ty: null, heading: rng.range(0, Math.PI * 2),
      speed: rng.range(55, 85), pauseT: rng.range(0, 2), state: 'walk',
      fleeT: 0, downT: 0, shirt: rng.pick(PED_SHIRTS), phase: rng.range(0, 6),
    });
  }
  return { cars, peds, jamCars: [] };
}

export function spawnFleeingPed(S, x, y) {
  S.peds.push({
    x, y, tx: null, ty: null, heading: Math.random() * Math.PI * 2,
    speed: 90, pauseT: 0, state: 'flee', fleeT: 3, downT: 0,
    shirt: PED_SHIRTS[Math.floor(Math.random() * PED_SHIRTS.length)], phase: 0,
  });
}

export function setJam(S, on) {
  if (on === S.jam) return;
  S.jam = on;
  if (on) {
    for (let i = 0; i < 6; i += 1) {
      const y = 500 + i * 170;
      const car = makeCar(i % 2 ? 'van' : 'sedan', 1300 + (i % 2 ? 30 : -30), y, Math.PI / 2, CAR_COLORS[i % CAR_COLORS.length]);
      car.id = nextCarId;
      nextCarId += 1;
      car.route = 0;
      car.waypoint = 1;
      S.cars.push(car);
      S.jamCars.push(car);
    }
  } else {
    for (const car of S.jamCars) car.dead = true;
    S.jamCars = [];
    S.cars = S.cars.filter((c) => !c.dead);
  }
}

export function stepTraffic(S, dt) {
  const cam = S.camera;
  for (const car of S.cars) {
    if (car.parked || car === S.player.car || car.rival || car.dead) continue;
    if (car.route >= 0) stepRouteCar(S, car, dt);
    // Recycle far-away traffic to a route point near the camera.
    if (dist(car.x, car.y, cam.x, cam.y) > 1100 && car.route >= 0 && !car.missionCar) {
      const route = S.city.routes[car.route];
      let best = null;
      let bestD = Infinity;
      for (const p of route.points) {
        const d = dist(p[0], p[1], cam.x, cam.y);
        if (d > 500 && d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (best) {
        car.x = best[0];
        car.y = best[1];
        car.waypoint = (route.points.indexOf(best) + 1) % route.points.length;
      }
    }
  }
  for (const ped of S.peds) stepPed(S, ped, dt);
  if (S.peds.length > 40) S.peds.splice(0, S.peds.length - 40);
}
