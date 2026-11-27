// Synthesized WebAudio sound and music. No audio files.
let ctx = null, master = null, musicTimer = null, muted = false, musicStep = 0;
let engineOsc = null, engineGain = null, sirenTimer = null, sirenHi = false;
function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
function tone(freq, dur, type, vol, slideTo) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), c.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.2, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur);
}
function noise(dur, vol, low) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 1200;
  const g = c.createGain(); g.gain.value = vol || 0.3;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
function ensureEngine() {
  const c = ac(); if (!c || engineOsc) return;
  engineOsc = c.createOscillator();
  engineOsc.type = 'sawtooth';
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = 240;
  engineGain = c.createGain(); engineGain.gain.value = 0;
  engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(master);
  engineOsc.start();
}
function stopSiren() {
  if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
}
export const audio = {
  unlock() { ac(); },
  isMuted() { return muted; },
  toggleMute() {
    muted = !muted;
    if (muted) { stopSiren(); if (engineGain) engineGain.gain.value = 0; }
    return muted;
  },
  shot() { noise(0.12, 0.45, 2800); tone(180, 0.08, 'square', 0.12, 70); },
  hit() { tone(1400, 0.05, 'square', 0.08); },
  punch() { noise(0.08, 0.35, 800); },
  cash() { tone(880, 0.12, 'sine', 0.2); setTimeout(() => tone(1320, 0.2, 'sine', 0.2), 90); },
  hurt() { tone(140, 0.2, 'sawtooth', 0.2, 70); },
  fail() { tone(220, 0.4, 'sawtooth', 0.2, 110); },
  siren() { tone(700, 0.5, 'sine', 0.08, 950); },
  horn() { tone(466, 0.16, 'square', 0.1); setTimeout(() => tone(392, 0.2, 'square', 0.08), 150); },
  crash() { noise(0.22, 0.45, 500); tone(90, 0.16, 'sawtooth', 0.12, 40); },
  screech() { noise(0.09, 0.12, 1800); },
  click() { tone(600, 0.05, 'square', 0.1); },
  engineRpm(speed, on) {
    if (muted || !on) { if (engineGain) engineGain.gain.setTargetAtTime(0, ac()?.currentTime || 0, 0.05); return; }
    const c = ac(); if (!c) return;
    ensureEngine();
    const rpm = 62 + Math.min(40, Math.abs(speed)) * 3.4;
    engineOsc.frequency.setTargetAtTime(rpm, c.currentTime, 0.08);
    engineGain.gain.setTargetAtTime(0.04, c.currentTime, 0.08);
  },
  engine(on) { this.engineRpm(8, on); },
  chase(on) {
    if (!on || muted) { stopSiren(); return; }
    if (sirenTimer) return;
    sirenTimer = setInterval(() => {
      if (muted) return;
      sirenHi = !sirenHi;
      tone(sirenHi ? 740 : 560, 0.26, 'sine', 0.045);
    }, 280);
  },
  startMusic() {
    if (musicTimer || muted) return;
    const bass = [55, 55, 65.4, 49];
    const lead = [220, 261.6, 329.6, 392, 329.6, 261.6];
    musicTimer = setInterval(() => {
      if (muted) return;
      const b = bass[musicStep % bass.length];
      tone(b, 0.45, 'triangle', 0.1);
      if (musicStep % 2 === 0) tone(lead[musicStep % lead.length], 0.22, 'sine', 0.05);
      musicStep++;
    }, 240);
  },
  stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
};
