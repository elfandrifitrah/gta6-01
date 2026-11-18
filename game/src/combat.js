// Fists and the pistol: melee arcs with a soft lock onto the nearest foe,
// hitscan shots that stop at walls, damage numbers, and the pickups the
// missions revolve around (suitcase, ledger, ammo, health).

import { COMBAT, FOOT } from './config.js';
import { pointBlocked } from './city.js';
import { dist } from './vec.js';
import { damagePlayer } from './player.js';

export function spawnPickup(S, kind, x, y) {
  S.pickups.push({ kind, x, y, taken: false, phase: Math.random() * 6 });
}

export function damageEnemy(S, enemy, damage, fromX, fromY) {
  if (enemy.dead) return;
  enemy.hp -= damage;
  enemy.flash = 0.14;
  const dx = enemy.x - fromX;
  const dy = enemy.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  enemy.x += (dx / d) * 7;
  enemy.y += (dy / d) * 7;
  S.fx.hitStars(enemy.x, enemy.y);
  S.fx.floatText(String(damage), enemy.x, enemy.y - 26, '#ffe9a8');
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.dead = true;
    enemy.deathT = 0.5;
    S.fx.burst(enemy.x, enemy.y, '#e8d9a8', 12, 150, 0.5, 4);
    if (enemy.kind === 'guard') spawnPickup(S, 'ammo', enemy.x, enemy.y);
    if (enemy.kind === 'thief') S.events.push('thiefDown');
  }
}

export function tryPunch(S) {
  const player = S.player;
  if (player.car || player.punchCd > 0 || player.health <= 0) return;
  player.punchCd = FOOT.punchCooldown;
  // Soft lock: face the nearest hittable character in range. The lock
  // reach matches the hit reach (34 ahead plus a 46 radius), so a foe the
  // punch can reach is a foe the player turns to face.
  let target = null;
  let bestD = 34 + 46;
  const consider = (x, y, ref) => {
    const d = dist(player.x, player.y, x, y);
    if (d < bestD) {
      bestD = d;
      target = ref;
    }
  };
  for (const e of S.enemies.list) if (!e.dead) consider(e.x, e.y, { enemy: e });
  for (const ped of S.peds) if (ped.state !== 'down') consider(ped.x, ped.y, { ped });
  if (target) {
    const tx = target.enemy ? target.enemy.x : target.ped.x;
    const ty = target.enemy ? target.enemy.y : target.ped.y;
    player.heading = Math.atan2(ty - player.y, tx - player.x);
  }
  // A short lunge sells the punch.
  player.vx += Math.cos(player.heading) * 130;
  player.vy += Math.sin(player.heading) * 130;
  S.audio.punch();
  S.fx.shake(0.08);
  const hitX = player.x + Math.cos(player.heading) * 34;
  const hitY = player.y + Math.sin(player.heading) * 34;
  let hitSomething = false;
  for (const e of S.enemies.list) {
    if (e.dead) continue;
    if (dist(hitX, hitY, e.x, e.y) < 46) {
      damageEnemy(S, e, FOOT.punchDamage, player.x, player.y);
      hitSomething = true;
    }
  }
  if (!hitSomething) {
    for (const ped of S.peds) {
      if (ped.state === 'down') continue;
      if (dist(hitX, hitY, ped.x, ped.y) < 44) {
        ped.state = 'down';
        ped.downT = 2.5;
        S.addHeat(20);
        S.fx.hitStars(ped.x, ped.y);
        hitSomething = true;
        break;
      }
    }
  }
  if (hitSomething) S.fx.shake(0.16);
  S.threat = { x: player.x, y: player.y, t: S.time };
}

function rayBlocked(S, x, y) {
  return pointBlocked(S.city, x, y, 2);
}

export function fireShot(S, x, y, angle, owner) {
  const range = COMBAT.pistolRange;
  const step = 14;
  let endX = x + Math.cos(angle) * range;
  let endY = y + Math.sin(angle) * range;
  let hitChar = null;
  for (let d = 20; d < range; d += step) {
    const px = x + Math.cos(angle) * d;
    const py = y + Math.sin(angle) * d;
    if (rayBlocked(S, px, py)) {
      endX = px;
      endY = py;
      S.fx.sparks(px, py);
      break;
    }
    if (owner === 'player') {
      for (const e of S.enemies.list) {
        if (e.dead) continue;
        if (dist(px, py, e.x, e.y) < 26) { hitChar = { enemy: e, x: px, y: py }; break; }
      }
      if (!hitChar) {
        for (const ped of S.peds) {
          if (ped.state === 'down') continue;
          if (dist(px, py, ped.x, ped.y) < 24) { hitChar = { ped, x: px, y: py }; break; }
        }
      }
    } else if (owner === 'guard') {
      const player = S.player;
      if (!player.car && player.health > 0 && dist(px, py, player.x, player.y) < 26) {
        hitChar = { player: true, x: px, y: py };
        break;
      }
      if (player.car && dist(px, py, player.x, player.y) < 34) {
        hitChar = { car: true, x: px, y: py };
        break;
      }
    }
    if (hitChar) {
      endX = hitChar.x;
      endY = hitChar.y;
      break;
    }
  }
  S.fx.tracer(x, y, endX, endY);
  S.fx.muzzle(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22);
  S.audio.shot();
  if (hitChar) {
    if (hitChar.enemy) damageEnemy(S, hitChar.enemy, COMBAT.pistolDamage, x, y);
    else if (hitChar.ped) {
      hitChar.ped.state = 'down';
      hitChar.ped.downT = 3;
      S.addHeat(35);
    } else if (hitChar.player) damagePlayer(S, COMBAT.guardDamage, x, y);
    else if (hitChar.car) {
      damagePlayer(S, COMBAT.guardDamage * 0.5, x, y);
      S.fx.sparks(endX, endY);
    }
  }
  if (owner === 'player') {
    S.addHeat(6);
    S.threat = { x, y, t: S.time };
  }
}

export function tryShoot(S, targetX, targetY) {
  const player = S.player;
  if (player.car || !player.hasPistol || player.ammo <= 0 || player.shotCd > 0 || player.health <= 0) return;
  player.shotCd = COMBAT.pistolCooldown;
  player.ammo -= 1;
  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  player.heading = angle;
  player.aimHeading = angle;
  fireShot(S, player.x, player.y, angle, 'player');
}

export function stepPickups(S) {
  const player = S.player;
  let anyTaken = false;
  for (const p of S.pickups) {
    if (p.taken) continue;
    p.phase += 0.06;
    if (dist(player.x, player.y, p.x, p.y) < 38 && !player.car) {
      p.taken = true;
      anyTaken = true;
      S.fx.pickupSparkle(p.x, p.y);
      S.audio.pickup();
      if (p.kind === 'suitcase') {
        S.flags.suitcase = true;
        S.fx.floatText('Suitcase recovered', p.x, p.y - 30, '#ffd94d');
      } else if (p.kind === 'ledger') {
        S.flags.ledger = true;
        S.fx.floatText('Ledger taken', p.x, p.y - 30, '#ffd94d');
      } else if (p.kind === 'ammo') {
        player.ammo += 12;
        player.hasPistol = true;
        S.fx.floatText('+12 ammo', p.x, p.y - 30, '#e8e4da');
      } else if (p.kind === 'health') {
        player.health = Math.min(100, player.health + 40);
        S.fx.floatText('+40 health', p.x, p.y - 30, '#7bc950');
      }
    }
  }
  // Only rebuild the list when something was actually taken: the old code
  // allocated a fresh array every frame even when nothing changed.
  if (anyTaken) S.pickups = S.pickups.filter((p) => !p.taken);
}
