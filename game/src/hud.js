// Everything drawn over the world: the HUD, the minimap, mission banners,
// the title and pause panels, and the busted, wasted and story-complete
// screens. All coordinates here are logical 1280x720 pixels.

import { VIEW, PALETTE, FONT, FONT_NUM, MISSION_NAMES, DEBT } from './config.js';
import { clamp, easeOut, easeOutBack } from './vec.js';
import { nearestCar } from './player.js';

let mapCache = null;
let mapSeed = -1;

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
}

function buildMinimap(city) {
  const c = document.createElement('canvas');
  c.width = 200;
  c.height = 154;
  const g = c.getContext('2d');
  const sx = 200 / 2600;
  const sy = 154 / 2000;
  g.fillStyle = '#221d18';
  g.fillRect(0, 0, 200, 154);
  g.fillStyle = '#2e6f8e';
  g.fillRect(0, city.waterY * sy, 200, 154 - city.waterY * sy);
  g.fillStyle = '#c8b18a';
  g.beginPath();
  g.arc(city.plaza.x * sx, city.plaza.y * sy, city.plaza.r * sx, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#8d8578';
  g.lineWidth = 2;
  for (const road of city.roads) {
    g.beginPath();
    g.moveTo(road.x1 * sx, road.y1 * sy);
    g.lineTo(road.x2 * sx, road.y2 * sy);
    g.stroke();
  }
  g.strokeStyle = '#5a5348';
  g.lineWidth = 4;
  g.strokeRect(0, 0, 200, 154);
  return c;
}

function drawMinimap(ctx, S) {
  if (!mapCache || mapSeed !== S.city.seed) {
    mapCache = buildMinimap(S.city);
    mapSeed = S.city.seed;
  }
  const mx = VIEW.width - 216;
  const my = 16;
  ctx.drawImage(mapCache, mx, my);
  const sx = 200 / 2600;
  const sy = 154 / 2000;
  const dot = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  if (S.marker) {
    const pulse = 4 + Math.sin(S.time * 4) * 1.5;
    dot(S.marker.x, S.marker.y, pulse + 3, 'rgba(255,217,77,0.35)');
    dot(S.marker.x, S.marker.y, 4, PALETTE.marker);
  }
  for (const car of S.wanted.police) dot(car.x, car.y, 3, Math.sin(S.time * 9) > 0 ? '#ff4d4d' : '#4da6ff');
  for (const e of S.enemies.list) if (!e.dead) dot(e.x, e.y, 2.5, '#e5534b');
  for (const p of S.pickups) dot(p.x, p.y, 3, '#7bc950');
  const player = S.player;
  ctx.save();
  ctx.translate(mx + player.x * sx, my + player.y * sy);
  ctx.rotate(player.heading + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 5);
  ctx.lineTo(-4.5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(245,239,226,0.85)';
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('N', mx + 6, my + 14);
}

function drawStars(ctx, x, y, stars) {
  for (let i = 0; i < 5; i += 1) {
    starPath(ctx, x + i * 26, y, 11);
    if (i < stars) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(245,239,226,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

function drawBanner(ctx, S) {
  const banner = S.banner;
  if (!banner) return;
  const inT = clamp(banner.t / 0.35, 0, 1);
  const outT = clamp((banner.dur - banner.t) / 0.4, 0, 1);
  const scale = easeOutBack(inT);
  const alpha = Math.min(1, outT * 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(VIEW.width / 2, 216);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 44px ${FONT}`;
  const w = Math.max(420, ctx.measureText(banner.title).width + 90);
  ctx.fillStyle = 'rgba(20,14,10,0.78)';
  ctx.fillRect(-w / 2, -44, w, banner.sub ? 96 : 72);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.strokeRect(-w / 2, -44, w, banner.sub ? 96 : 72);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(banner.title, 0, banner.sub ? -12 : -6);
  if (banner.sub) {
    ctx.font = `500 20px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(banner.sub, 0, 28);
  }
  ctx.restore();
}

function drawEdgeArrow(ctx, S) {
  const marker = S.marker;
  if (!marker) return;
  const cam = S.camera;
  const lx = VIEW.width / 2 + (marker.x - cam.x) * cam.zoom;
  const ly = VIEW.height / 2 + (marker.y - cam.y) * cam.zoom;
  if (lx > 60 && lx < VIEW.width - 60 && ly > 90 && ly < VIEW.height - 60) return;
  const cx = clamp(lx, 56, VIEW.width - 56);
  const cy = clamp(ly, 100, VIEW.height - 56);
  const angle = Math.atan2(ly - cy, lx - cx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = PALETTE.marker;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const d = Math.round(Math.hypot(marker.x - S.player.x, marker.y - S.player.y) / 10);
  ctx.font = `700 15px ${FONT_NUM}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`${d}m`, cx, cy + 30);
}

function drawHudPlay(ctx, S, pointer) {
  const player = S.player;
  // Top-left: cash, stars, health.
  panel(ctx, 16, 16, 218, 96);
  const cash = Math.round(S.cashShown);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 30px ${FONT_NUM}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`$${cash.toLocaleString('en-US')}`, 30, 50);
  ctx.font = `500 12px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`DEBT $${DEBT.toLocaleString('en-US')}`, 30, 68);
  drawStars(ctx, 32, 92, S.wanted.stars);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(140, 84, 80, 9);
  const hpFrac = clamp(player.health / 100, 0, 1);
  ctx.fillStyle = hpFrac > 0.5 ? PALETTE.health : hpFrac > 0.25 ? PALETTE.gold : PALETTE.danger;
  ctx.fillRect(140, 84, 80 * hpFrac, 9);

  // Top-centre: mission and objective, on a backing strip so the stack
  // reads over bright roads and the marker beacon.
  ctx.font = `600 19px ${FONT}`;
  const stackW = Math.max(360, ctx.measureText(S.objective).width + 64);
  ctx.fillStyle = 'rgba(20,14,10,0.45)';
  ctx.fillRect(VIEW.width / 2 - stackW / 2, 10, stackW, S.mission.timer > 0 ? 86 : 56);
  if (S.mission.active && S.mission.index < 4) {
    ctx.textAlign = 'center';
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(MISSION_NAMES[S.mission.index].toUpperCase(), VIEW.width / 2, 30);
  }
  ctx.font = `600 19px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'center';
  ctx.fillText(S.objective, VIEW.width / 2, 56);
  if (S.mission.timer > 0) {
    const urgent = S.mission.timer < 10;
    ctx.font = `800 ${urgent ? 34 : 26}px ${FONT_NUM}`;
    ctx.fillStyle = urgent ? (Math.sin(S.time * 8) > 0 ? PALETTE.danger : PALETTE.text) : PALETTE.text;
    ctx.fillText(S.mission.timer.toFixed(urgent ? 1 : 0), VIEW.width / 2, 88);
  }
  if (S.raceProgress && S.mission.index === 2) {
    ctx.font = `800 22px ${FONT_NUM}`;
    ctx.fillStyle = PALETTE.marker;
    ctx.fillText(`GATE ${S.raceProgress.hit}/${S.raceProgress.total}`, VIEW.width / 2, 88);
  }

  drawMinimap(ctx, S);

  // Bottom-left: controls, fading as the player settles in.
  if (S.time < 16) {
    ctx.globalAlpha = clamp((16 - S.time) / 3, 0, 1) * 0.9;
    ctx.font = `500 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('WASD move / drive   E enter car   F punch   Click shoot   Shift sprint   P pause', 20, VIEW.height - 20);
    ctx.globalAlpha = 1;
  }

  // Bottom-right: speed or weapon, and the enter-car prompt.
  ctx.textAlign = 'right';
  if (player.car) {
    ctx.font = `800 26px ${FONT_NUM}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${Math.round(player.speed * 0.36)} km/h`, VIEW.width - 20, VIEW.height - 20);
  } else if (player.hasPistol) {
    ctx.font = `700 20px ${FONT_NUM}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`PISTOL  ${player.ammo}`, VIEW.width - 20, VIEW.height - 20);
  }
  if (!player.car && nearestCar(S, player.x, player.y, 78)) {
    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = PALETTE.marker;
    ctx.textAlign = 'center';
    ctx.fillText('Press E to get in', VIEW.width / 2, VIEW.height - 64);
  }

  // Bust meter.
  if (S.wanted.bustT > 0) {
    const frac = clamp(S.wanted.bustT / 2.2, 0, 1);
    ctx.textAlign = 'center';
    ctx.font = `800 20px ${FONT}`;
    ctx.fillStyle = PALETTE.danger;
    ctx.fillText('POLICE CLOSING IN', VIEW.width / 2, VIEW.height - 110);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(VIEW.width / 2 - 110, VIEW.height - 100, 220, 10);
    ctx.fillStyle = PALETTE.danger;
    ctx.fillRect(VIEW.width / 2 - 110, VIEW.height - 100, 220 * frac, 10);
  }

  // Damage vignette and low-health pulse.
  if (player.hurtT > 0 || player.health < 30) {
    const a = clamp(player.hurtT * 0.8 + (player.health < 30 ? 0.14 + Math.sin(S.time * 5) * 0.06 : 0), 0, 0.55);
    const grad = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, 260, VIEW.width / 2, VIEW.height / 2, 700);
    grad.addColorStop(0, 'rgba(200,30,20,0)');
    grad.addColorStop(1, `rgba(200,30,20,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  // Crosshair when the pistol is out.
  if (!player.car && player.hasPistol && pointer) {
    ctx.strokeStyle = 'rgba(245,239,226,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 10, 0, Math.PI * 2);
    ctx.moveTo(pointer.x - 15, pointer.y);
    ctx.lineTo(pointer.x - 5, pointer.y);
    ctx.moveTo(pointer.x + 5, pointer.y);
    ctx.lineTo(pointer.x + 15, pointer.y);
    ctx.moveTo(pointer.x, pointer.y - 15);
    ctx.lineTo(pointer.x, pointer.y - 5);
    ctx.moveTo(pointer.x, pointer.y + 5);
    ctx.lineTo(pointer.x, pointer.y + 15);
    ctx.stroke();
  }

  drawEdgeArrow(ctx, S);
  drawBanner(ctx, S);
}

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(18,11,6,${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function drawTitle(ctx, S) {
  dim(ctx, 0.42);
  const t = S.time;
  const slide = (delay) => {
    const u = clamp((t - delay) / 0.55, 0, 1);
    return (1 - easeOut(u)) * 26;
  };
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  try { ctx.letterSpacing = '10px'; } catch { /* older canvas */ }
  ctx.font = `900 84px ${FONT}`;
  const grad = ctx.createLinearGradient(0, 150, 0, 240);
  grad.addColorStop(0, '#ffe9a8');
  grad.addColorStop(1, PALETTE.goldDeep);
  ctx.fillStyle = grad;
  ctx.fillText('JAKARTA HEAT', VIEW.width / 2, 210 + slide(0));
  try { ctx.letterSpacing = '4px'; } catch { /* older canvas */ }
  ctx.font = `600 21px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('A fictional Jakarta, 2026. One debt. Four jobs.', VIEW.width / 2, 252 + slide(0.12));
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }

  const lines = [
    'Bimo owes the fixer Bu Ratna $5,000. Drive, fight and race across the city to pay it back.',
    'WASD move and drive  ·  E enter a car  ·  F punch  ·  Click shoot  ·  Shift sprint  ·  P pause',
  ];
  ctx.font = `500 18px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 316 + i * 30 + slide(0.24 + i * 0.1)));

  const prompt = S.hasSave ? 'ENTER — Continue the story' : 'ENTER — Start the story';
  const pulse = 0.75 + Math.sin(t * 3) * 0.25;
  ctx.globalAlpha = pulse;
  ctx.font = `800 24px ${FONT}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(prompt, VIEW.width / 2, 430 + slide(0.5));
  ctx.globalAlpha = 1;
  ctx.font = `500 16px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('N — New story      M — Sound', VIEW.width / 2, 466 + slide(0.6));
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = 'rgba(201,189,166,0.7)';
  ctx.fillText('All places, people and brands are fictional. No real trademarks appear.', VIEW.width / 2, VIEW.height - 26);
}

function drawCenterPanel(ctx, title, lines, prompt, titleColor) {
  dim(ctx, 0.55);
  const w = 560;
  const h = 150 + lines.length * 30;
  const x = (VIEW.width - w) / 2;
  const y = (VIEW.height - h) / 2;
  panel(ctx, x, y, w, h);
  ctx.textAlign = 'center';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillStyle = titleColor || PALETTE.text;
  ctx.fillText(title, VIEW.width / 2, y + 62);
  ctx.font = `500 18px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, y + 104 + i * 30));
  if (prompt) {
    ctx.font = `700 19px ${FONT}`;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(prompt, VIEW.width / 2, y + h - 24);
  }
}

function drawDone(ctx, S) {
  dim(ctx, 0.5);
  ctx.textAlign = 'center';
  ctx.font = `900 72px ${FONT}`;
  const grad = ctx.createLinearGradient(0, 180, 0, 260);
  grad.addColorStop(0, '#ffe9a8');
  grad.addColorStop(1, PALETTE.goldDeep);
  ctx.fillStyle = grad;
  ctx.fillText('DEBT PAID', VIEW.width / 2, 250);
  ctx.font = `600 22px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('Bu Ratna is paid in full. Jakarta is yours now, Bimo.', VIEW.width / 2, 296);
  const mins = Math.floor((S.stats.playTime || 0) / 60);
  const secs = Math.floor((S.stats.playTime || 0) % 60);
  ctx.font = `700 24px ${FONT_NUM}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`$${S.cash.toLocaleString('en-US')}   ·   ${mins}:${String(secs).padStart(2, '0')}   ·   4 missions`, VIEW.width / 2, 350);
  const pulse = 0.75 + Math.sin(S.time * 3) * 0.25;
  ctx.globalAlpha = pulse;
  ctx.font = `800 21px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('ENTER — Keep exploring', VIEW.width / 2, 420);
  ctx.globalAlpha = 1;
}

export function drawHud(ctx, S, screen, pointer) {
  if (screen === 'title') {
    drawTitle(ctx, S);
    return;
  }
  drawHudPlay(ctx, S, pointer);
  if (screen === 'paused') {
    drawCenterPanel(ctx, 'Paused', ['WASD move and drive  ·  E enter a car  ·  F punch  ·  Click shoot', 'Shift sprint and handbrake  ·  M sound'], 'P — Resume', PALETTE.text);
  } else if (screen === 'busted') {
    drawCenterPanel(ctx, 'BUSTED', ['The police took $150. Bu Ratna is not impressed.', 'The current mission restarts.'], 'ENTER — Back on the street', PALETTE.danger);
  } else if (screen === 'wasted') {
    drawCenterPanel(ctx, 'WASTED', ['Bimo wakes up at the warung, $100 lighter.', 'The current mission restarts.'], 'ENTER — Back on the street', PALETTE.danger);
  } else if (screen === 'done') {
    drawDone(ctx, S);
  }
}
