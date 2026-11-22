// HUD, menus, minimap. Written in this session.
import { CFG } from './config.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const els = {
    health: $('health'), cash: $('cash'), debt: $('debt'), stars: $('stars'),
    ammo: $('ammo'), speed: $('speed'), objective: $('objective'), msg: $('msg'),
    title: $('title'), pause: $('pause'), fail: $('fail'), complete: $('complete'),
    failReason: $('failReason'), minimap: $('minimap'),
  };
  const mm = els.minimap.getContext('2d');
  function starText(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }
  function update() {
    els.health.style.width = Math.max(0, G.health) + '%';
    els.cash.textContent = '$' + G.cash;
    els.debt.textContent = 'Debt $' + Math.max(0, CFG.debtTotal - (G.cash - CFG.startCash));
    els.stars.textContent = starText(G.wanted);
    els.stars.style.color = G.wanted > 0 ? '#ff5252' : '#ffd54f';
    els.ammo.textContent = 'Ammo ' + G.ammo + '/' + CFG.pistolAmmo;
    els.speed.textContent = G.playerCar ? Math.round(Math.abs(G.playerCar.speed || 0) * 3.6) + ' km/h' : '';
    const m = G.missions.M;
    let obj = '';
    if (m.completed || m.index >= CFG.missions.length) obj = 'Story complete. Debt cleared.';
    else if (m.active) obj = CFG.missions[m.index].name + ': ' + (G.marker ? G.marker.label : CFG.missions[m.index].goal);
    else obj = 'Next job: ' + CFG.missions[m.index].name + ' at ' + CFG.missions[m.index].start + ' (press E)';
    if (m.index === 0 && m.timer > 0 && m.active) obj += '  ' + Math.ceil(m.timer) + 's';
    els.objective.textContent = obj;
    els.msg.textContent = G.message || '';
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
  return { update, drawMinimap, show, showTitle, els };
}
