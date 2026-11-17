// Synthesized sound for Solmar Bay: every effect is built with WebAudio oscillators
// and filtered noise, so the game ships no audio files at all.
const THREE = window.THREE;

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
  }

  /** Must be called from a user gesture; browsers block audio before one. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.startEngineLoop();
      this.startSirenLoop();
    } catch (err) {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  blip(freq, seconds, type, volume, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  noiseBurst(seconds, volume, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(seconds);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  startEngineLoop() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 40;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  startSirenLoop() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  /** Called every frame: engine pitch follows speed, siren wails while wanted. */
  update(dt, speedRatio, wanted) {
    if (!this.ctx) return;
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 45 + speedRatio * 160;
      this.engineGain.gain.value = speedRatio > 0.02 ? 0.05 + speedRatio * 0.05 : 0;
    }
    if (this.sirenOsc) {
      this.sirenTimer += dt;
      if (this.sirenTimer > 0.45) {
        this.sirenTimer = 0;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.value = this.sirenHigh ? 950 : 650;
      }
      const target = wanted > 0 && !this.muted ? 0.045 : 0;
      this.sirenGain.gain.value += (target - this.sirenGain.gain.value) * Math.min(1, dt * 4);
    }
  }

  shoot() {
    this.noiseBurst(0.12, 0.5, 2800);
    this.blip(180, 0.08, 'square', 0.18, 60);
  }

  punch() {
    this.noiseBurst(0.08, 0.3, 700);
  }

  crash() {
    this.noiseBurst(0.25, 0.5, 500);
  }

  pickup() {
    this.blip(660, 0.09, 'sine', 0.25);
    setTimeout(() => this.blip(880, 0.12, 'sine', 0.25), 90);
    setTimeout(() => this.blip(1320, 0.16, 'sine', 0.22), 180);
  }

  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => {
      setTimeout(() => this.blip(freq, 0.22, 'triangle', 0.25), i * 110);
    });
  }

  fail() {
    this.blip(220, 0.5, 'sawtooth', 0.2, 110);
  }

  click() {
    this.blip(900, 0.05, 'square', 0.12);
  }

  busted() {
    this.blip(440, 0.3, 'sawtooth', 0.2, 220);
    setTimeout(() => this.blip(330, 0.5, 'sawtooth', 0.2, 165), 300);
  }
}
