// The wanted level: heat from crimes, stars from heat, police cars that chase
// and a bust meter when they corner Bimo. Hide from every patrol car and the
// heat bleeds away; cause fresh trouble and it climbs again.

import { WANTED } from './config.js';
import { collideCircle, pointOnRoad } from './city.js';
import { clamp, dist, dampAngle } from './vec.js';
import { makeCar } from './traffic.js';

export function createWanted() {
  return { stars: 0, heat: 0, evadeT: 0, police: [], bustT: 0, lastStars: 0 };
}

export function addHeat(S, amount) {
  const w = S.wanted;
  w.heat = clamp(w.heat + amount, 0, WANTED.heatPerStar * WANTED.maxStars);
  const stars = Math.min(WANTED.maxStars, Math.floor(w.heat / WANTED.heatPerStar));
  if (stars > w.stars) {
    w.stars = stars;
    S.audio.wantedUp();
    S.events.push('wantedUp');
  } else {
    w.stars = stars;
  }
}

function spawnPolice(S) {
  // Appear on a road 550 to 800 units away, never inside a building.
  for (let tries = 0; tries < 24; tries += 1) {
    const angle = Math.random() * Math.PI * 2;
    const d = 550 + Math.random() * 250;
    const x = S.player.x + Math.cos(angle) * d;
    const y = S.player.y + Math.sin(angle) * d;
    if (x < 40 || x > 2560 || y < 40 || y > 1960) continue;
    if (!pointOnRoad(S.city, x, y, 6)) continue;
    const car = makeCar('sedan', x, y, Math.atan2(S.player.y - y, S.player.x - x), '#20242c');
    car.police = true;
    car.driver = false;
    car.route = -1;
    car.hp = 100;
    S.wanted.police.push(car);
    S.cars.push(car);
    return;
  }
}

function stepPoliceCar(S, car, dt) {
  const player = S.player;
  const predict = 0.45;
  const tx = player.x + player.vx * predict;
  const ty = player.y + player.vy * predict;
  const wantHeading = Math.atan2(ty - car.y, tx - car.x);
  car.heading = dampAngle(car.heading, wantHeading, 3.4, dt);
  const cruise = 390 + S.wanted.stars * 32;
  const d = dist(car.x, car.y, player.x, player.y);
  const target = d < 90 ? Math.max(120, cruise * 0.4) : cruise;
  car.speed = clamp(car.speed + (target - car.speed) * Math.min(1, dt * 1.4), 0, 580);
  car.vx = Math.cos(car.heading) * car.speed;
  car.vy = Math.sin(car.heading) * car.speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const fixed = collideCircle(S.city, car.x, car.y, car.d * 0.5);
  if (fixed.hit) {
    car.x = fixed.x;
    car.y = fixed.y;
    car.speed *= 0.6;
  }
  // Nudge traffic aside instead of piling up behind it.
  for (const other of S.cars) {
    if (other === car || other.police || other.parked) continue;
    const od = dist(car.x, car.y, other.x, other.y);
    if (od < 56 && od > 0.01) {
      const push = (56 - od) * 0.5;
      other.x += ((other.x - car.x) / od) * push;
      other.y += ((other.y - car.y) / od) * push;
    }
  }
  car.flashPhase = (car.flashPhase || 0) + dt * 9;
}

export function stepWanted(S, dt, throttleHeld) {
  const w = S.wanted;
  const player = S.player;
  let nearest = Infinity;
  for (const car of w.police) nearest = Math.min(nearest, dist(car.x, car.y, player.x, player.y));
  S.policeNear01 = nearest === Infinity ? 0 : clamp(1 - nearest / 700, 0, 1);

  if (w.stars > 0) {
    if (nearest > 520) w.evadeT += dt;
    else w.evadeT = 0;
    const decay = w.evadeT > WANTED.evadeDelay ? WANTED.evadeDecay : WANTED.decayPerSecond;
    w.heat = Math.max(0, w.heat - decay * dt);
    w.stars = Math.min(WANTED.maxStars, Math.floor(w.heat / WANTED.heatPerStar));
  }

  const desired = w.stars >= 2 ? Math.min(3, w.stars - 1) : 0;
  while (w.police.length < desired) spawnPolice(S);
  if (w.stars < 2) {
    for (const car of w.police) car.leaving = true;
  }
  for (const car of w.police) {
    if (car.leaving) {
      car.speed = Math.max(0, car.speed - 200 * dt);
      car.x += Math.cos(car.heading) * car.speed * dt;
      car.y += Math.sin(car.heading) * car.speed * dt;
      continue;
    }
    stepPoliceCar(S, car, dt);
  }
  w.police = w.police.filter((car) => {
    const far = dist(car.x, car.y, player.x, player.y) > 1250;
    if ((car.leaving && (far || car.speed < 5)) || far) {
      car.dead = true;
      return false;
    }
    return true;
  });
  S.cars = S.cars.filter((c) => !c.dead);

  // Cornered and slow: the bust meter fills. Break away and it drains.
  // Flooring the throttle counts as breaking away even when a police car
  // pins the car below 70: the bust is for giving up, not for grinding
  // through a block at full throttle.
  if (w.stars >= 2 && nearest < 78 && player.speed < 70 && !throttleHeld) {
    w.bustT += dt;
    if (w.bustT >= WANTED.bustTime) {
      w.bustT = 0;
      S.events.push('busted');
    }
  } else {
    w.bustT = Math.max(0, w.bustT - dt * 1.4);
  }
}
