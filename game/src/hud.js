// The HUD: DOM chips for health, cash, wanted stars, ammo and speed, a
// canvas minimap, the mission tracker, toasts, prompts and banners, and the
// title, pause and busted/wasted overlays. All elements live in index.html;
// this module only binds them and paints the numbers each frame.
import { BLOCK, BLOCKS, CORRIDOR_X, HALF, PITCH, ROAD, ROAD_CENTRES, ROUNDABOUT } from './config.js';

const MAP_MIN_X = -150;
const MAP_MIN_Z = -150;
const MAP_SPAN = 322;
const MAP_SIZE = 190;

export class HUD {
  constructor(doc) {
    this.doc = doc;
    const get = (id) => doc.getElementById(id);
    this.healthFill = get('health-fill');
    this.healthText = get('health-text');
    this.cashEl = get('cash');
    this.debtEl = get('debt');
    this.starsEl = get('stars');
    this.ammoEl = get('ammo');
    this.speedBox = get('speed-box');
    this.speedEl = get('speed');
    this.trackerTitle = get('tracker-title');
    this.trackerObjective = get('tracker-objective');
    this.trackerTimer = get('tracker-timer');
    this.minimap = get('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.crosshair = get('crosshair');
    this.toastEl = get('toast');
    this.promptEl = get('prompt');
    this.bannerEl = get('banner');
    this.bannerTitle = get('banner-title');
    this.bannerSub = get('banner-sub');
    this.vignette = get('vignette');
    this.hudRoot = get('hud');
    this.titleScreen = get('title-screen');
    this.pauseScreen = get('pause-screen');
    this.endScreen = get('end-screen');
    this.endTitle = get('end-title');
    this.endSub = get('end-sub');
    this.muteEl = get('mute-state');
    this.toastTimer = 0;
    this.bannerTimer = 0;
    this.vignetteAlpha = 0;
    this.time = 0;
    this.lastCash = -1;
    this.lastStars = -1;
  }

  bindButtons(handlers) {
    const get = (id) => this.doc.getElementById(id);
    const wire = (id, fn) => {
      const el = get(id);
      if (el) el.addEventListener('click', (event) => { event.preventDefault(); fn(); });
    };
    wire('btn-start', handlers.start);
    wire('btn-continue', handlers.continue);
    wire('btn-resume', handlers.resume);
    wire('btn-save', handlers.save);
    wire('btn-restart', handlers.restart);
    wire('btn-end-ok', handlers.endOk);
    wire('btn-mute', handlers.mute);
  }

  setContinueAvailable(available, label) {
    const btn = this.doc.getElementById('btn-continue');
    if (btn) {
      btn.style.display = available ? '' : 'none';
      if (label) btn.textContent = label;
    }
  }

  showScreen(name) {
    this.titleScreen.classList.toggle('visible', name === 'title');
    this.pauseScreen.classList.toggle('visible', name === 'pause');
    this.endScreen.classList.toggle('visible', name === 'end');
    this.hudRoot.classList.toggle('visible', name === 'play');
  }

  showEnd(title, sub) {
    this.endTitle.textContent = title;
    this.endSub.textContent = sub;
    this.showScreen('end');
  }

  message(text, seconds) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('visible');
    this.toastTimer = seconds || 4;
  }

  prompt(text) {
    if (text) {
      this.promptEl.textContent = text;
      this.promptEl.classList.add('visible');
    } else {
      this.promptEl.classList.remove('visible');
    }
  }

  banner(title, sub) {
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub || '';
    this.bannerEl.classList.add('visible');
    this.bannerTimer = 3.6;
  }

  damageFlash() {
    this.vignetteAlpha = Math.min(0.85, this.vignetteAlpha + 0.45);
  }

  setMuted(muted) {
    this.muteEl.textContent = muted ? 'Muted (M)' : 'Sound on (M)';
  }

  update(dt, state) {
    this.time += dt;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('visible');
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.classList.remove('visible');
    }
    if (this.vignetteAlpha > 0) {
      this.vignetteAlpha = Math.max(0, this.vignetteAlpha - dt * 1.4);
      this.vignette.style.opacity = this.vignetteAlpha.toFixed(2);
    }
    const health = Math.max(0, Math.round(state.health));
    this.healthFill.style.width = `${health}%`;
    this.healthFill.style.background = health > 50 ? '#6fbf5a' : health > 25 ? '#e0a83f' : '#d43a2e';
    this.healthText.textContent = `${health}`;
    if (state.cash !== this.lastCash) {
      this.lastCash = state.cash;
      this.cashEl.textContent = `$${state.cash.toLocaleString('en-US')}`;
    }
    this.debtEl.textContent = state.debt > 0 ? `Debt $${state.debt.toLocaleString('en-US')}` : 'Debt cleared';
    this.debtEl.classList.toggle('cleared', state.debt <= 0);
    if (state.stars !== this.lastStars) {
      this.lastStars = state.stars;
      this.starsEl.textContent = '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars);
      this.starsEl.classList.toggle('hot', state.stars > 0);
    }
    this.ammoEl.textContent = state.reloading ? 'Reloading…' : `Ammo ${state.ammo} / 12`;
    this.speedBox.style.display = state.inCar ? '' : 'none';
    if (state.inCar) this.speedEl.textContent = `${Math.round(Math.abs(state.speed) * 3.6)}`;
    this.crosshair.style.display = !state.inCar && state.playing ? '' : 'none';
    this.trackerTitle.textContent = state.tracker.title;
    this.trackerObjective.textContent = state.tracker.objective;
    if (state.tracker.timer !== null && state.tracker.timer !== undefined) {
      const t = Math.max(0, state.tracker.timer);
      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60);
      this.trackerTimer.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
      this.trackerTimer.style.display = '';
      this.trackerTimer.classList.toggle('urgent', t < 20);
    } else {
      this.trackerTimer.style.display = 'none';
    }
    this.drawMinimap(state);
  }

  toMap(x, z) {
    const s = MAP_SIZE / MAP_SPAN;
    return [(x - MAP_MIN_X) * s, (z - MAP_MIN_Z) * s];
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    const s = MAP_SIZE / MAP_SPAN;
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    // The bay to the south, land everywhere else.
    ctx.fillStyle = '#274b5e';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    const landH = (HALF - MAP_MIN_Z) * s;
    ctx.fillStyle = '#6a6a5e';
    ctx.fillRect(0, 0, MAP_SIZE, landH);
    // District colours per block, matching the world layout.
    const districts = [
      ['#c9b896', '#c9b896', '#8a94a0', '#8a94a0', '#b09a7a'],
      ['#c9b896', '#8a8578', '#8a94a0', '#8a94a0', '#9aa4ae'],
      ['#4d7a4a', '#77806f', '#d8d0bc', '#c9c2ae', '#8a8578'],
      ['#8a8578', '#77806f', '#8a94a0', '#8a94a0', '#a08a6a'],
      ['#8a8578', '#77806f', '#8a8578', '#a08a6a', '#a08a6a'],
    ];
    for (let bx = 0; bx < BLOCKS; bx += 1) {
      for (let bz = 0; bz < BLOCKS; bz += 1) {
        const [mx, mz] = this.toMap(-HALF + ROAD + bx * PITCH, -HALF + ROAD + bz * PITCH);
        ctx.fillStyle = districts[bz][bx];
        ctx.fillRect(mx, mz, BLOCK * s, BLOCK * s);
      }
    }
    // Roads.
    ctx.strokeStyle = '#3a3f45';
    ctx.lineWidth = ROAD * s;
    for (const c of ROAD_CENTRES) {
      const [mx] = this.toMap(c, 0);
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, landH);
      ctx.stroke();
      const [, mz] = this.toMap(0, c);
      ctx.beginPath();
      ctx.moveTo(0, mz);
      ctx.lineTo(MAP_SIZE, mz);
      ctx.stroke();
    }
    // The busway median down Jl. Sudirman.
    const [corX] = this.toMap(CORRIDOR_X, 0);
    ctx.strokeStyle = '#a04a3c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(corX, 0);
    ctx.lineTo(corX, landH);
    ctx.stroke();
    // The MRT line along the north edge and the coastal flyover.
    ctx.strokeStyle = '#4a6a8a';
    ctx.lineWidth = 2;
    const [, railZ] = this.toMap(0, -HALF - 14);
    ctx.beginPath();
    ctx.moveTo(0, railZ);
    ctx.lineTo(MAP_SIZE, railZ);
    ctx.stroke();
    const [, flyZ] = this.toMap(0, HALF + 26);
    ctx.beginPath();
    ctx.moveTo(0, flyZ);
    ctx.lineTo(MAP_SIZE, flyZ);
    ctx.stroke();
    // Monument plaza and the grand roundabout.
    const [sqX, sqZ] = this.toMap(0, 0);
    ctx.fillStyle = '#e8e0cc';
    ctx.beginPath();
    ctx.arc(sqX, sqZ, 14 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a7a5a';
    ctx.beginPath();
    ctx.arc(sqX, sqZ, 3, 0, Math.PI * 2);
    ctx.fill();
    const [rbX, rbZ] = this.toMap(ROUNDABOUT.x, ROUNDABOUT.z);
    ctx.strokeStyle = '#e8e0cc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rbX, rbZ, 13 * s, 0, Math.PI * 2);
    ctx.stroke();
    // Street labels.
    ctx.fillStyle = 'rgba(240,240,235,0.75)';
    ctx.font = '7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(corX + 6, 60);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('JL. SUDIRMAN', 0, 0);
    ctx.restore();
    ctx.fillText('TUGU', sqX, sqZ + 24);
    const [ktX, ktZ] = this.toMap(-104, -104);
    ctx.fillText('KOTA TUA', ktX, ktZ);
    const [kgX, kgZ] = this.toMap(104, 104);
    ctx.fillText('KAMPUNG', kgX, kgZ);
    // Objective blip.
    if (state.objective) {
      const [ox, oz] = this.toMap(state.objective.x, state.objective.z);
      const pulse = 4 + Math.sin(this.time * 4) * 1.5;
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.moveTo(ox, oz - pulse - 2);
      ctx.lineTo(ox + pulse, oz);
      ctx.lineTo(ox, oz + pulse + 2);
      ctx.lineTo(ox - pulse, oz);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7a5c00';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Police.
    for (const p of state.police || []) {
      const [px, pz] = this.toMap(p.x, p.z);
      ctx.fillStyle = Math.sin(this.time * 9) > 0 ? '#ff4444' : '#4488ff';
      ctx.beginPath();
      ctx.arc(px, pz, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Enemies.
    for (const e of state.enemies || []) {
      const [ex, ez] = this.toMap(e.x, e.z);
      ctx.fillStyle = '#e04030';
      ctx.beginPath();
      ctx.arc(ex, ez, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const [px, pz] = this.toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.atan2(Math.sin(state.heading), -Math.cos(state.heading)));
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
