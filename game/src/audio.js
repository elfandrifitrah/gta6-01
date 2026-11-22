// Synthesized WebAudio sound and music, written in this session. No audio files.
let ctx = null, master = null, musicTimer = null, muted = false, musicStep = 0;
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
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.2, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur);
}
function noise(dur, vol, low) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 1200;
  const g = c.createGain(); g.gain.value = vol || 0.3;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
export const audio = {
  unlock() { ac(); },
  isMuted() { return muted; },
  toggleMute() { muted = !muted; return muted; },
  shot() { noise(0.18, 0.5, 3000); tone(180, 0.1, 'square', 0.15, 60); },
  punch() { noise(0.08, 0.35, 800); },
  cash() { tone(880, 0.12, 'sine', 0.2); setTimeout(() => tone(1320, 0.2, 'sine', 0.2), 90); },
  hurt() { tone(140, 0.2, 'sawtooth', 0.2, 70); },
  fail() { tone(220, 0.4, 'sawtooth', 0.2, 110); },
  siren() { tone(700, 0.5, 'sine', 0.08, 950); },
  click() { tone(600, 0.05, 'square', 0.1); },
  engine(on) {
    if (muted || !on) return;
    const c = ac(); if (!c) return;
    tone(70 + Math.random() * 20, 0.12, 'sawtooth', 0.03);
  },
  startMusic() {
    if (musicTimer || muted) return;
    const bass = [55, 55, 65.4, 49];
    const lead = [220, 261.6, 329.6, 392, 329.6, 261.6];
    musicTimer = setInterval(() => {
      if (muted) return;
      const b = bass[musicStep % bass.length];
      tone(b, 0.45, 'triangle', 0.12);
      if (musicStep % 2 === 0) tone(lead[musicStep % lead.length], 0.22, 'sine', 0.06);
      musicStep++;
    }, 240);
  },
  stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
};
