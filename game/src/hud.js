// The HUD: cash, wanted stars, health, the mission objective, prompts, messages, the
// banner, and the minimap. DOM text updates only when values change; the minimap paints
// every frame on its own small canvas.

import { CASH } from './config.js';
import { dist2 } from './vec.js';

export function say(G, text, color) {
  G.messages.push({ text, color: color || '#ffffff', t: 4.5 });
  if (G.messages.length > 4) G.messages.shift();
}

export function showBanner(G, title, sub) {
  G.banner = { title, sub, t: 3.4 };
}

export function createHud() {
  const el = (id) => document.getElementById(id);
  const cashEl = el('cash');
  const starsEl = el('stars');
  const healthEl = el('health-fill');
  const objTitle = el('obj-title');
  const objText = el('obj-text');
  const objDist = el('obj-dist');
  const speedEl = el('speed');
  const promptEl = el('prompt');
  const messagesEl = el('messages');
  const bannerEl = el('banner');
  const bannerTitle = el('banner-title');
  const bannerSub = el('banner-sub');
  const hintEl = el('hint');
  const mapCanvas = el('minimap');
  const mapCtx = mapCanvas.getContext('2d');
  let lastCash = -1;
  let lastStars = -1;
  let lastHealth = -1;
  let lastObj = '';
  let lastSpeed = -1;
  let lastPrompt = '';
  let lastHint = true;
  let msgKey = '';

  function drawMinimap(G) {
    const S = mapCanvas.width;
    const range = 130;
    const scale = S / (range * 2);
    const px = G.player.x;
    const pz = G.player.z;
    const toMap = (x, z) => [S / 2 + (x - px) * scale, S / 2 + (z - pz) * scale];
    mapCtx.fillStyle = '#241d2e';
    mapCtx.fillRect(0, 0, S, S);
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    mapCtx.clip();
    mapCtx.fillStyle = '#3a3144';
    mapCtx.fillRect(0, 0, S, S);
    // Water on the east edge.
    const [wx] = toMap(232, 0);
    if (wx < S) {
      mapCtx.fillStyle = '#3d547e';
      mapCtx.fillRect(wx, 0, S - wx, S);
    }
    mapCtx.strokeStyle = '#6f6680';
    mapCtx.lineWidth = 5;
    for (const c of G.city.roads) {
      const [ax] = toMap(c, 0);
      const [, az] = toMap(0, c);
      mapCtx.beginPath();
      mapCtx.moveTo(ax, 0);
      mapCtx.lineTo(ax, S);
      mapCtx.moveTo(0, az);
      mapCtx.lineTo(S, az);
      mapCtx.stroke();
    }
    mapCtx.strokeStyle = '#8d84a0';
    mapCtx.lineWidth = 8;
    const [aveX] = toMap(0, 0);
    mapCtx.beginPath();
    mapCtx.moveTo(aveX, 0);
    mapCtx.lineTo(aveX, S);
    mapCtx.stroke();
    // Plaza.
    const [plx, plz] = toMap(0, -150);
    mapCtx.fillStyle = '#8d84a0';
    mapCtx.fillRect(plx - 42 * scale, plz - 22 * scale, 84 * scale, 44 * scale);
    // Police blips.
    for (const v of G.vehicles) {
      if (v.kind !== 'police') continue;
      const [mx, mz] = toMap(v.x, v.z);
      if (mx < 0 || mx > S || mz < 0 || mz > S) continue;
      mapCtx.fillStyle = Math.floor(G.time * 3) % 2 ? '#ff5a4a' : '#5a8aff';
      mapCtx.beginPath();
      mapCtx.arc(mx, mz, 4, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Mission marker.
    if (G.marker) {
      const [mx, mz] = toMap(G.marker.x, G.marker.z);
      const pulse = 5 + Math.sin(G.time * 4) * 1.5;
      mapCtx.fillStyle = '#ffd257';
      mapCtx.beginPath();
      mapCtx.arc(Math.max(6, Math.min(S - 6, mx)), Math.max(6, Math.min(S - 6, mz)), pulse, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Player arrow.
    mapCtx.save();
    mapCtx.translate(S / 2, S / 2);
    mapCtx.rotate(-G.player.heading + Math.PI);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -8);
    mapCtx.lineTo(5.5, 6);
    mapCtx.lineTo(-5.5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
    mapCtx.restore();
    mapCtx.fillStyle = 'rgba(255,255,255,0.85)';
    mapCtx.font = '700 11px system-ui, sans-serif';
    mapCtx.textAlign = 'center';
    mapCtx.fillText('N', S / 2, 14);
  }

  function update(G, dt) {
    const cash = G.cash;
    if (cash !== lastCash) {
      lastCash = cash;
      cashEl.textContent = `$${cash.toLocaleString('en-US')}`;
    }
    const stars = G.wanted.level;
    if (stars !== lastStars) {
      lastStars = stars;
      starsEl.textContent = '★★★★★'.slice(0, stars) + '☆☆☆☆☆'.slice(0, 5 - stars);
      starsEl.className = stars > 0 ? 'stars hot' : 'stars';
    }
    starsEl.style.opacity = G.wanted.evadeT > 2 ? (Math.floor(G.time * 4) % 2 ? 0.35 : 1) : 1;
    const health = Math.round((G.player.health / G.player.maxHealth) * 100);
    if (health !== lastHealth) {
      lastHealth = health;
      healthEl.style.width = `${health}%`;
      healthEl.className = health > 50 ? 'fill' : health > 25 ? 'fill low' : 'fill crit';
    }
    const obj = G.objective || { title: '', text: '', dist: 0 };
    const objKey = `${obj.title}|${obj.text}|${obj.dist}`;
    if (objKey !== lastObj) {
      lastObj = objKey;
      objTitle.parentElement.style.display = obj.text ? '' : 'none';
      objTitle.textContent = obj.title;
      objText.textContent = obj.text;
      objDist.textContent = obj.dist > 0 ? `${obj.dist}m` : '';
    }
    const speed = G.player.driving ? Math.round(Math.abs(G.player.driving.speed) * 3.6) : 0;
    if (speed !== lastSpeed) {
      lastSpeed = speed;
      speedEl.textContent = speed > 0 ? `${speed} km/h` : '';
    }
    let prompt = '';
    const p = G.player;
    if (!p.driving) {
      let near = null;
      let bd = 5;
      for (const v of G.vehicles) {
        if (v.kind === 'police') continue;
        const d = dist2(p.x, p.z, v.x, v.z);
        if (d < bd) { bd = d; near = v; }
      }
      if (near) prompt = near.driver === 'mission' ? 'Press E to take the marked car' : 'Press E to enter the car';
    } else {
      prompt = 'E exit · Space handbrake';
    }
    if (prompt !== lastPrompt) {
      lastPrompt = prompt;
      promptEl.textContent = prompt;
      promptEl.style.opacity = prompt ? 1 : 0;
    }
    for (const m of G.messages) m.t -= dt;
    while (G.messages.length && G.messages[0].t <= 0) G.messages.shift();
    const key = G.messages.map((m) => m.text).join('|');
    if (key !== msgKey) {
      msgKey = key;
      messagesEl.innerHTML = '';
      for (const m of G.messages) {
        const div = document.createElement('div');
        div.className = 'msg';
        div.style.color = m.color;
        div.textContent = m.text;
        messagesEl.appendChild(div);
      }
    }
    if (G.banner) {
      G.banner.t -= dt;
      if (G.banner.t <= 0) {
        G.banner = null;
        bannerEl.className = 'hidden';
      } else if (bannerEl.className !== 'show') {
        bannerTitle.textContent = G.banner.title;
        bannerSub.textContent = G.banner.sub;
        bannerEl.className = 'show';
      }
    }
    const showHint = G.time < 14 && !G.shotMode;
    if (showHint !== lastHint) {
      lastHint = showHint;
      hintEl.style.opacity = showHint ? 1 : 0;
    }
    drawMinimap(G);
    void CASH;
  }

  return { update };
}
