// Bimo on foot and behind the wheel: arcade movement, car physics with drift,
// entering and leaving cars, health and regeneration. Combat lives in
// combat.js; this module only moves bodies and resolves crashes.

import { CAR, FOOT, HEALTH } from './config.js';
import { collideCircle } from './city.js';
import { clamp, damp, dist, wrapAngle } from './vec.js';

let crashSoundAt = 0;

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, heading: -Math.PI / 2, speed: 0,
    health: HEALTH.max, car: null, ammo: 0, hasPistol: false,
    punchCd: 0, shotCd: 0, hurtT: 0, lastDamageT: -99, moving: false,
    walkPhase: 0, aimHeading: -Math.PI / 2, entering: 0,
  };
}

function carCircles(car) {
  const fx = Math.cos(car.heading);
  const fy = Math.sin(car.heading);
  const half = car.w * 0.28;
  return [
    { x: car.x + fx * half, y: car.y + fy * half, r: car.d * 0.52 },
    { x: car.x - fx * half, y: car.y - fy * half, r: car.d * 0.52 },
  ];
}

function crashCar(S, car, strength) {
  if (strength < 40) return;
  car.hp = Math.max(0, car.hp - strength * 0.05);
  S.fx.sparks(car.x, car.y);
  S.fx.shake(clamp(strength / 500, 0.1, 0.55));
  if (S.time - crashSoundAt > 0.25) {
    S.audio.crash(strength / 500);
    crashSoundAt = S.time;
  }
}

function collideCarWithCity(S, car) {
  let hitAny = false;
  for (const c of carCircles(car)) {
    const fixed = collideCircle(S.city, c.x, c.y, c.r);
    if (fixed.hit) {
      hitAny = true;
      car.x += fixed.x - c.x;
      car.y += fixed.y - c.y;
    }
  }
  return hitAny;
}

function collideCarWithCars(S, car) {
  for (const other of S.cars) {
    if (other === car || other.dead) continue;
    if (!Number.isFinite(other.x) || !Number.isFinite(other.y)) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    const min = CAR.radius + CAR.radius * (other.kind === 'bike' ? 0.6 : 1);
    if (d >= min || d < 0.01) continue;
    const push = (min - d) / 2;
    const nx = (car.x - other.x) / d;
    const ny = (car.y - other.y) / d;
    car.x += nx * push;
    car.y += ny * push;
    other.x -= nx * push;
    other.y -= ny * push;
    const relSpeed = Math.abs(car.speed - other.speed);
    if (relSpeed > 60) {
      crashCar(S, car, relSpeed);
      crashCar(S, other, relSpeed);
      const exchange = car.speed * 0.35;
      car.speed *= 0.6;
      other.speed += exchange * 0.4 * Math.sign(car.speed || 1);
      other.heading = wrapAngle(other.heading + 0.15 * Math.sign(nx));
    }
  }
}

function stepDriving(S, player, input, dt) {
  const car = player.car;
  const axes = input.axes();
  const maxSpeed = car.race ? CAR.raceMaxSpeed : CAR.maxSpeed;
  if (axes.y > 0) car.speed += CAR.accel * dt;
  else if (axes.y < 0) car.speed -= (car.speed > 5 ? CAR.brake : CAR.accel * 0.6) * dt;
  else car.speed = damp(car.speed, 0, 0.7, dt);
  car.speed = clamp(car.speed, -CAR.reverseMax, maxSpeed);

  const steerAuthority = clamp(Math.abs(car.speed) / 120, 0, 1);
  car.heading = wrapAngle(car.heading + axes.x * CAR.turn * steerAuthority * dt * Math.sign(car.speed || 1));
  car.brakeLight = axes.y < 0 || input.held.brake;

  // Velocity chases the heading; the handbrake loosens the grip so the tail slides.
  const grip = input.held.brake ? CAR.driftGrip : CAR.grip;
  const wantVx = Math.cos(car.heading) * car.speed;
  const wantVy = Math.sin(car.heading) * car.speed;
  car.vx = damp(car.vx, wantVx, grip, dt);
  car.vy = damp(car.vy, wantVy, grip, dt);
  const speedBefore = Math.hypot(car.vx, car.vy);
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const hitWall = collideCarWithCity(S, car);
  collideCarWithCars(S, car);
  if (hitWall) {
    const loss = speedBefore * 0.55;
    car.speed *= 0.45;
    car.vx *= 0.4;
    car.vy *= 0.4;
    crashCar(S, car, loss);
    if (loss > 120) damagePlayer(S, loss * 0.03, car.x, car.y);
  }
  if (input.held.brake && Math.abs(car.speed) > 180 && Math.random() < 0.5) {
    S.fx.smoke(car.x - Math.cos(car.heading) * 26, car.y - Math.sin(car.heading) * 26);
  }
  if (Math.abs(car.speed) > 300 && Math.random() < 0.2) S.fx.dust(car.x, car.y + 18);

  player.x = car.x;
  player.y = car.y;
  player.heading = car.heading;
  player.speed = Math.hypot(car.vx, car.vy);
  player.moving = player.speed > 20;
  car.hp = Math.max(0, car.hp);

  // Running over a pedestrian is a crime, not a tactic.
  for (const ped of S.peds) {
    if (ped.state === 'down') continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 34 && player.speed > 60) {
      ped.state = 'down';
      ped.downT = 3;
      S.addHeat(30);
      S.fx.hitStars(ped.x, ped.y);
      S.fx.shake(0.35);
      S.audio.punch();
    }
  }
}

function stepOnFoot(S, player, input, dt) {
  const axes = input.axes();
  const top = input.held.sprint ? FOOT.run : FOOT.walk;
  const tx = axes.x * top;
  // axes.y is throttle-positive (forward is +1); screen space runs down, so
  // on foot the forward key must move the player up the screen.
  const ty = -axes.y * top;
  player.vx = damp(player.vx, tx, 12, dt);
  player.vy = damp(player.vy, ty, 12, dt);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const fixed = collideCircle(S.city, player.x, player.y, FOOT.radius);
  player.x = fixed.x;
  player.y = fixed.y;
  const speed = Math.hypot(player.vx, player.vy);
  player.speed = speed;
  player.moving = speed > 25;
  if (player.moving) {
    player.heading = Math.atan2(player.vy, player.vx);
    player.walkPhase += dt * speed * 0.06;
  }
}

export function nearestCar(S, x, y, range) {
  let best = null;
  let bestD = range;
  for (const car of S.cars) {
    if (car.dead) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function tryEnterExit(S, player) {
  if (player.entering > 0) return;
  if (player.car) {
    // Step out on the side with open ground.
    const car = player.car;
    const side = Math.PI / 2;
    for (const s of [side, -side]) {
      const px = car.x + Math.cos(car.heading + s) * 44;
      const py = car.y + Math.sin(car.heading + s) * 44;
      const fixed = collideCircle(S.city, px, py, FOOT.radius);
      if (!fixed.hit || dist(fixed.x, fixed.y, px, py) < 4) {
        player.x = fixed.x;
        player.y = fixed.y;
        break;
      }
    }
    player.car = null;
    player.vx = 0;
    player.vy = 0;
    player.entering = 0.35;
    S.audio.ui();
    return;
  }
  const car = nearestCar(S, player.x, player.y, CAR.enterRange);
  if (!car) return;
  if (car.driver) {
    // Steal it: the driver bails and runs.
    car.driver = false;
    S.addHeat(25);
    S.spawnFleeingPed(car.x, car.y);
    S.audio.honk();
  }
  car.parked = false;
  player.car = car;
  player.entering = 0.35;
  // Getting in breaks the corner: the bust meter filled on foot must not
  // carry over and bust the player a heartbeat after the getaway starts.
  // The police have to re-corner the car from scratch.
  if (S.wanted) S.wanted.bustT = 0;
  S.audio.ui();
}

export function damagePlayer(S, amount, fromX, fromY) {
  const player = S.player;
  if (player.health <= 0) return;
  player.health = Math.max(0, player.health - amount);
  player.hurtT = 0.6;
  player.lastDamageT = S.time;
  S.fx.shake(clamp(amount / 60, 0.1, 0.4));
  if (player.health <= 0) S.events.push('wasted');
}

export function stepPlayer(S, input, dt, actions) {
  const player = S.player;
  player.punchCd = Math.max(0, player.punchCd - dt);
  player.shotCd = Math.max(0, player.shotCd - dt);
  player.hurtT = Math.max(0, player.hurtT - dt);
  player.entering = Math.max(0, player.entering - dt);
  if (actions & 4) tryEnterExit(S, player);
  if (player.car) stepDriving(S, player, input, dt);
  else stepOnFoot(S, player, input, dt);
  if (S.time - player.lastDamageT > HEALTH.regenDelay && player.health > 0 && player.health < HEALTH.regenCap) {
    player.health = Math.min(HEALTH.regenCap, player.health + HEALTH.regenRate * dt);
  }
}
