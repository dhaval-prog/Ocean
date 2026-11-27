// Generated ambience (no audio files): waves, wind, rain, thunder and a soft
// generative pad with the odd bell note. Browsers only allow audio after a user gesture, so
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
    this._noiseBuf = buf;
    // white noise for rain hiss
    const wbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), w = wbuf.getChannelData(0);
    for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
    this._whiteBuf = wbuf;
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

    // rain: hiss (high-passed white noise) over a soft patter (band-passed)
    this.rain = ctx.createGain(); this.rain.gain.value = 0; this.rain.connect(this.master);
    for (const [type, f, q, g] of [['highpass', 2400, 0.5, 0.16], ['bandpass', 900, 0.8, 0.22]]) {
      const src = ctx.createBufferSource(); src.buffer = wbuf; src.loop = true; src.start(ctx.currentTime + Math.random());
      const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      const gg = ctx.createGain(); gg.gain.value = g;
      src.connect(flt); flt.connect(gg); gg.connect(this.rain);
    }

    // music bus: lowpass + feedback delay for a soft, spacious pad
    this.music = ctx.createGain(); this.music.gain.value = 0.11;
    const mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 1600;
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    this.music.connect(mlp); mlp.connect(this.master); mlp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(this.master);

    // boat engine: a low diesel chug whose rate and loudness follow the throttle
    this.engine = ctx.createGain(); this.engine.gain.value = 0;
    const elp = ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 320;
    this.engine.connect(elp); elp.connect(this.master);
    this.engineOsc = [ctx.createOscillator(), ctx.createOscillator()];
    this.engineOsc[0].type = 'sawtooth'; this.engineOsc[0].frequency.value = 46;
    this.engineOsc[1].type = 'square'; this.engineOsc[1].frequency.value = 92.5;
    const chugAmp = ctx.createGain(); chugAmp.gain.value = 0.5;
    this.chug = ctx.createOscillator(); this.chug.type = 'sine'; this.chug.frequency.value = 4;
    const chugDepth = ctx.createGain(); chugDepth.gain.value = 0.45;
    this.chug.connect(chugDepth); chugDepth.connect(chugAmp.gain);
    for (const o of this.engineOsc) { const g = ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(chugAmp); o.start(); }
    chugAmp.connect(this.engine); this.chug.start();
    this.setEngine(this._engineLevel ?? 0);

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

  /** Engine throttle 0 … 1 (idle putter at 0). */
  setEngine(t01) {
    this._engineLevel = t01;
    if (!this.ctx || !this.engine) return;
    const t = this.ctx.currentTime;
    this.engine.gain.setTargetAtTime(0.05 + t01 * 0.13, t, 0.25);
    this.chug.frequency.setTargetAtTime(3.5 + t01 * 7.5, t, 0.3);
    this.engineOsc[0].frequency.setTargetAtTime(46 + t01 * 22, t, 0.3);
    this.engineOsc[1].frequency.setTargetAtTime(92.5 + t01 * 44, t, 0.3);
  }

  /** Tugboat horn: two-note "toot". */
  horn() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = ctx.createGain(); out.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    out.connect(lp); lp.connect(this.master);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.22, t + 0.06);
    out.gain.setValueAtTime(0.22, t + 0.9); out.gain.linearRampToValueAtTime(0, t + 1.25);
    for (const [f, det] of [[174.6, -6], [220, 5], [349.2, 0]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = f > 300 ? 0.25 : 0.5;
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.3);
    }
  }

  /** Thunder after `delay` seconds; strength 0 … 1. Close strikes open with a sharp crack. */
  thunder(delay = 1, strength = 1, near = strength > 0.75) {
    if (!this.ctx || this.muted || !this._noiseBuf) return;
    const ctx = this.ctx, t = ctx.currentTime + delay, dur = 3 + strength * 4;
    if (near && this._whiteBuf) {
      // the crack: a bright, ripping burst
      const cs = ctx.createBufferSource(); cs.buffer = this._whiteBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.6;
      const cg = ctx.createGain(); cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(0.55 * strength, t + 0.01);
      cg.gain.setTargetAtTime(0.25 * strength, t + 0.05, 0.03); cg.gain.setTargetAtTime(0.0001, t + 0.18, 0.12);
      cs.connect(bp); bp.connect(cg); cg.connect(this.master); cs.start(t); cs.stop(t + 1);
    }
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180 + strength * 500; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(180 + strength * 500, t); lp.frequency.exponentialRampToValueAtTime(90, t + dur);
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9 * strength, t + 0.08 + (1 - strength) * 0.4);    // crack, or a distant swell
    g.gain.setTargetAtTime(0.5 * strength, t + 0.4, 0.3);
    // rolls: the rumble swells again a few times as echoes come back off the clouds
    for (let i = 0, at = 0.8; i < 3; i++, at += 0.6 + Math.random() * 1.1) g.gain.setTargetAtTime((0.55 - i * 0.12) * strength * (0.7 + Math.random() * 0.5), t + at, 0.25);
    g.gain.setTargetAtTime(0.0001, t + 3.2, dur / 4);                                   // long fade
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 3); src.stop(t + dur + 1);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(m ? 0 : 0.8, t, 0.4);
  }

  update(storm, night, rain = 0, wind = storm) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.waves.gain.setTargetAtTime(0.45 + storm * 0.6, t, 0.5);
    this.wind.gain.setTargetAtTime(0.03 + Math.max(storm, wind) * 0.22, t, 0.5);
    this.rain.gain.setTargetAtTime(rain * 0.9, t, 0.8);
    this.music.gain.setTargetAtTime(0.11 - storm * 0.05 + night * 0.02, t, 1);
  }
}
