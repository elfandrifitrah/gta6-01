// Every sound is synthesized with WebAudio: no audio files, no network.
// The engine hum follows the car's speed, the siren follows the nearest police
// car, and the one-shots cover punches, shots, pickups and mission jingles.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;
  let unlocked = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (unlocked) return;
    if (!ensure()) return;
    unlocked = true;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      engineOsc = ctx.createOscillator();
      engineOsc2 = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineFilter = ctx.createBiquadFilter();
      engineOsc.type = 'sawtooth';
      engineOsc2.type = 'square';
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenLfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenLfo.frequency.value = 0.7;
      lfoGain.gain.value = 190;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
    } catch {
      // Headless or blocked audio: the game stays silent and keeps working.
    }
  }

  // Scheduling on a suspended context queues every sound to fire in one
  // burst when the tab regains focus. Stay silent until it runs again.
  function live() {
    return !!ctx && !muted && ctx.state === 'running';
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!live()) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch { /* silent */ }
  }

  function noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!live()) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch { /* silent */ }
  }

  function note(freq, when, dur, vol) {
    if (!live()) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + dur + 0.05);
    } catch { /* silent */ }
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (master && ctx) master.gain.value = muted ? 0 : 0.45;
    },
    isMuted() {
      return muted;
    },
    /** Continuous voices: engine follows speed, siren follows police distance. */
    update({ inCar, speed01, throttle, policeNear01 }) {
      if (!live()) return;
      const t = ctx.currentTime;
      try {
        if (engineGain) {
          const target = inCar ? 0.05 + 0.11 * speed01 + (throttle ? 0.04 : 0) : 0;
          engineGain.gain.setTargetAtTime(target, t, 0.08);
          const freq = 55 + speed01 * 165;
          engineOsc.frequency.setTargetAtTime(freq, t, 0.06);
          engineOsc2.frequency.setTargetAtTime(freq * 1.5 + 3, t, 0.06);
          engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.1);
        }
        if (sirenGain) sirenGain.gain.setTargetAtTime(policeNear01 * 0.05, t, 0.25);
      } catch { /* silent */ }
    },
    honk() { blip(340, 0.22, 'square', 0.16); blip(425, 0.22, 'square', 0.1); },
    punch() { noise(0.1, 0.5, 300); blip(120, 0.09, 'sine', 0.35, 55); },
    shot() { noise(0.14, 0.55, 2600, 'highpass'); blip(190, 0.07, 'sawtooth', 0.25, 60); },
    crash(strength) { noise(0.18, Math.min(0.6, 0.2 + strength), 500); },
    pickup() { note(660, 0, 0.12, 0.22); note(880, 0.09, 0.18, 0.22); },
    coin() { note(990, 0, 0.09, 0.2); note(1320, 0.07, 0.14, 0.2); },
    jingle() { note(523, 0, 0.14, 0.24); note(659, 0.12, 0.14, 0.24); note(784, 0.24, 0.14, 0.24); note(1047, 0.36, 0.3, 0.26); },
    fail() { note(330, 0, 0.2, 0.22); note(262, 0.18, 0.3, 0.22); },
    wantedUp() { blip(700, 0.12, 'square', 0.14); blip(520, 0.16, 'square', 0.14); },
    ui() { blip(520, 0.06, 'sine', 0.14); },
    bust() { blip(440, 0.3, 'sawtooth', 0.2, 220); },
  };
}
