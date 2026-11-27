// HUD, menus, minimap. Written in this session.
import { CFG } from './config.js';
import { clamp } from './random.js';

export function createHud(G, renderer) {
  const $ = (id) => document.getElementById(id);
  const els = {
    health: $('health'), cash: $('cash'), debt: $('debt'), stars: $('stars'),
    ammo: $('ammo'), speed: $('speed'), objective: $('objective'), msg: $('msg'),
    title: $('title'), pause: $('pause'), fail: $('fail'), complete: $('complete'),
    failReason: $('failReason'), minimap: $('minimap'),
    crosshair: $('crosshair'), prompt: $('prompt'), waypoint: $('waypoint'),
    banner: $('banner'), bannerName: $('bannerName'), bannerSub: $('bannerSub'),
    vignette: $('vignette'),
  };
  let promptText = '';
  const mm = els.minimap.getContext('2d');
  function starText(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }
  function update() {
    const hp = Math.max(0, G.health);
    els.health.style.width = hp + '%';
    els.health.style.background = hp < 30 ? '#e53935' : hp < 60 ? '#fdd835' : '#43a047';
    els.cash.textContent = '$' + G.cash;
    els.debt.textContent = 'Debt $' + Math.max(0, CFG.debtTotal - (G.cash - CFG.startCash));
    els.stars.textContent = starText(G.wanted);
    els.stars.style.color = G.wanted > 0 ? '#ff5252' : '#ffd54f';
    els.stars.classList.toggle('hot', G.wanted > 0);
    els.ammo.textContent = G.reloadT > 0 ? 'Reloading…' : 'Ammo ' + G.ammo + '/' + CFG.pistolAmmo;
    els.speed.textContent = G.playerCar ? Math.round(Math.abs(G.playerCar.speed || 0) * 3.6) + ' km/h' : '';
    const m = G.missions.M;
    let obj = '';
    if (m.completed || m.index >= CFG.missions.length) obj = 'Story complete. Debt cleared.';
    else if (m.active) {
      obj = CFG.missions[m.index].name + ': ' + (G.marker ? G.marker.label : CFG.missions[m.index].goal);
      if (G.marker) obj += '  ' + Math.round(Math.hypot(G.player.x - G.marker.x, G.player.z - G.marker.z)) + 'm';
    } else obj = 'Next job: ' + CFG.missions[m.index].name + ' at ' + CFG.missions[m.index].start;
    if (m.index === 0 && m.active && m.timer > 0) obj += '  ' + Math.ceil(m.timer) + 's';
    els.objective.textContent = obj;
    els.objective.style.borderLeftColor = (m.index === 0 && m.active && m.timer > 0 && m.timer < 20) ? '#ff5252' : '#ffd54f';
    els.msg.textContent = G.message || '';
    const onFoot = G.screen === 'play' && !G.playerCar && !G.shotCam;
    els.crosshair.style.display = onFoot ? 'block' : 'none';
    els.crosshair.classList.toggle('hit', G.hitMark > 0);
    els.vignette.style.opacity = String(Math.min(0.85, G.hurtFlash || 0));
    const card = G.card;
    if (card && card.t > 0) {
      els.banner.style.display = 'block';
      els.banner.style.opacity = String(Math.min(1, card.t));
      els.bannerName.textContent = card.title;
      els.bannerSub.textContent = card.sub;
    } else els.banner.style.display = 'none';
    const prompt = G.prompt || '';
    if (prompt !== promptText) {
      promptText = prompt;
      els.prompt.replaceChildren();
      if (prompt) {
        const key = document.createElement('kbd');
        key.textContent = 'E';
        els.prompt.append(key, document.createTextNode(prompt));
      }
    }
    els.prompt.style.display = prompt ? 'block' : 'none';
  }
  function placeWaypoint() {
    const el = els.waypoint;
    if (!G.marker || G.screen !== 'play' || G.shotCam) { el.style.display = 'none'; return; }
    const p = renderer.project(G.marker.x, 6, G.marker.z);
    const margin = 36;
    const W = window.innerWidth, H = window.innerHeight;
    let x = p.behind ? W - p.x : p.x;
    let y = p.behind ? H * 0.2 : p.y;
    const clamped = p.behind || x < margin || y < margin || x > W - margin || y > H - margin;
    x = clamp(x, margin, W - margin);
    y = clamp(y, margin, H - margin);
    el.style.display = 'block';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.classList.toggle('edge', clamped);
  }
  function drawMinimap() {
    const W = 150, H = 150, s = W / 230;
    mm.clearRect(0, 0, W, H);
    mm.fillStyle = 'rgba(10,20,10,0.85)'; mm.fillRect(0, 0, W, H);
    mm.fillStyle = '#1e5f8a'; mm.fillRect(0, 0, W, 12); // bay
    mm.strokeStyle = '#555'; mm.lineWidth = 4;
    for (const r of CFG.roads) {
      mm.beginPath(); mm.moveTo((r + 115) * s, 0); mm.lineTo((r + 115) * s, H); mm.stroke();
      mm.beginPath(); mm.moveTo(0, (r + 115) * s); mm.lineTo(W, (r + 115) * s); mm.stroke();
    }
    mm.strokeStyle = '#9e2b25'; mm.lineWidth = 2;
    mm.beginPath(); mm.moveTo((0 + 115) * s, 0); mm.lineTo((0 + 115) * s, H); mm.stroke();
    // Monument, roundabout, mosque.
    mm.fillStyle = '#ffd54f';
    mm.beginPath(); mm.arc((CFG.places.monument[0] + 115) * s, (CFG.places.monument[1] + 115) * s, 4, 0, Math.PI * 2); mm.fill();
    mm.strokeStyle = '#ffd54f'; mm.beginPath();
    mm.arc((CFG.places.roundabout[0] + 115) * s, (CFG.places.roundabout[1] + 115) * s, 5, 0, Math.PI * 2); mm.stroke();
    mm.fillStyle = '#7fb3d5';
    mm.beginPath(); mm.arc((CFG.places.mosque[0] + 115) * s, (CFG.places.mosque[1] + 115) * s, 3, 0, Math.PI * 2); mm.fill();
    // Objective blip.
    if (G.marker) {
      mm.fillStyle = '#ffeb3b';
      mm.beginPath(); mm.arc((G.marker.x + 115) * s, (G.marker.z + 115) * s, 5, 0, Math.PI * 2); mm.fill();
    }
    // Police blips.
    mm.fillStyle = '#448aff';
    for (const v of G.vehicles.police) {
      mm.beginPath(); mm.arc((v.x + 115) * s, (v.z + 115) * s, 3, 0, Math.PI * 2); mm.fill();
    }
    // Player arrow.
    const px = (G.player.x + 115) * s, pz = (G.player.z + 115) * s;
    mm.save(); mm.translate(px, pz); mm.rotate(-G.player.angle + Math.PI);
    mm.fillStyle = '#ffffff';
    mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(-5, 6); mm.closePath(); mm.fill();
    mm.restore();
  }
  function show(el, on) { el.style.display = on ? 'flex' : 'none'; }
  function showTitle(on, hasSave) {
    show(els.title, on);
    const c = document.getElementById('continueBtn');
    if (c) c.style.display = hasSave ? 'inline-block' : 'none';
  }
  return { update, drawMinimap, placeWaypoint, show, showTitle, els };
}
