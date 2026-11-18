// All sound is synthesized WebAudio: engine drone, siren wail, gunshots, pickups and
// jingles. Nothing is loaded; the context starts on the first gesture and every call is
// guarded, so a browser without audio still plays silently.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let noiseBuf = null;
  let started = false;
  let muted = false;
  let sirenPhase = 0;

  function makeNoise() {
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  }

  function ensure() {
    if (started) {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      makeNoise();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      const amb = ctx.createBufferSource();
      amb.buffer = noiseBuf;
      amb.loop = true;
      const ambFilter = ctx.createBiquadFilter();
      ambFilter.type = 'lowpass';
      ambFilter.frequency.value = 240;
      const ambGain = ctx.createGain();
      ambGain.gain.value = 0.012;
      amb.connect(ambFilter);
      ambFilter.connect(ambGain);
      ambGain.connect(master);
      amb.start();
      started = true;
    } catch (e) {
      ctx = null;
    }
  }

  function tone(freq, dur, type, gain, slideTo, delay) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) { /* silent */ }
  }

  function noise(dur, gain, filterFreq, type) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = type || 'lowpass';
      f.frequency.value = filterFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    } catch (e) { /* silent */ }
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    shot() { noise(0.14, 0.5, 1800, 'highpass'); tone(120, 0.12, 'sine', 0.35, 45); },
    punch() { tone(95, 0.1, 'sine', 0.5, 50); noise(0.06, 0.2, 500); },
    hit() { tone(70, 0.16, 'sine', 0.5, 38); noise(0.12, 0.3, 700); },
    crash() { noise(0.3, 0.55, 900); tone(60, 0.25, 'sine', 0.5, 30); },
    pickup() { tone(660, 0.09, 'sine', 0.3); tone(880, 0.14, 'sine', 0.3, 0, 0.08); },
    cash() { tone(784, 0.1, 'triangle', 0.3); tone(988, 0.1, 'triangle', 0.3, 0, 0.09); tone(1319, 0.2, 'triangle', 0.3, 0, 0.18); },
    complete() {
      tone(523, 0.14, 'triangle', 0.32);
      tone(659, 0.14, 'triangle', 0.32, 0, 0.12);
      tone(784, 0.14, 'triangle', 0.32, 0, 0.24);
      tone(1047, 0.3, 'triangle', 0.34, 0, 0.36);
    },
    fail() { tone(320, 0.2, 'sawtooth', 0.18, 240); tone(210, 0.3, 'sawtooth', 0.18, 150, 0.18); },
    click() { tone(700, 0.05, 'square', 0.12); },
    horn() { tone(392, 0.22, 'square', 0.16); tone(494, 0.22, 'square', 0.14); },
    skid() { noise(0.2, 0.1, 2600, 'highpass'); },
    sirenBlip() { tone(880, 0.09, 'triangle', 0.2, 700); },
    update(G, dt) {
      if (!ctx || muted) return;
      try {
        const driving = G.player.driving;
        const speed = driving ? Math.abs(driving.speed) : 0;
        const target = driving ? 0.05 + Math.min(0.09, speed * 0.0028) : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(52 + speed * 3.4, ctx.currentTime, 0.08);
        let nearest = Infinity;
        for (const v of G.vehicles) {
          if (v.kind !== 'police') continue;
          const d = Math.hypot(v.x - G.player.x, v.z - G.player.z);
          if (d < nearest) nearest = d;
        }
        const levelBoost = 0.6 + G.wanted.level * 0.25;
        const sirenTarget = nearest < 90 ? (0.05 * (1 - nearest / 90) + 0.015) * levelBoost : 0;
        sirenGain.gain.setTargetAtTime(sirenTarget, ctx.currentTime, 0.2);
        if (sirenTarget > 0.005) {
          sirenPhase += dt * 2.6;
          sirenOsc.frequency.setTargetAtTime(Math.sin(sirenPhase * Math.PI * 2) > 0 ? 720 : 950, ctx.currentTime, 0.05);
        }
      } catch (e) { /* silent */ }
    },
  };
}
