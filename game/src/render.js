// Drawing only: a software 3D renderer on Canvas 2D. Boxes are projected with the camera
// basis, clipped at the near plane, shaded by a low western sun, hazed with distance, and
// painted far to near. Billboards (signs, beacons, glows, text) paint after the polygons.

import { FONT, PALETTE, WORLD } from './config.js';
import { cameraBasis, clamp, hazeColor, projectPoint, projectPoly, rgbString, wrapAngle } from './vec.js';

const NEAR = 0.6;
const SUN = [-0.72, 0.42, 0.3];
const SUN_LEN = Math.hypot(SUN[0], SUN[1], SUN[2]);
const SUN_DIR = [SUN[0] / SUN_LEN, SUN[1] / SUN_LEN, SUN[2] / SUN_LEN];

function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function glowSprite(color) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color.replace('1)', '0.55)'));
  grad.addColorStop(1, color.replace('1)', '0)'));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

const FACES = [
  { corners: [4, 5, 6, 7], normal: [0, 1, 0], top: true },
  { corners: [3, 2, 6, 7], normal: [0, 0, 1] },
  { corners: [1, 0, 4, 5], normal: [0, 0, -1] },
  { corners: [2, 1, 5, 6], normal: [1, 0, 0] },
  { corners: [0, 3, 7, 4], normal: [-1, 0, 0] },
];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const glows = {
    warm: glowSprite('rgba(255,200,120,1)'),
    white: glowSprite('rgba(255,240,210,1)'),
    red: glowSprite('rgba(255,60,50,1)'),
    blue: glowSprite('rgba(70,120,255,1)'),
    orange: glowSprite('rgba(255,150,60,1)'),
    gold: glowSprite('rgba(255,215,130,1)'),
  };
  let skyGrad = null;
  let skyW = 0;
  let skyH = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      skyGrad = null;
    }
  }

  function drawSky(cam, time) {
    const w = cam.w;
    const h = cam.h;
    if (!skyGrad || skyW !== w || skyH !== h) {
      skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, rgbString(PALETTE.skyTop));
      skyGrad.addColorStop(0.45, rgbString(PALETTE.skyMid));
      skyGrad.addColorStop(0.72, rgbString(PALETTE.horizon));
      skyGrad.addColorStop(1, rgbString(PALETTE.haze));
      skyW = w;
      skyH = h;
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);
    // The sun sits low in the west; its screen spot pans with the camera yaw.
    const sunYaw = Math.atan2(SUN_DIR[0], SUN_DIR[2]);
    const rel = wrapAngle(sunYaw - cam.yaw);
    if (Math.abs(rel) < 1.25) {
      const sx = w / 2 + rel * w * 0.62;
      const sy = h * 0.46;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.85;
      ctx.drawImage(glows.gold, sx - h * 0.28, sy - h * 0.28, h * 0.56, h * 0.56);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = rgbString(PALETTE.sun);
      ctx.beginPath();
      ctx.arc(sx, sy, h * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    // Slow clouds, warm lit from below.
    ctx.fillStyle = 'rgba(255,190,150,0.20)';
    for (let i = 0; i < 5; i += 1) {
      const cx = ((i * 0.23 + time * 0.002) % 1.2) * w - w * 0.1;
      const cy = h * (0.10 + i * 0.055);
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.09, h * 0.018, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(G) {
    resize();
    const cam = G.camera;
    cam.w = canvas.width;
    cam.h = canvas.height;
    const shake = G.shake || 0;
    const view = {
      x: cam.x + (Math.random() - 0.5) * shake,
      y: cam.y + (Math.random() - 0.5) * shake * 0.6,
      z: cam.z + (Math.random() - 0.5) * shake,
      yaw: cam.yaw,
      pitch: cam.pitch,
      fov: cam.fov,
      w: cam.w,
      h: cam.h,
    };
    const b = cameraBasis(view);
    const time = G.time;
    drawSky(view, time);

    const polys = [];
    const boards = [];
    const camPos = [view.x, view.y, view.z];

    function shadeFor(normal, dist) {
      const sun = Math.max(0, normal[0] * SUN_DIR[0] + normal[1] * SUN_DIR[1] + normal[2] * SUN_DIR[2]);
      const light = normal[1] > 0.5 ? 1.06 : 0.52 + 0.52 * sun;
      return { light, haze: clamp((dist - 70) / 230, 0, 0.85) };
    }

    function pushPoly(worldPts, fill) {
      const p = projectPoly(b, view, worldPts, NEAR);
      if (p) polys.push({ d: p.depth, pts: p.pts, fill });
      return p;
    }

    function pushBox(cx, cy, cz, w, h, d, rot, color, opts) {
      const o = opts || {};
      const dx = cx - camPos[0];
      const dz = cz - camPos[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > (o.far || 240)) return;
      const hx = w / 2;
      const hz = d / 2;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const local = [
        [-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz],
        [-hx, h, -hz], [hx, h, -hz], [hx, h, hz], [-hx, h, hz],
      ];
      const corners = local.map(([lx, ly, lz]) => [
        cx + lx * cos + lz * sin,
        cy + ly,
        cz - lx * sin + lz * cos,
      ]);
      let bestFace = null;
      let bestDot = 0;
      for (const face of FACES) {
        const n = [
          face.normal[0] * cos + face.normal[2] * sin,
          face.normal[1],
          -face.normal[0] * sin + face.normal[2] * cos,
        ];
        const fc = [0, 0, 0];
        for (const ci of face.corners) {
          fc[0] += corners[ci][0];
          fc[1] += corners[ci][1];
          fc[2] += corners[ci][2];
        }
        fc[0] /= 4; fc[1] /= 4; fc[2] /= 4;
        const facing = n[0] * (camPos[0] - fc[0]) + n[1] * (camPos[1] - fc[1]) + n[2] * (camPos[2] - fc[2]);
        if (facing <= 0) continue;
        const s = shadeFor(n, dist);
        const pts = face.corners.map((ci) => corners[ci]);
        const p = pushPoly(pts, hazeColor(color, PALETTE.haze, s.haze, s.light * (o.bright || 1)));
        if (p && !face.top && facing > bestDot) { bestDot = facing; bestFace = { pts, depth: p.depth, w: face.normal[0] !== 0 ? d : w, h }; }
      }
      if (o.windows && bestFace && dist < 70) drawWindows(bestFace, o.windows, dist);
    }

    function drawWindows(face, win, dist) {
      const [bl, br, tr, tl] = face.pts;
      const cols = clamp(Math.floor(face.w / 2.4), 2, 10);
      const rows = clamp(Math.floor(face.h / 3.1), 2, 14);
      if (cols * rows > 90) return;
      const sw = 0.52 / cols;
      const sh = 0.55 / rows;
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          const u0 = (i + 0.24) / cols;
          const u1 = (i + 0.76) / cols;
          const v0 = (j + 0.22) / rows;
          const v1 = (j + 0.78) / rows;
          const quad = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => {
            const a = [bl[0] + (br[0] - bl[0]) * u, bl[1] + (br[1] - bl[1]) * u, bl[2] + (br[2] - bl[2]) * u];
            const c = [tl[0] + (tr[0] - tl[0]) * u, tl[1] + (tr[1] - tl[1]) * u, tl[2] + (tr[2] - tl[2]) * u];
            return [a[0] + (c[0] - a[0]) * v, a[1] + (c[1] - a[1]) * v, a[2] + (c[2] - a[2]) * v];
          });
          const lit = hash2(win.seed + i * 7, j * 13) < (win.lit ? 0.42 : 0.2);
          const color = lit ? [255, 186, 105] : [44, 52, 70];
          const p = projectPoly(b, view, quad, NEAR);
          if (p) polys.push({ d: face.depth - 0.05, pts: p.pts, fill: hazeColor(color, PALETTE.haze, clamp((dist - 70) / 230, 0, 0.85), lit ? 1 : 0.9) });
        }
      }
    }

    function pushBoard(x, y, z, draw2) {
      const p = projectPoint(b, view, x, y, z, NEAR);
      if (!p) return;
      boards.push({ d: p[2], x: p[0], y: p[1], scale: b.focal / p[2], draw2 });
    }

    // Ground, in fixed order: base, water, roads, markings, walks, plaza.
    const groundOrder = { base: 0, water: 1, road: 2, port: 3, dash: 4, walk: 5, plaza: 6 };
    const ground = G.city.ground;
    for (let k = 0; k < 7; k += 1) {
      for (const g of ground) {
        if (groundOrder[g.kind] !== k) continue;
        if (g.kind !== 'base' && g.kind !== 'water') {
          const mx = (g.pts[0][0] + g.pts[2][0]) / 2;
          const mz = (g.pts[0][1] + g.pts[2][1]) / 2;
          if (Math.hypot(mx - view.x, mz - view.z) > 260) continue;
        }
        const pts = g.pts.map(([x, z]) => [x, g.y, z]);
        const p = projectPoly(b, view, pts, NEAR);
        if (p) {
          ctx.fillStyle = g.kind === 'water' ? rgbString(PALETTE.water) : hazeColor(g.color, PALETTE.haze, clamp((p.depth - 80) / 260, 0, 0.7), 1);
          ctx.beginPath();
          ctx.moveTo(p.pts[0][0], p.pts[0][1]);
          for (let i = 1; i < p.pts.length; i += 1) ctx.lineTo(p.pts[i][0], p.pts[i][1]);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    // Water shimmer: warm streaks drifting on the harbour.
    ctx.fillStyle = 'rgba(255,190,120,0.35)';
    for (let i = 0; i < 10; i += 1) {
      const zx = WORLD.waterX + 6 + ((i * 37 + time * 4) % 55);
      const zz = -200 + i * 44 + Math.sin(time * 0.4 + i) * 6;
      const p = projectPoly(b, view, [[zx, 0.05, zz], [zx + 9, 0.05, zz], [zx + 9, 0.05, zz + 1.2], [zx, 0.05, zz + 1.2]], NEAR);
      if (p) {
        ctx.beginPath();
        ctx.moveTo(p.pts[0][0], p.pts[0][1]);
        for (let j = 1; j < p.pts.length; j += 1) ctx.lineTo(p.pts[j][0], p.pts[j][1]);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Far skyline silhouettes.
    for (const s of G.city.skyline) {
      pushBox(s.x, 0, s.z, s.w, s.h, s.d, 0, [92, 74, 96], { far: 600, bright: 0.9 });
    }
    // Buildings.
    for (const bd of G.city.buildings) {
      pushBox(bd.x, 0.1, bd.z, bd.w, bd.h, bd.d, 0, bd.color, {
        windows: bd.kind === 'house' ? null : { seed: bd.winSeed, lit: bd.lit },
      });
      if (bd.kind !== 'house') pushBox(bd.x, 0.1 + bd.h, bd.z, bd.w * 0.3, 1.6, bd.d * 0.3, 0, [90, 84, 78], { far: 160 });
    }
    // Props.
    for (const pr of G.city.props) drawProp(pr, pushBox, pushBoard, time);
    // Signs.
    for (const s of G.city.signs) {
      pushBoard(s.x, s.y, s.z, (sx, sy, scale) => {
        const w = s.w * scale;
        const h = s.h * scale;
        if (w < 10) return;
        ctx.fillStyle = rgbString(s.bg, 0.92);
        ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
        ctx.strokeStyle = 'rgba(255,220,150,0.5)';
        ctx.lineWidth = Math.max(1, h * 0.04);
        ctx.strokeRect(sx - w / 2, sy - h / 2, w, h);
        ctx.fillStyle = rgbString(s.fg);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${Math.max(6, h * 0.4)}px ${FONT}`;
        ctx.fillText(s.text, sx, sy - h * 0.14);
        ctx.font = `${Math.max(5, h * 0.22)}px ${FONT}`;
        ctx.fillStyle = 'rgba(255,235,200,0.85)';
        ctx.fillText(s.sub, sx, sy + h * 0.26);
      });
    }
    // Vehicles, people, items, particles.
    for (const v of G.vehicles) drawVehicle(v, pushBox, pushBoard, time);
    for (const p of G.peds) drawPerson(p, pushBox, false);
    for (const e of G.enemies) drawPerson(e, pushBox, true);
    if (!G.player.driving) drawPerson(G.player, pushBox, false);
    for (const item of G.items) {
      if (item.taken) continue;
      pushBoard(item.x, 1.2, item.z, (sx, sy, scale) => {
        const s = clamp(scale * 1.4, 4, 90);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.7 + Math.sin(time * 4) * 0.2;
        ctx.drawImage(glows.gold, sx - s, sy - s, s * 2, s * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      });
      pushBox(item.x, 0.15, item.z, 1.1, 0.7, 0.8, time * 0.8, [210, 160, 60], { bright: 1.1 });
    }
    for (const pt of G.particles) {
      pushBoard(pt.x, pt.y, pt.z, (sx, sy, scale) => {
        const s = clamp(pt.size * scale, 1.5, 26);
        ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
        ctx.fillStyle = rgbString(pt.color);
        ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
        ctx.globalAlpha = 1;
      });
    }
    for (const f of G.floaters) {
      pushBoard(f.x, f.y, f.z, (sx, sy) => {
        ctx.globalAlpha = clamp(f.life / f.maxLife, 0, 1);
        ctx.font = `700 ${Math.round(cam.h * 0.032)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, sx, sy);
        ctx.globalAlpha = 1;
      });
    }
    drawBeacons(G, pushBoard, view, b, time);

    polys.sort((a, c2) => c2.d - a.d);
    for (const p of polys) {
      ctx.fillStyle = p.fill;
      ctx.beginPath();
      ctx.moveTo(p.pts[0][0], p.pts[0][1]);
      for (let i = 1; i < p.pts.length; i += 1) ctx.lineTo(p.pts[i][0], p.pts[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    boards.sort((a, c2) => c2.d - a.d);
    for (const bd of boards) bd.draw2(bd.x, bd.y, bd.scale);

    // Muzzle flashes and police light wash.
    for (const f of G.flashes) {
      const p = projectPoint(b, view, f.x, f.y, f.z, NEAR);
      if (!p) continue;
      const s = clamp((b.focal / p[2]) * 1.2, 6, 120);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(f.life / 0.07, 0, 1);
      ctx.drawImage(glows.white, p[0] - s, p[1] - s, s * 2, s * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Warm grade, vignette, damage flash.
    const grade = ctx.createLinearGradient(0, 0, 0, cam.h);
    grade.addColorStop(0, 'rgba(255,110,50,0.05)');
    grade.addColorStop(0.6, 'rgba(255,110,50,0.0)');
    grade.addColorStop(1, 'rgba(24,10,44,0.16)');
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, cam.w, cam.h);
    const vig = ctx.createRadialGradient(cam.w / 2, cam.h / 2, cam.h * 0.42, cam.w / 2, cam.h / 2, cam.h * 0.95);
    vig.addColorStop(0, 'rgba(8,4,18,0)');
    vig.addColorStop(1, 'rgba(8,4,18,0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, cam.w, cam.h);
    if (G.damageFlash > 0.01) {
      const dmg = ctx.createRadialGradient(cam.w / 2, cam.h / 2, cam.h * 0.3, cam.w / 2, cam.h / 2, cam.h * 0.8);
      dmg.addColorStop(0, 'rgba(200,20,20,0)');
      dmg.addColorStop(1, `rgba(200,20,20,${clamp(G.damageFlash, 0, 0.55)})`);
      ctx.fillStyle = dmg;
      ctx.fillRect(0, 0, cam.w, cam.h);
    }
  }

  function drawProp(pr, pushBox, pushBoard, time) {
    if (pr.kind === 'lamp') {
      pushBox(pr.x, 0, pr.z, 0.22, 5.6, 0.22, 0, [52, 50, 56]);
      pushBox(pr.x, 5.6, pr.z, 0.7, 0.25, 0.3, 0, [240, 210, 140], { bright: 1.2 });
      pushBoard(pr.x, 5.7, pr.z, (sx, sy, scale) => {
        const s = clamp(scale * 1.1, 3, 60);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        ctx.drawImage(glows.warm, sx - s, sy - s, s * 2, s * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      });
    } else if (pr.kind === 'tree') {
      const s = pr.s || 1;
      pushBox(pr.x, 0, pr.z, 0.5 * s, 2.6 * s, 0.5 * s, 0, [96, 70, 48]);
      pushBox(pr.x, 2.2 * s, pr.z, 3.4 * s, 2.6 * s, 3.4 * s, pr.rot, [74, 112, 58]);
      pushBox(pr.x, 4.2 * s, pr.z, 2.2 * s, 1.8 * s, 2.2 * s, pr.rot + 0.7, [86, 126, 64]);
    } else if (pr.kind === 'stall') {
      pushBox(pr.x, 0, pr.z, 4.4, 1.1, 3, pr.rot, [120, 84, 56]);
      pushBox(pr.x, 1.1, pr.z, 4.4, 1.5, 3, pr.rot, [150, 110, 74]);
      pushBox(pr.x, 2.9, pr.z, 5, 0.25, 3.6, pr.rot, [196, 52, 44], { bright: 1.05 });
      pushBox(pr.x, 2.9, pr.z, 2.5, 0.26, 3.6, pr.rot, [238, 232, 220]);
    } else if (pr.kind === 'billboard') {
      pushBox(pr.x, 0, pr.z, 0.8, 7, 0.8, 0, [60, 58, 66]);
      pushBox(pr.x, 6.4, pr.z, 16.6, 5.6, 0.5, 0, [28, 26, 38]);
    } else if (pr.kind === 'container') {
      pushBox(pr.x, pr.y || 0, pr.z, 6, 2.6, 2.6, pr.rot, pr.color);
    } else if (pr.kind === 'crane') {
      pushBox(pr.x, 0, pr.z, 1.6, 26, 1.6, 0, [200, 130, 40]);
      pushBox(pr.x - 6, 25, pr.z, 20, 1.1, 1.1, 0, [200, 130, 40]);
      pushBox(pr.x + 4, 25, pr.z, 3, 2.2, 2, 0, [170, 110, 36]);
      pushBox(pr.x - 13, 12, pr.z, 0.12, 13, 0.12, 0, [40, 40, 44]);
      pushBox(pr.x - 13, 9.4, pr.z, 6, 2.6, 2.6, 0, [60, 120, 170]);
    } else if (pr.kind === 'planter') {
      pushBox(pr.x, 0, pr.z, 3, 1, 3, 0, [130, 116, 96]);
      pushBox(pr.x, 1, pr.z, 2.4, 1, 2.4, 0.4, [80, 118, 62]);
    } else if (pr.kind === 'flagpole') {
      pushBox(pr.x, 0, pr.z, 0.18, 11, 0.18, 0, [200, 200, 205]);
      const wave = Math.sin(time * 3 + pr.x) * 0.35;
      pushBox(pr.x + 1.1, 9.6, pr.z + wave * 0.3, 2.2, 0.7, 0.08, 0, [215, 40, 40], { bright: 1.1 });
      pushBox(pr.x + 1.1, 8.9, pr.z + wave * 0.3, 2.2, 0.7, 0.08, 0, [240, 240, 240], { bright: 1.05 });
    } else if (pr.kind === 'monument') {
      pushBox(pr.x, 0, pr.z, 16, 1.2, 16, 0, [168, 148, 122]);
      pushBox(pr.x, 1.2, pr.z, 12, 1.2, 12, 0, [182, 162, 136]);
      pushBox(pr.x, 2.4, pr.z, 8, 2.5, 8, 0, [196, 176, 148]);
      pushBox(pr.x, 4.9, pr.z, 5.2, 14, 5.2, 0, [214, 194, 164]);
      pushBox(pr.x, 18.9, pr.z, 4.2, 14, 4.2, 0, [222, 202, 172]);
      pushBox(pr.x, 32.9, pr.z, 3.2, 8, 3.2, 0, [228, 210, 180]);
      pushBox(pr.x, 40.9, pr.z, 4.6, 1.6, 4.6, 0, [200, 170, 90], { bright: 1.2 });
      pushBoard(pr.x, 44.5, pr.z, (sx, sy, scale) => {
        const s = clamp(scale * 2.2, 6, 110);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.85;
        ctx.drawImage(glows.orange, sx - s, sy - s, s * 2, s * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      });
    } else if (pr.kind === 'quay') {
      pushBox(pr.x, 0, pr.z, 2, 1.4, 480, 0, [120, 114, 106]);
    }
  }

  function drawVehicle(v, pushBox, pushBoard, time) {
    const dims = {
      sedan: [2, 0.85, 4.4], taxi: [2, 0.85, 4.4], police: [2, 0.85, 4.4], race: [2, 0.75, 4.3],
      van: [2.1, 1.5, 4.8], truck: [2.4, 1.6, 6.5], bike: [0.7, 0.6, 2.3],
    }[v.kind] || [2, 0.85, 4.4];
    const [w, h, d] = dims;
    if (v.kind === 'bike') {
      pushBox(v.x, 0.35, v.z, w, h, d, v.heading, v.color);
      pushBox(v.x, 0.95, v.z, 0.55, 0.5, 0.9, v.heading, [30, 120, 70]);
      pushBox(v.x - Math.sin(v.heading) * 0.3, 1.45, v.z - Math.cos(v.heading) * 0.3, 0.42, 0.42, 0.42, v.heading, [240, 240, 240]);
      return;
    }
    const bodyY = 0.35;
    pushBox(v.x, bodyY, v.z, w, h, d, v.heading, v.color);
    const cabZ = v.kind === 'truck' ? d * 0.28 : -d * 0.06;
    const cabX = v.x - Math.sin(v.heading) * cabZ * -1;
    const cabZz = v.z - Math.cos(v.heading) * cabZ * -1;
    pushBox(cabX, bodyY + h, cabZz, w * 0.82, v.kind === 'van' ? 0.7 : 0.68, d * (v.kind === 'truck' ? 0.3 : 0.48), v.heading, v.kind === 'police' ? [30, 30, 36] : [36, 44, 58]);
    if (v.kind === 'truck') {
      pushBox(v.x + Math.sin(v.heading) * d * 0.22, bodyY + 0.4, v.z + Math.cos(v.heading) * d * 0.22, w * 1.02, 2.1, d * 0.52, v.heading, [170, 164, 150]);
    }
    if (v.kind === 'taxi') pushBox(v.x, bodyY + h + 0.7, v.z, 0.9, 0.3, 0.5, v.heading, [250, 210, 80], { bright: 1.2 });
    if (v.kind === 'race') {
      pushBox(v.x + Math.sin(v.heading) * d * 0.42, bodyY + h + 0.1, v.z + Math.cos(v.heading) * d * 0.42, w * 0.9, 0.18, 0.5, v.heading, [20, 20, 24]);
    }
    const wheelY = 0.28;
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const wx = v.x + Math.cos(v.heading) * ox * (w / 2 - 0.1) + Math.sin(v.heading) * oz * (d / 2 - 0.7);
      const wz = v.z - Math.sin(v.heading) * ox * (w / 2 - 0.1) + Math.cos(v.heading) * oz * (d / 2 - 0.7);
      pushBox(wx, wheelY, wz, 0.32, 0.56, 0.72, v.heading, [22, 22, 26]);
    }
    if (v.kind === 'police') {
      pushBox(v.x, bodyY + h + 0.68, v.z, 1.1, 0.28, 0.5, v.heading, [200, 200, 205]);
      const flash = Math.floor(time * 6) % 2 === 0;
      pushBoard(v.x, bodyY + h + 1.1, v.z, (sx, sy, scale) => {
        const s = clamp(scale * 1.6, 5, 80);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8;
        ctx.drawImage(flash ? glows.red : glows.blue, sx - s, sy - s, s * 2, s * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      });
    }
    // Headlight and tail-light glow: the front is the +z end, where the car heads.
    const fx = v.x + Math.sin(v.heading) * (d / 2);
    const fz = v.z + Math.cos(v.heading) * (d / 2);
    const bx = v.x - Math.sin(v.heading) * (d / 2);
    const bz = v.z - Math.cos(v.heading) * (d / 2);
    pushBoard(fx, 0.8, fz, (sx, sy, scale) => {
      const s = clamp(scale * 0.8, 3, 46);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      ctx.drawImage(glows.white, sx - s, sy - s, s * 2, s * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    });
    pushBoard(bx, 0.8, bz, (sx, sy, scale) => {
      const s = clamp(scale * (v.braking ? 1.1 : 0.6), 3, 46);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = v.braking ? 0.9 : 0.5;
      ctx.drawImage(glows.red, sx - s, sy - s, s * 2, s * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    });
  }

  function drawPerson(p, pushBox, isEnemy) {
    if (p.dead && p.deadT > 4) return;
    const dx = p.x - (G_camX || 0);
    void dx;
    const heading = p.heading || 0;
    const dist = Math.hypot(p.x - lastCam.x, p.z - lastCam.z);
    if (dist > 130) return;
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    const side = (ox, oz) => [p.x + cos * ox + sin * oz, p.z - sin * ox + cos * oz];
    if (p.dead) {
      const [bx, bz] = side(0, 0);
      pushBox(bx, 0.15, bz, 0.65, 0.45, 1.7, heading, p.shirt || [120, 40, 40]);
      return;
    }
    const swing = Math.sin(p.phase || 0) * (p.moving ? 0.32 : 0.05);
    const bob = Math.abs(Math.cos(p.phase || 0)) * (p.moving ? 0.06 : 0);
    const detail = dist < 70;
    if (detail) {
      const [lx, lz] = side(-0.18, swing);
      const [rx, rz] = side(0.18, -swing);
      pushBox(lx, 0.05, lz, 0.3, 0.72, 0.3, heading, p.pants || [50, 52, 60]);
      pushBox(rx, 0.05, rz, 0.3, 0.72, 0.3, heading, p.pants || [50, 52, 60]);
      const reach = p.punchT > 0 ? 0.55 : 0;
      const [ax, az] = side(-0.42, -swing * 0.7 - reach);
      const [ax2, az2] = side(0.42, swing * 0.7);
      pushBox(ax, 0.85 + bob, az, 0.22, 0.6, 0.22, heading, p.shirt || [90, 90, 100]);
      pushBox(ax2, 0.85 + bob, az2, 0.22, 0.6, 0.22, heading, p.shirt || [90, 90, 100]);
    }
    const [bx, bz] = side(0, 0);
    pushBox(bx, 0.78 + bob, bz, 0.64, 0.82, 0.42, heading, p.shirt || [90, 90, 100]);
    pushBox(bx, 1.6 + bob, bz, 0.44, 0.44, 0.44, heading, p.skin || [196, 150, 110]);
    pushBox(bx, 2.02 + bob, bz, 0.46, 0.14, 0.46, heading, p.hair || [40, 32, 26]);
    if (p.helmet) pushBox(bx, 1.98 + bob, bz, 0.52, 0.3, 0.52, heading, [240, 240, 240]);
    if (isEnemy && p.hp < p.maxHp) {
      pushBoardFallback(p, bx, bz, bob);
    }
  }

  function pushBoardFallback(p, bx, bz, bob) {
    // Enemy health pips paint in the boards pass via the shared queue below.
    pendingBars.push({ x: bx, y: 2.5 + bob, z: bz, frac: clamp(p.hp / p.maxHp, 0, 1) });
  }

  let lastCam = { x: 0, z: 0 };
  let pendingBars = [];
  let G_camX = 0;

  function drawBeacons(G, pushBoard, view, b, time) {
    const marker = G.marker;
    if (marker) {
      const pulse = 0.65 + Math.sin(time * 4) * 0.25;
      pushBoard(marker.x, 0.4, marker.z, (sx, sy, scale) => {
        const s = clamp(scale * 3.2, 8, 120);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 * pulse;
        ctx.drawImage(glows.gold, sx - s, sy - s, s * 2, s * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      });
      pushBoard(marker.x, 14, marker.z, (sx, sy) => {
        const top = projectPoint(b, view, marker.x, 26, marker.z, NEAR);
        const bot = projectPoint(b, view, marker.x, 0.3, marker.z, NEAR);
        if (!top || !bot) return;
        const w = clamp(2.6 / (top[2] / b.focal + 0.001), 4, 60);
        const grad = ctx.createLinearGradient(0, top[1], 0, bot[1]);
        grad.addColorStop(0, `rgba(255,200,90,${0.05 * pulse})`);
        grad.addColorStop(1, `rgba(255,200,90,${0.5 * pulse})`);
        ctx.fillStyle = grad;
        ctx.fillRect(top[0] - w / 2, top[1], w, bot[1] - top[1]);
        ctx.save();
        ctx.translate(sx, sy - 30);
        ctx.rotate(Math.PI / 4 + time * 1.5);
        ctx.fillStyle = '#ffd257';
        const ds = clamp(900 / top[2], 6, 26);
        ctx.fillRect(-ds / 2, -ds / 2, ds, ds);
        ctx.restore();
      });
    }
    for (const gate of G.raceGates || []) {
      if (gate.passed) continue;
      pushBoard(gate.x, 1, gate.z, (sx, sy, scale) => {
        const s = clamp(scale * 2.4, 6, 90);
        ctx.strokeStyle = 'rgba(255,220,120,0.9)';
        ctx.lineWidth = Math.max(2, s * 0.08);
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  }

  const api = {
    draw(G) {
      lastCam = { x: G.camera.x, z: G.camera.z };
      G_camX = G.camera.x;
      pendingBars = [];
      draw(G);
      // Enemy health bars paint last, in screen space.
      if (pendingBars.length) {
        const cam = G.camera;
        const b = cameraBasis({ x: cam.x, y: cam.y, z: cam.z, yaw: cam.yaw, pitch: cam.pitch, fov: cam.fov, w: cam.w, h: cam.h });
        for (const bar of pendingBars) {
          const p = projectPoint(b, cam, bar.x, bar.y, bar.z, NEAR);
          if (!p) continue;
          const w = clamp(2600 / p[2], 14, 60);
          ctx.fillStyle = 'rgba(20,16,24,0.8)';
          ctx.fillRect(p[0] - w / 2, p[1], w, 5);
          ctx.fillStyle = bar.frac > 0.4 ? '#e8b64c' : '#d94a3a';
          ctx.fillRect(p[0] - w / 2, p[1], w * bar.frac, 5);
        }
      }
    },
    resize,
  };
  resize();
  return api;
}
