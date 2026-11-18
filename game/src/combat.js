// Combat: Bimo's punch and pistol, enemy thugs and guards, and the threat that makes
// pedestrians run. Hits are arcade-fair: generous cones, visible flashes, no hidden dice
// except an enemy shooter's aim.

import { PLAYER } from './config.js';
import { collideCircle } from './city.js';
import { angLerp, clamp, dist2, wrapAngle } from './vec.js';
import { addShake, spawnFloater, spawnSparks } from './effects.js';
import { say } from './hud.js';
import { damagePlayer } from './player.js';
import { addWanted } from './wanted.js';

export function spawnEnemy(G, x, z, weapon, hp) {
  const e = {
    x, z, heading: 0, speed: 0, phase: Math.random() * 6, moving: false,
    punchT: 0, shootT: 1 + Math.random(), guardX: x, guardZ: z,
    weapon, hp: hp || 60, maxHp: hp || 60, dead: false, deadT: 0,
    shirt: weapon === 'pistol' ? [140, 40, 36] : [60, 58, 66],
    pants: [36, 38, 46], skin: [180, 138, 100], hair: [24, 20, 18],
  };
  G.enemies.push(e);
  return e;
}

export function damageEnemy(G, e, dmg) {
  if (e.dead) return;
  e.hp -= dmg;
  e.heading = Math.atan2(G.player.x - e.x, G.player.z - e.z);
  spawnSparks(G, e.x, 1.4, e.z, 5, [255, 180, 120]);
  spawnFloater(G, e.x, 2.4, e.z, String(dmg), '#ffd257');
  if (e.hp <= 0) {
    e.hp = 0;
    e.dead = true;
    e.deadT = 0;
    e.moving = false;
    G.audio.hit();
    spawnFloater(G, e.x, 2.2, e.z, 'Down', '#ff8a7a');
  }
}

export function playerShoot(G) {
  const p = G.player;
  if (p.shootT > 0 || p.dead) return;
  p.shootT = PLAYER.fireGap;
  const yaw = G.camera.yaw;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const mx = p.x + fx * 1.2;
  const mz = p.z + fz * 1.2;
  G.flashes.push({ x: mx, y: 1.4, z: mz, life: 0.07 });
  G.audio.shot();
  G.threat = { x: p.x, z: p.z, t: 2 };
  let best = null;
  let bd = PLAYER.shotRange;
  const consider = (t, isPed) => {
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > bd || d < 0.5) return;
    const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - yaw));
    if (ang > 0.5) return;
    best = t;
    bd = d;
    best.isPed = isPed;
  };
  for (const e of G.enemies) if (!e.dead) consider(e, false);
  if (!best) for (const ped of G.peds) if (ped.state !== 'down') consider(ped, true);
  const hitX = p.x + fx * bd;
  const hitZ = p.z + fz * bd;
  if (best) {
    spawnSparks(G, best.x, 1.3, best.z, 7, [255, 190, 130]);
    if (best.isPed) {
      best.state = 'down';
      best.downT = 5;
      best.moving = false;
      addWanted(G, 1, 'shot a pedestrian');
      say(G, 'You shot a pedestrian.', '#ff8a7a');
    } else {
      damageEnemy(G, best, PLAYER.shotDamage);
    }
  } else {
    spawnSparks(G, hitX, 0.6, hitZ, 3, [220, 200, 170]);
  }
  if (G.wanted.shotCooldown <= 0) {
    const policeNear = G.vehicles.some((v) => v.kind === 'police' && dist2(p.x, p.z, v.x, v.z) < 65);
    const witness = G.peds.some((ped) => ped.state !== 'down' && dist2(p.x, p.z, ped.x, ped.z) < 22);
    if (policeNear || witness) {
      addWanted(G, 1, 'gunfire');
      G.wanted.shotCooldown = 6;
    }
  }
}

export function playerPunch(G) {
  const p = G.player;
  if (p.punchT > 0 || p.dead || p.driving) return;
  p.punchT = 0.32;
  G.audio.punch();
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = dist2(p.x, p.z, e.x, e.z);
    if (d > PLAYER.punchRange) continue;
    const ang = Math.abs(wrapAngle(Math.atan2(e.x - p.x, e.z - p.z) - p.heading));
    if (ang > 1.1) continue;
    damageEnemy(G, e, PLAYER.punchDamage);
    e.x += Math.sin(p.heading) * 1.2;
    e.z += Math.cos(p.heading) * 1.2;
    addShake(G, 0.12);
    return;
  }
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (dist2(p.x, p.z, ped.x, ped.z) > 2.2) continue;
    ped.state = 'flee';
    ped.fleeT = 3;
    return;
  }
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) { e.deadT += dt; continue; }
    e.punchT = Math.max(0, e.punchT - dt);
    e.shootT -= dt;
    const d = dist2(e.x, e.z, p.x, p.z);
    if (d > 48 || p.dead) {
      // Guarding: drift back to the post and wait.
      const gd = dist2(e.x, e.z, e.guardX, e.guardZ);
      e.moving = gd > 2;
      if (e.moving) {
        const want = Math.atan2(e.guardX - e.x, e.guardZ - e.z);
        e.heading = angLerp(e.heading, want, 1 - Math.exp(-4 * dt));
        e.x += Math.sin(e.heading) * 2.4 * dt;
        e.z += Math.cos(e.heading) * 2.4 * dt;
        e.phase += 2.4 * dt * 1.7;
      }
      continue;
    }
    const want = Math.atan2(p.x - e.x, p.z - e.z);
    e.heading = angLerp(e.heading, want, 1 - Math.exp(-6 * dt));
    if (e.weapon === 'fist') {
      if (d > 2.1) {
        e.moving = true;
        e.x += Math.sin(e.heading) * 4.6 * dt;
        e.z += Math.cos(e.heading) * 4.6 * dt;
        e.phase += 4.6 * dt * 1.7;
      } else {
        e.moving = false;
        if (e.shootT <= 0) {
          e.shootT = 1.1;
          e.punchT = 0.3;
          damagePlayer(G, 8, 'punch');
        }
      }
    } else {
      if (d > 26) {
        e.moving = true;
        e.x += Math.sin(e.heading) * 4.2 * dt;
        e.z += Math.cos(e.heading) * 4.2 * dt;
        e.phase += 4.2 * dt * 1.7;
      } else {
        e.moving = false;
        if (e.shootT <= 0) {
          e.shootT = 1.5;
          G.flashes.push({ x: e.x + Math.sin(e.heading), y: 1.4, z: e.z + Math.cos(e.heading), life: 0.07 });
          G.audio.shot();
          const hitChance = d < 16 ? 0.55 : 0.32;
          if (Math.random() < hitChance) damagePlayer(G, 9, 'bullet');
          else spawnSparks(G, p.x + (Math.random() - 0.5) * 3, 0.8, p.z + (Math.random() - 0.5) * 3, 3, [220, 200, 170]);
        }
      }
    }
    collideCircle(G.city, e, 0.6);
  }
  // Separation so thugs do not stack.
  for (let i = 0; i < G.enemies.length; i += 1) {
    for (let j = i + 1; j < G.enemies.length; j += 1) {
      const a = G.enemies[i];
      const b = G.enemies[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.4 && d > 0.01) {
        const push = (1.4 - d) / 2;
        a.x -= (dx / d) * push;
        a.z -= (dz / d) * push;
        b.x += (dx / d) * push;
        b.z += (dz / d) * push;
      }
    }
  }
  void clamp;
}
