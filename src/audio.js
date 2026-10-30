export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.music = null;
    this.muted = false;
    this.musicOn = true;
    this.musicTimer = null;
    this.step = 0;
    this.ready = false;
  }

  init() {
    if (this.ready) {
      if (this.ctx?.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.55;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = 0.12;
      this.music.connect(this.master);
      this.ready = true;
      this.applySettings();
      this.startMusic();
    } catch {
      this.ready = false;
    }
  }

  applySettings() {
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
    this.music.gain.setTargetAtTime(this.musicOn && !this.muted ? 0.12 : 0, this.ctx.currentTime, 0.05);
  }

  setMuted(v) {
    this.muted = v;
    this.applySettings();
  }

  setMusic(v) {
    this.musicOn = v;
    this.applySettings();
    if (v) this.startMusic();
    else this.stopMusic();
  }

  tone(freq, dur = 0.12, type = 'sine', vol = 0.3, slide = null, delay = 0, dest = null) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slide != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur = 0.2, vol = 0.25, delay = 0, filterFreq = 1200) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t);
  }

  play(name) {
    if (!this.ready || this.muted) return;
    switch (name) {
      case 'click':
        this.tone(620, 0.06, 'square', 0.1);
        break;
      case 'place':
        this.tone(360, 0.08, 'triangle', 0.22, 540);
        this.tone(720, 0.06, 'sine', 0.1, 900, 0.02);
        break;
      case 'erase':
        this.tone(300, 0.1, 'triangle', 0.18, 150);
        break;
      case 'coin':
        this.tone(980, 0.09, 'sine', 0.22);
        this.tone(1460, 0.12, 'sine', 0.16, null, 0.06);
        break;
      case 'star':
        [880, 1108, 1320, 1760].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.16, null, i * 0.06));
        break;
      case 'rescue':
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.2, null, i * 0.07));
        break;
      case 'spawn':
        this.tone(420, 0.1, 'sine', 0.12, 620);
        break;
      case 'spring':
        this.tone(260, 0.2, 'sine', 0.2, 900);
        break;
      case 'boost':
        this.tone(180, 0.35, 'sawtooth', 0.12, 1200);
        this.noise(0.3, 0.12, 0, 900);
        break;
      case 'warp':
        this.tone(300, 0.25, 'sine', 0.16, 1200);
        this.tone(1200, 0.2, 'sine', 0.1, 300, 0.08);
        break;
      case 'crumble':
        this.noise(0.28, 0.22, 0, 700);
        this.tone(110, 0.15, 'square', 0.08, 60);
        break;
      case 'bump':
        this.tone(140, 0.08, 'square', 0.12, 100);
        break;
      case 'bumper':
        this.tone(300, 0.12, 'square', 0.16, 700);
        break;
      case 'death':
        this.tone(320, 0.5, 'sawtooth', 0.2, 70);
        this.noise(0.3, 0.16, 0, 500);
        break;
      case 'win':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.16, null, i * 0.09));
        break;
      case 'fail':
        this.tone(240, 0.3, 'triangle', 0.16, 140);
        this.tone(180, 0.4, 'sine', 0.12, 90, 0.15);
        break;
      default:
        break;
    }
  }

  startMusic() {
    if (!this.ready || !this.musicOn || this.musicTimer) return;
    const notes = [220, 261.63, 329.63, 392, 329.63, 261.63, 196, 246.94, 293.66, 349.23, 293.66, 246.94];
    this.step = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ready || this.muted || !this.musicOn || document.hidden) return;
      const n = notes[this.step % notes.length];
      this.step++;
      this.tone(n, 0.42, 'sine', 0.16, null, 0, this.music);
      if (this.step % 4 === 1) this.tone(n / 2, 0.7, 'triangle', 0.12, null, 0, this.music);
      if (this.step % 8 === 5) this.tone(n * 2, 0.3, 'sine', 0.05, null, 0.1, this.music);
    }, 620);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
