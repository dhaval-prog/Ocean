// Generated ambience (no audio files): waves, wind, and a soft generative pad
// with the odd bell note. Browsers only allow audio after a user gesture, so
// call start() from a tap or key press.

const CHORDS = [
  [53, 57, 60, 64], // Fmaj7
  [57, 60, 64, 67], // Am7
  [50, 57, 60, 65], // Dm(add9)-ish
  [48, 55, 60, 64], // C
];
const PENTA = [72, 74, 76, 79, 81, 84];
const hz = n => 440 * Math.pow(2, (n - 69) / 12);

export class Ambience {
  constructor() { this.ctx = null; this.muted = false; this.storm = 0.3; this.night = 0; }

  start() {
    if (this.ctx) { if (!this.muted) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.8, ctx.currentTime + 3);

    // brown noise source shared by waves and wind
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const noise = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(ctx.currentTime + Math.random()); return s; };
    const lfo = (rate, depth, target) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(target); o.start();
    };

    // waves: two swelling layers
    this.waves = ctx.createGain(); this.waves.gain.value = 0.5; this.waves.connect(this.master);
    for (const [rate, cut] of [[0.09, 420], [0.13, 900]]) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut;
      const g = ctx.createGain(); g.gain.value = 0.35;
      noise().connect(lp); lp.connect(g); g.connect(this.waves);
      lfo(rate, 0.3, g.gain);
    }

    // wind: band-passed noise with a wandering centre
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.7;
    this.wind = ctx.createGain(); this.wind.gain.value = 0.05;
    noise().connect(bp); bp.connect(this.wind); this.wind.connect(this.master);
    lfo(0.05, 350, bp.frequency);

    // music bus: lowpass + feedback delay for a soft, spacious pad
    this.music = ctx.createGain(); this.music.gain.value = 0.11;
    const mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 1600;
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    this.music.connect(mlp); mlp.connect(this.master); mlp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(this.master);

    this._chord = 0;
    const playChord = () => {
      const t = ctx.currentTime, notes = CHORDS[this._chord++ % CHORDS.length];
      for (const n of notes) for (const [type, det] of [['triangle', -4], ['sine', 5]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = hz(n); o.detune.value = det;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 3); g.gain.linearRampToValueAtTime(0, t + 10);
        o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 10.5);
      }
    };
    const playBell = () => {
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = hz(PENTA[Math.floor(Math.random() * PENTA.length)]);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 3.2);
    };
    playChord();
    this._timers = [setInterval(playChord, 8000), setInterval(() => Math.random() < 0.55 && playBell(), 2300)];
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(m ? 0 : 0.8, t, 0.4);
  }

  update(storm, night) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.waves.gain.setTargetAtTime(0.45 + storm * 0.6, t, 0.5);
    this.wind.gain.setTargetAtTime(0.03 + storm * 0.22, t, 0.5);
    this.music.gain.setTargetAtTime(0.11 - storm * 0.05 + night * 0.02, t, 1);
  }
}
