// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, siren, gunfire, impacts, and a small sequenced music loop.
// Everything is guarded: before the first user gesture the context stays
// suspended and every call is a no-op, so headless and muted runs never throw.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      this.startEngine();
      this.startSiren();
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(running, speedNorm) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const target = running ? 0.05 + 0.1 * speedNorm : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + 130 * speedNorm, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(280 + 900 * speedNorm, t, 0.1);
  }

  startSiren() {
    const ctx = this.ctx;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    this.sirenLfo = ctx.createOscillator();
    this.sirenLfo.type = 'square';
    this.sirenLfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 110;
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  setSiren(level) {
    if (!this.ctx || !this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(Math.min(0.12, 0.03 * level), this.ctx.currentTime, 0.3);
  }

  burst({ duration, frequency, type, gain, slideTo }) {
    if (!this.ctx) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    } catch { /* sound is decoration; never break the game */ }
  }

  noise({ duration, gain, filterFreq, type }) {
    if (!this.ctx || !this.noiseBuffer) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.playbackRate.value = 0.7 + Math.random() * 0.6;
      const filter = ctx.createBiquadFilter();
      filter.type = type || 'lowpass';
      filter.frequency.value = filterFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + duration + 0.02);
    } catch { /* sound is decoration */ }
  }

  shot() {
    this.noise({ duration: 0.14, gain: 0.5, filterFreq: 3200, type: 'bandpass' });
    this.burst({ duration: 0.1, frequency: 180, type: 'square', gain: 0.25, slideTo: 50 });
  }

  punch() {
    this.noise({ duration: 0.09, gain: 0.4, filterFreq: 300 });
    this.burst({ duration: 0.08, frequency: 120, type: 'sine', gain: 0.4, slideTo: 45 });
  }

  crash(strength) {
    const s = Math.min(1, strength);
    this.noise({ duration: 0.25 + 0.2 * s, gain: 0.3 + 0.4 * s, filterFreq: 500 });
    this.burst({ duration: 0.2, frequency: 90, type: 'sine', gain: 0.3 * s, slideTo: 35 });
  }

  screech() {
    this.noise({ duration: 0.3, gain: 0.12, filterFreq: 2400, type: 'bandpass' });
  }

  pickup() {
    this.burst({ duration: 0.12, frequency: 660, type: 'sine', gain: 0.3 });
    setTimeout(() => this.burst({ duration: 0.16, frequency: 990, type: 'sine', gain: 0.3 }), 90);
  }

  click() {
    this.burst({ duration: 0.05, frequency: 880, type: 'sine', gain: 0.15 });
  }

  sting(good) {
    const notes = good ? [392, 523, 659, 784] : [330, 262, 196];
    notes.forEach((freq, i) => {
      setTimeout(() => this.burst({ duration: 0.22, frequency: freq, type: 'triangle', gain: 0.28 }), i * 110);
    });
  }

  // A small loop in A minor: bass on the beat, a plucked figure, hats.
  startMusic() {
    const ctx = this.ctx;
    this.nextNoteTime = ctx.currentTime + 0.1;
    const bassLine = [55, 55, 65.41, 55, 49, 49, 58.27, 65.41];
    const pluckNotes = [220, 261.63, 329.63, 261.63, 220, 196, 246.94, 329.63];
    const stepDur = 0.24;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      try {
        // Never schedule a burst of catch-up notes after muting or after
        // the tab was throttled: drop the backlog and resume from now.
        if (this.nextNoteTime < ctx.currentTime - 0.3) this.nextNoteTime = ctx.currentTime + 0.1;
        while (this.nextNoteTime < ctx.currentTime + 0.3) {
          const step = this.musicStep % 8;
          const t = this.nextNoteTime;
          const bass = ctx.createOscillator();
          bass.type = 'triangle';
          bass.frequency.value = bassLine[step];
          const bg = ctx.createGain();
          bg.gain.setValueAtTime(0.11, t);
          bg.gain.exponentialRampToValueAtTime(0.001, t + stepDur);
          bass.connect(bg);
          bg.connect(this.master);
          bass.start(t);
          bass.stop(t + stepDur);
          if (step % 2 === 0) {
            const pluck = ctx.createOscillator();
            pluck.type = 'square';
            pluck.frequency.value = pluckNotes[step];
            const pg = ctx.createGain();
            pg.gain.setValueAtTime(0.045, t);
            pg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            pluck.connect(pg);
            pg.connect(this.master);
            pluck.start(t);
            pluck.stop(t + 0.2);
          }
          const hat = ctx.createBufferSource();
          hat.buffer = this.noiseBuffer;
          const hf = ctx.createBiquadFilter();
          hf.type = 'highpass';
          hf.frequency.value = 6000;
          const hg = ctx.createGain();
          hg.gain.setValueAtTime(step % 2 === 1 ? 0.05 : 0.025, t);
          hg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          hat.connect(hf);
          hf.connect(hg);
          hg.connect(this.master);
          hat.start(t);
          hat.stop(t + 0.06);
          this.musicStep += 1;
          this.nextNoteTime += stepDur;
        }
      } catch { /* keep the loop alive */ }
    }, 120);
  }
}
