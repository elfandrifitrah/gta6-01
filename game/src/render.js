// Drawing only: the city, its people and cars, the golden-hour grade. The
// static ground (roads, blocks, plaza, water) is baked once to an offscreen
// canvas; buildings, props and actors are drawn every frame, sorted by their
// base height so near things overlap far things. Faces and shadows are faked
// with extrusions, which reads as depth without a 3D pipeline.

import { VIEW, WORLD, PALETTE, FONT, FONT_NUM } from './config.js';
import { clamp } from './vec.js';
import { drawHud } from './hud.js';

function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let ground = null;
  let groundSeed = -1;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function bakeGround(city) {
    const c = document.createElement('canvas');
    c.width = WORLD.width;
    c.height = WORLD.height;
    const g = c.getContext('2d');
    g.fillStyle = PALETTE.groundDirt;
    g.fillRect(0, 0, WORLD.width, WORLD.height);
    // Block ground: alternating grass and dirt yards.
    const xBands = [[40, 478], [562, 1236], [1364, 2038], [2122, 2560]];
    const yBands = [[40, 324], [396, 964], [1036, 1592]];
    const tints = ['#7d8f57', '#87945e', '#a8936a', '#7d8f57'];
    let bi = 0;
    for (const [x0, x1] of xBands) {
      for (const [y0, y1] of yBands) {
        g.fillStyle = tints[bi % tints.length];
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        bi += 1;
      }
    }
    // Plaza disc and its pool.
    g.fillStyle = PALETTE.groundPlaza;
    g.beginPath();
    g.arc(city.plaza.x, city.plaza.y, city.plaza.r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(120,100,70,0.5)';
    g.lineWidth = 4;
    for (const r of [150, 200, 235]) {
      g.beginPath();
      g.arc(city.plaza.x, city.plaza.y, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = PALETTE.water;
    g.fillRect(city.plaza.x - 70, city.plaza.y + 52, 140, 56);
    g.fillStyle = 'rgba(255,240,200,0.35)';
    g.fillRect(city.plaza.x - 70, city.plaza.y + 52, 140, 6);
    // Port apron and the sea.
    g.fillStyle = PALETTE.groundDock;
    g.fillRect(0, 1688, WORLD.width, 212);
    g.fillStyle = PALETTE.waterDeep;
    g.fillRect(0, city.waterY, WORLD.width, WORLD.height - city.waterY);
    const grad = g.createLinearGradient(0, city.waterY, 0, WORLD.height);
    grad.addColorStop(0, 'rgba(120,190,220,0.35)');
    grad.addColorStop(1, 'rgba(20,50,80,0.1)');
    g.fillStyle = grad;
    g.fillRect(0, city.waterY, WORLD.width, WORLD.height - city.waterY);
    g.fillStyle = 'rgba(255,230,170,0.4)';
    for (let i = 0; i < 26; i += 1) {
      const gx = hash2(i, 3) * WORLD.width;
      const gy = city.waterY + 8 + hash2(i, 7) * 80;
      g.fillRect(gx, gy, 30 + hash2(i, 11) * 60, 2);
    }
    // Roads: sidewalk edge, asphalt, lane paint.
    for (const road of city.roads) {
      const horizontal = road.y1 === road.y2;
      const len = horizontal ? road.x2 - road.x1 : road.y2 - road.y1;
      g.fillStyle = PALETTE.sidewalk;
      if (horizontal) g.fillRect(road.x1, road.y1 - road.w / 2 - 14, len, road.w + 28);
      else g.fillRect(road.x1 - road.w / 2 - 14, road.y1, road.w + 28, len);
      g.fillStyle = PALETTE.asphalt;
      if (horizontal) g.fillRect(road.x1, road.y1 - road.w / 2, len, road.w);
      else g.fillRect(road.x1 - road.w / 2, road.y1, road.w, len);
      if (road.kind !== 'alley') {
        g.strokeStyle = PALETTE.lane;
        g.lineWidth = 3;
        g.setLineDash([26, 22]);
        g.beginPath();
        if (horizontal) {
          g.moveTo(road.x1, road.y1);
          g.lineTo(road.x2, road.y2);
        } else {
          g.moveTo(road.x1, road.y1);
          g.lineTo(road.x2, road.y2);
        }
        g.stroke();
        g.setLineDash([]);
      }
    }
    // Sudirman median strip.
    g.fillStyle = '#6a7a4a';
    g.fillRect(1300 - 12, 0, 24, WORLD.height);
    // Crosswalks where avenues meet streets.
    g.fillStyle = 'rgba(240,236,224,0.75)';
    for (const ax of [520, 1300, 2080]) {
      for (const sy of [360, 1000, 1640]) {
        for (let i = -3; i <= 3; i += 1) {
          g.fillRect(ax - 46 + i * 14, sy - 58, 7, 26);
          g.fillRect(ax - 46 + i * 14, sy + 32, 7, 26);
        }
        for (let i = -2; i <= 2; i += 1) {
          g.fillRect(ax - 58, sy - 32 + i * 14, 26, 7);
          g.fillRect(ax + 32, sy - 32 + i * 14, 26, 7);
        }
      }
    }
    // Manholes and drains.
    g.fillStyle = 'rgba(30,28,34,0.6)';
    for (let i = 0; i < 40; i += 1) {
      const mx = hash2(i, 21) * WORLD.width;
      const my = hash2(i, 33) * 1700;
      g.beginPath();
      g.arc(mx, my, 5, 0, Math.PI * 2);
      g.fill();
    }
    return c;
  }

  function drawBuilding(b, time) {
    const ox = b.h * 0.18;
    const oy = b.h * 0.3;
    // Long golden-hour shadow to the lower right.
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.moveTo(b.x + b.h * 0.7, b.y + b.d + b.h * 0.32);
    ctx.lineTo(b.x + b.w + b.h * 0.7, b.y + b.d + b.h * 0.32);
    ctx.lineTo(b.x + b.w + b.h * 0.7 + b.h * 0.5, b.y + b.d + b.h * 0.32 + b.h * 0.2);
    ctx.lineTo(b.x + b.h * 0.7 + b.h * 0.5, b.y + b.d + b.h * 0.32 + b.h * 0.2);
    ctx.closePath();
    ctx.fill();
    // South face.
    ctx.fillStyle = PALETTE.faceSouth;
    ctx.beginPath();
    ctx.moveTo(b.x - ox, b.y - oy + b.d);
    ctx.lineTo(b.x - ox + b.w, b.y - oy + b.d);
    ctx.lineTo(b.x + b.w, b.y + b.d);
    ctx.lineTo(b.x, b.y + b.d);
    ctx.closePath();
    ctx.fill();
    // East face.
    ctx.fillStyle = PALETTE.faceEast;
    ctx.beginPath();
    ctx.moveTo(b.x - ox + b.w, b.y - oy);
    ctx.lineTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w, b.y + b.d);
    ctx.lineTo(b.x - ox + b.w, b.y - oy + b.d);
    ctx.closePath();
    ctx.fill();
    // Windows on the south face, some lit for dusk.
    const faceH = oy + 6;
    const cols = Math.max(2, Math.floor(b.w / 30));
    const rows = Math.max(1, Math.floor(faceH / 16));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const lit = hash2(b.litSeed + i, j) < 0.34;
        ctx.fillStyle = lit ? '#ffd98a' : 'rgba(30,34,44,0.75)';
        const wx = b.x - ox + 8 + i * ((b.w - 16) / cols);
        const wy = b.y - oy + b.d + 4 + j * ((faceH - 8) / Math.max(1, rows));
        ctx.fillRect(wx, wy, (b.w - 16) / cols - 6, Math.max(4, (faceH - 8) / Math.max(1, rows) - 4));
      }
    }
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x - ox, b.y - oy, b.w, b.d);
    ctx.fillStyle = 'rgba(255,240,210,0.16)';
    ctx.fillRect(b.x - ox, b.y - oy, b.w, 5);
    // Roof furniture: panel seams and plant boxes, so big roofs read.
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 1;
    const seamX = Math.max(2, Math.floor(b.w / 90));
    const seamY = Math.max(2, Math.floor(b.d / 70));
    for (let i = 1; i < seamX; i += 1) {
      ctx.beginPath();
      ctx.moveTo(b.x - ox + (b.w * i) / seamX, b.y - oy);
      ctx.lineTo(b.x - ox + (b.w * i) / seamX, b.y - oy + b.d);
      ctx.stroke();
    }
    for (let j = 1; j < seamY; j += 1) {
      ctx.beginPath();
      ctx.moveTo(b.x - ox, b.y - oy + (b.d * j) / seamY);
      ctx.lineTo(b.x - ox + b.w, b.y - oy + (b.d * j) / seamY);
      ctx.stroke();
    }
    const boxes = b.w * b.d > 12000 ? 3 : 1;
    for (let i = 0; i < boxes; i += 1) {
      const bx = b.x - ox + 12 + hash2(b.litSeed, 40 + i) * Math.max(10, b.w - 44);
      const by = b.y - oy + 10 + hash2(b.litSeed, 60 + i) * Math.max(10, b.d - 36);
      ctx.fillStyle = 'rgba(50,46,44,0.55)';
      ctx.fillRect(bx, by, 20, 14);
      ctx.fillStyle = 'rgba(255,240,210,0.18)';
      ctx.fillRect(bx, by, 20, 3);
    }
    if (b.kind === 'tower') {
      ctx.fillStyle = 'rgba(40,38,44,0.5)';
      ctx.fillRect(b.x - ox + b.w * 0.2, b.y - oy + b.d * 0.25, 18, 14);
      ctx.beginPath();
      ctx.arc(b.x - ox + b.w * 0.7, b.y - oy + b.d * 0.6, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.kind === 'house') {
      ctx.strokeStyle = 'rgba(60,30,20,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x - ox, b.y - oy + b.d / 2);
      ctx.lineTo(b.x - ox + b.w, b.y - oy + b.d / 2);
      ctx.stroke();
    }
    if (b.awning) {
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = i % 2 ? '#e8e4da' : '#c94a3a';
        ctx.fillRect(b.x + 6 + i * 12, b.y + b.d - 2, 12, 10);
      }
    }
    if (b.sign) {
      ctx.font = `700 ${Math.min(20, b.w / 8)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(b.sign).width + 16;
      ctx.fillStyle = 'rgba(24,20,16,0.85)';
      ctx.fillRect(b.x + b.w / 2 - tw / 2, b.y - oy + b.d * 0.32, tw, 24);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(b.sign, b.x + b.w / 2, b.y - oy + b.d * 0.32 + 13);
    }
  }

  function drawProp(p, time) {
    if (p.kind === 'palm') {
      ctx.strokeStyle = '#7a5a3a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + p.lean * 30, p.y - 26, p.x + p.lean * 44, p.y - 48);
      ctx.stroke();
      const topX = p.x + p.lean * 44;
      const topY = p.y - 48;
      ctx.strokeStyle = '#4a7a3a';
      ctx.lineWidth = 4;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + Math.sin(time * 0.8 + p.x) * 0.05;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.quadraticCurveTo(topX + Math.cos(a) * 18, topY + Math.sin(a) * 18 - 6, topX + Math.cos(a) * 30, topY + Math.sin(a) * 30 + 6);
        ctx.stroke();
      }
      ctx.fillStyle = '#6a4a2a';
      ctx.beginPath();
      ctx.arc(topX, topY + 3, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'lamp') {
      ctx.strokeStyle = '#3a3a42';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - 44);
      ctx.stroke();
      const glow = ctx.createRadialGradient(p.x, p.y - 46, 2, p.x, p.y - 46, 26);
      glow.addColorStop(0, 'rgba(255,220,140,0.85)');
      glow.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 46, 26, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'billboard') {
      ctx.fillStyle = '#3a3a42';
      ctx.fillRect(p.x - 4, p.y - 52, 5, 52);
      ctx.fillRect(p.x + 56, p.y - 52, 5, 52);
      ctx.fillStyle = '#23202a';
      ctx.fillRect(p.x - 14, p.y - 96, 92, 46);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.x + 32, p.y - 73);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(p.x - 14, p.y - 96, 92, 8);
    } else if (p.kind === 'stall') {
      ctx.fillStyle = '#8a6f52';
      ctx.fillRect(p.x - 30, p.y - 26, 60, 26);
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = i % 2 ? '#e8e4da' : '#c94a3a';
        ctx.fillRect(p.x - 34 + i * 12, p.y - 44, 12, 18);
      }
      ctx.fillStyle = '#5d4a34';
      ctx.fillRect(p.x - 30, p.y - 6, 60, 6);
      if (p.big) {
        ctx.font = `800 13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = PALETTE.gold;
        ctx.fillText('WARUNG BU RATNA', p.x, p.y - 52);
        drawStar(p.x, p.y - 72 + Math.sin(time * 2) * 3, 9, PALETTE.gold);
      }
    } else if (p.kind === 'cart') {
      ctx.fillStyle = '#a85f43';
      ctx.fillRect(p.x - 16, p.y - 14, 32, 14);
      ctx.fillStyle = '#e8c84a';
      ctx.beginPath();
      ctx.moveTo(p.x - 20, p.y - 14);
      ctx.lineTo(p.x + 20, p.y - 14);
      ctx.lineTo(p.x, p.y - 34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a2a30';
      ctx.beginPath();
      ctx.arc(p.x - 10, p.y + 2, 4, 0, Math.PI * 2);
      ctx.arc(p.x + 10, p.y + 2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'planter') {
      ctx.fillStyle = '#8a8073';
      ctx.fillRect(p.x - 12, p.y - 8, 24, 10);
      ctx.fillStyle = '#5a8a4a';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 12, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'cone') {
      ctx.fillStyle = '#e87e2c';
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y);
      ctx.lineTo(p.x + 7, p.y);
      ctx.lineTo(p.x, p.y - 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(p.x - 3, p.y - 9, 6, 3);
    } else if (p.kind === 'container') {
      ctx.fillStyle = PALETTE.shadow;
      ctx.fillRect(p.x + 6, p.y + 6, p.w, p.d);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.w, p.d);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(p.x, p.y, p.w, 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 6; i += 1) {
        ctx.beginPath();
        ctx.moveTo(p.x + (p.w / 6) * i, p.y + 3);
        ctx.lineTo(p.x + (p.w / 6) * i, p.y + p.d - 3);
        ctx.stroke();
      }
      if (p.stacked) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x + 8, p.y - 26, p.w - 16, 26);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(p.x + 8, p.y - 26, p.w - 16, 5);
      }
    } else if (p.kind === 'crane') {
      ctx.strokeStyle = '#b4552d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(p.x - 16, p.y);
      ctx.lineTo(p.x - 10, p.y - 150);
      ctx.moveTo(p.x + 16, p.y);
      ctx.lineTo(p.x + 10, p.y - 150);
      ctx.moveTo(p.x - 10, p.y - 150);
      ctx.lineTo(p.x + 10, p.y - 150);
      ctx.moveTo(p.x - 60, p.y - 138);
      ctx.lineTo(p.x + 90, p.y - 138);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 14, p.y - 30);
      ctx.lineTo(p.x + 14, p.y - 70);
      ctx.moveTo(p.x + 14, p.y - 30);
      ctx.lineTo(p.x - 14, p.y - 70);
      ctx.stroke();
      ctx.strokeStyle = '#2a2a30';
      ctx.lineWidth = 2;
      const sway = Math.sin(time * 0.5 + p.x) * 4;
      ctx.beginPath();
      ctx.moveTo(p.x + 70, p.y - 138);
      ctx.lineTo(p.x + 70 + sway, p.y - 96);
      ctx.stroke();
      ctx.fillStyle = '#3f7d8c';
      ctx.fillRect(p.x + 60 + sway, p.y - 96, 22, 16);
    } else if (p.kind === 'monument') {
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.ellipse(p.x + 60, p.y + 26, 70, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c8b89a';
      ctx.fillRect(p.x - 34, p.y - 8, 68, 16);
      ctx.fillStyle = '#ddd0b0';
      ctx.beginPath();
      ctx.moveTo(p.x - 16, p.y - 8);
      ctx.lineTo(p.x - 9, p.y - 148);
      ctx.lineTo(p.x + 9, p.y - 148);
      ctx.lineTo(p.x + 16, p.y - 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,210,0.35)';
      ctx.fillRect(p.x - 9, p.y - 148, 5, 140);
      const flick = 1 + Math.sin(time * 9) * 0.12 + Math.sin(time * 23) * 0.08;
      const glow = ctx.createRadialGradient(p.x, p.y - 158, 2, p.x, p.y - 158, 34);
      glow.addColorStop(0, 'rgba(255,190,80,0.9)');
      glow.addColorStop(1, 'rgba(255,190,80,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 158, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffbe50';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 178 * flick);
      ctx.quadraticCurveTo(p.x + 12, p.y - 158, p.x, p.y - 146);
      ctx.quadraticCurveTo(p.x - 12, p.y - 158, p.x, p.y - 178 * flick);
      ctx.fill();
    } else if (p.kind === 'laundry') {
      ctx.strokeStyle = '#3a3a42';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 26, p.y);
      ctx.lineTo(p.x - 26, p.y - 30);
      ctx.moveTo(p.x + 26, p.y);
      ctx.lineTo(p.x + 26, p.y - 30);
      ctx.stroke();
      ctx.strokeStyle = '#c9bda6';
      ctx.beginPath();
      ctx.moveTo(p.x - 26, p.y - 30);
      ctx.quadraticCurveTo(p.x, p.y - 24, p.x + 26, p.y - 30);
      ctx.stroke();
      const cols = ['#d86a4a', '#e8e4da', '#4a7ad8'];
      for (let i = 0; i < 3; i += 1) {
        const sway = Math.sin(time * 1.4 + i * 2) * 2;
        ctx.fillStyle = cols[i];
        ctx.fillRect(p.x - 18 + i * 18 + sway, p.y - 27, 12, 14);
      }
    }
  }

  function drawStar(x, y, r, color) {
    ctx.fillStyle = color;
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
    ctx.fill();
  }

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);
    ctx.fillStyle = PALETTE.shadow;
    roundRect(ctx, -car.w / 2 + 4, -car.d / 2 + 5, car.w, car.d, 8);
    ctx.fill();
    if (car.kind === 'bike') {
      ctx.fillStyle = '#2a2a30';
      roundRect(ctx, -17, -6, 34, 12, 6);
      ctx.fill();
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.arc(2, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e4da';
      ctx.beginPath();
      ctx.arc(2, -2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    // Wheels.
    ctx.fillStyle = '#1c1c22';
    const ww = car.kind === 'bajaj' ? 8 : 11;
    ctx.fillRect(-car.w / 2 + 8, -car.d / 2 - 3, ww, 6);
    ctx.fillRect(-car.w / 2 + 8, car.d / 2 - 3, ww, 6);
    ctx.fillRect(car.w / 2 - 8 - ww, -car.d / 2 - 3, ww, 6);
    ctx.fillRect(car.w / 2 - 8 - ww, car.d / 2 - 3, ww, 6);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -car.w / 2, -car.d / 2, car.w, car.d, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, -car.w / 2 + 3, -car.d / 2 + 3, car.w - 6, 8, 4);
    ctx.fill();
    if (car.police) {
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(-8, -car.d / 2, 16, car.d);
      ctx.fillStyle = '#20242c';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLISI', 0, 3);
    }
    // Cabin and glass.
    const cabinW = car.w * 0.44;
    ctx.fillStyle = car.kind === 'bajaj' ? '#2a2a30' : '#20242c';
    roundRect(ctx, -cabinW / 2 - 2, -car.d / 2 + 5, cabinW, car.d - 10, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,210,230,0.75)';
    ctx.fillRect(cabinW / 2 - 10, -car.d / 2 + 7, 7, car.d - 14);
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(-8, -5, 16, 10);
      ctx.fillStyle = '#20242c';
      ctx.font = '700 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    if (car.kind === 'bajaj') {
      ctx.fillStyle = '#e87e2c';
      roundRect(ctx, -car.w / 2, -car.d / 2, car.w * 0.6, car.d, 8);
      ctx.fill();
    }
    // Headlights and tail lights.
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(car.w / 2 - 3, -car.d / 2 + 4, 3, 6);
    ctx.fillRect(car.w / 2 - 3, car.d / 2 - 10, 3, 6);
    ctx.fillStyle = car.brakeLight ? '#ff5a4a' : '#a83a32';
    ctx.fillRect(-car.w / 2, -car.d / 2 + 4, 3, 6);
    ctx.fillRect(-car.w / 2, car.d / 2 - 10, 3, 6);
    if (car.police) {
      const phase = Math.floor((car.flashPhase || 0) % 2);
      ctx.fillStyle = phase === 0 ? PALETTE.policeRed : PALETTE.policeBlue;
      ctx.fillRect(-6, -car.d / 2 - 2, 12, 5);
      ctx.fillStyle = phase === 0 ? PALETTE.policeBlue : PALETTE.policeRed;
      ctx.fillRect(-6, car.d / 2 - 3, 12, 5);
    }
    if (car.hp < 55) {
      ctx.fillStyle = 'rgba(30,30,34,0.5)';
      ctx.beginPath();
      ctx.arc(car.w / 2 - 8, 0, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(x, y, heading, opts, time) {
    const bob = opts.moving ? Math.sin(opts.phase || 0) * 1.6 : 0;
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 8, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y + bob * 0.4);
    ctx.rotate(heading + Math.PI / 2);
    // Legs.
    const step = opts.moving ? Math.sin(opts.phase || 0) * 4 : 0;
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(-6, -2 + step, 5, 12);
    ctx.fillRect(1, -2 - step, 5, 12);
    // Body.
    ctx.fillStyle = opts.flash > 0 ? '#ffffff' : opts.shirt;
    roundRect(ctx, -8, -12, 16, 20, 7);
    ctx.fill();
    // Head.
    ctx.fillStyle = PALETTE.playerSkin;
    ctx.beginPath();
    ctx.arc(0, -16, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = opts.hat || '#2a2a30';
    ctx.beginPath();
    ctx.arc(0, -18, 7, Math.PI, Math.PI * 2);
    ctx.fill();
    if (opts.gun) {
      ctx.strokeStyle = '#22222a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(4, -8);
      ctx.lineTo(4, -24);
      ctx.stroke();
    }
    if (opts.punching) {
      ctx.fillStyle = PALETTE.playerSkin;
      ctx.beginPath();
      ctx.arc(0, -30, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (opts.hpBar !== null && opts.hpBar !== undefined && opts.hpBar < 1) {
      ctx.fillStyle = 'rgba(20,16,12,0.8)';
      ctx.fillRect(x - 18, y - 34, 36, 5);
      ctx.fillStyle = opts.hpBar > 0.5 ? '#7bc950' : opts.hpBar > 0.25 ? '#f2c14e' : '#e5534b';
      ctx.fillRect(x - 18, y - 34, 36 * clamp(opts.hpBar, 0, 1), 5);
    }
    if (opts.telegraph > 0) {
      ctx.strokeStyle = `rgba(255,80,60,${0.5 + 0.5 * Math.sin(time * 30)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPickup(p, time) {
    const bob = Math.sin(time * 3 + p.phase) * 3;
    const glow = ctx.createRadialGradient(p.x, p.y + bob, 2, p.x, p.y + bob, 26);
    glow.addColorStop(0, 'rgba(255,215,90,0.5)');
    glow.addColorStop(1, 'rgba(255,215,90,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 26, 0, Math.PI * 2);
    ctx.fill();
    if (p.kind === 'suitcase') {
      ctx.fillStyle = '#8a5a2a';
      roundRect(ctx, p.x - 14, p.y - 10 + bob, 28, 18, 3);
      ctx.fill();
      ctx.strokeStyle = '#5d3a1a';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - 14, p.y - 10 + bob, 28, 18);
      ctx.strokeRect(p.x - 5, p.y - 14 + bob, 10, 5);
    } else if (p.kind === 'ledger') {
      ctx.fillStyle = '#3a5a8c';
      roundRect(ctx, p.x - 11, p.y - 13 + bob, 22, 26, 2);
      ctx.fill();
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(p.x - 7, p.y - 8 + bob, 14, 3);
      ctx.fillRect(p.x - 7, p.y - 2 + bob, 14, 3);
    } else if (p.kind === 'ammo') {
      ctx.fillStyle = '#5a7a4a';
      ctx.fillRect(p.x - 11, p.y - 8 + bob, 22, 15);
      ctx.fillStyle = '#d8b13c';
      ctx.fillRect(p.x - 7, p.y - 5 + bob, 4, 9);
      ctx.fillRect(p.x - 1, p.y - 5 + bob, 4, 9);
      ctx.fillRect(p.x + 5, p.y - 5 + bob, 4, 9);
    } else {
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(p.x - 11, p.y - 9 + bob, 22, 18);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(p.x - 3, p.y - 6 + bob, 6, 12);
      ctx.fillRect(p.x - 6, p.y - 3 + bob, 12, 6);
    }
  }

  function drawMarker(marker, time) {
    const pulse = 1 + Math.sin(time * 4) * 0.12;
    ctx.fillStyle = 'rgba(255,217,77,0.25)';
    ctx.beginPath();
    ctx.ellipse(marker.x, marker.y, marker.r * 0.6 * pulse, marker.r * 0.3 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,77,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(marker.x, marker.y, marker.r * 0.6 * pulse, marker.r * 0.3 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    const grad = ctx.createLinearGradient(marker.x, marker.y - 190, marker.x, marker.y);
    grad.addColorStop(0, 'rgba(255,217,77,0)');
    grad.addColorStop(1, 'rgba(255,217,77,0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(marker.x - 7, marker.y - 190, 14, 190);
    ctx.save();
    ctx.translate(marker.x, marker.y - 200 + Math.sin(time * 2.4) * 6);
    ctx.rotate(Math.PI / 4 + time * 0.8);
    ctx.fillStyle = PALETTE.marker;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }

  function draw(S, screen, pointer) {
    if (!ground || groundSeed !== S.city.seed) {
      ground = bakeGround(S.city);
      groundSeed = S.city.seed;
    }
    const cam = S.camera;
    const shake = S.fx.shakeOffset();
    const time = S.time;
    const z = cam.zoom;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1c1410';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = view.scale * z;
    const ox = view.x + (VIEW.width / 2 - (cam.x + shake.x) * z) * view.scale;
    const oy = view.y + (VIEW.height / 2 - (cam.y + shake.y) * z) * view.scale;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    // Visible world rect, for culling.
    const vw = VIEW.width / z;
    const vh = VIEW.height / z;
    const vx0 = cam.x - vw / 2 - 60;
    const vy0 = cam.y - vh / 2 - 60;
    const vx1 = cam.x + vw / 2 + 60;
    const vy1 = cam.y + vh / 2 + 60;

    const sx = clamp(cam.x - vw / 2, 0, WORLD.width);
    const sy = clamp(cam.y - vh / 2, 0, WORLD.height);
    const sw = Math.min(vw, WORLD.width - sx);
    const sh = Math.min(vh, WORLD.height - sy);
    ctx.drawImage(ground, sx, sy, sw, sh, sx, sy, sw, sh);

    // Animated glints on the water.
    if (vy1 > S.city.waterY) {
      ctx.fillStyle = 'rgba(255,236,180,0.5)';
      for (let i = 0; i < 10; i += 1) {
        const gx = 200 + i * 240 + Math.sin(time * 0.7 + i * 2) * 30;
        ctx.fillRect(gx, S.city.waterY + 14 + (i % 4) * 20, 44, 2);
      }
    }

    // Y-sorted drawables: buildings, props, cars, people, pickups.
    const items = [];
    for (const b of S.city.buildings) {
      if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.d < vy0 || b.y - b.h > vy1) continue;
      items.push({ y: b.y + b.d, kind: 'building', ref: b });
    }
    for (const p of S.city.props) {
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 - 160 || p.y > vy1) continue;
      items.push({ y: p.y, kind: 'prop', ref: p });
    }
    for (const car of S.cars) {
      if (car.dead) continue;
      if (car.x < vx0 || car.x > vx1 || car.y < vy0 || car.y > vy1) continue;
      items.push({ y: car.y + car.d / 2, kind: 'car', ref: car });
    }
    for (const ped of S.peds) {
      if (ped.x < vx0 || ped.x > vx1 || ped.y < vy0 || ped.y > vy1) continue;
      items.push({ y: ped.y + 10, kind: 'ped', ref: ped });
    }
    for (const e of S.enemies.list) {
      if (e.x < vx0 || e.x > vx1 || e.y < vy0 || e.y > vy1) continue;
      items.push({ y: e.y + 10, kind: 'enemy', ref: e });
    }
    for (const p of S.pickups) items.push({ y: p.y, kind: 'pickup', ref: p });
    const player = S.player;
    if (!player.car) items.push({ y: player.y + 10, kind: 'player', ref: player });
    items.sort((a, b) => a.y - b.y);

    for (const item of items) {
      if (item.kind === 'building') drawBuilding(item.ref, time);
      else if (item.kind === 'prop') drawProp(item.ref, time);
      else if (item.kind === 'car') drawCar(item.ref, time);
      else if (item.kind === 'ped') {
        const ped = item.ref;
        if (ped.state === 'down') {
          ctx.save();
          ctx.translate(ped.x, ped.y);
          ctx.rotate(1.2);
          ctx.fillStyle = ped.shirt;
          roundRect(ctx, -14, -6, 28, 12, 6);
          ctx.fill();
          ctx.restore();
        } else {
          drawPerson(ped.x, ped.y, ped.heading, { shirt: ped.shirt, moving: ped.state !== 'walk' || !!ped.tx, phase: ped.phase, hat: '#4a3a2a' }, time);
        }
      } else if (item.kind === 'enemy') {
        const e = item.ref;
        const alpha = e.dead ? clamp(e.deathT / 0.5, 0, 1) : 1;
        ctx.globalAlpha = alpha;
        const look = e.kind === 'thief'
          ? { shirt: '#e8c84a', hat: '#c94a3a', gun: false }
          : e.kind === 'goon'
            ? { shirt: '#3a3f46', hat: '#22222a', gun: false }
            : { shirt: '#2c3440', hat: '#1c212c', gun: true };
        drawPerson(e.x, e.y, e.heading, {
          ...look, moving: true, phase: e.phase, flash: e.flash,
          hpBar: e.hp / e.maxHp, telegraph: e.telegraph,
        }, time);
        ctx.globalAlpha = 1;
      } else if (item.kind === 'pickup') drawPickup(item.ref, time);
      else if (item.kind === 'player') {
        drawPerson(player.x, player.y, player.heading, {
          shirt: PALETTE.playerJacket, hat: '#e8e4da', moving: player.moving, phase: player.walkPhase,
          gun: player.hasPistol && !player.car, punching: player.punchCd > 0.22, flash: 0,
        }, time);
      }
    }

    if (S.marker) drawMarker(S.marker, time);
    S.fx.drawWorld(ctx);
    S.fx.drawFloaters(ctx);

    // Golden-hour grade and vignette, in screen space.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const warm = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    warm.addColorStop(0, 'rgba(255,170,80,0.10)');
    warm.addColorStop(0.55, 'rgba(255,150,60,0.03)');
    warm.addColorStop(1, 'rgba(60,20,40,0.10)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const vig = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.42,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.72,
    );
    vig.addColorStop(0, 'rgba(20,10,5,0)');
    vig.addColorStop(1, 'rgba(20,10,5,0.34)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // HUD and panels in logical coordinates.
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawHud(ctx, S, screen, pointer);
  }

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
    const py = (clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  function worldFromScreen(clientX, clientY, cam) {
    const logical = toLogical(clientX, clientY);
    return {
      x: cam.x + (logical.x - VIEW.width / 2) / cam.zoom,
      y: cam.y + (logical.y - VIEW.height / 2) / cam.zoom,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize, toLogical, worldFromScreen, view };
}
