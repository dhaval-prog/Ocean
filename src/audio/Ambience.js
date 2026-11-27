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
// the letter's mood changes the music: chords, how often they change, how often bells ring, scale
const MOOD_MUSIC = {
  none:   { chords: CHORDS, every: 8000, bell: 0.55, bells: PENTA, shift: 0 },
  miss:   { chords: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]], every: 9500, bell: 0.35, bells: [69, 72, 74, 76, 79], shift: 0 },
  thanks: { chords: [[60, 64, 67, 72], [65, 69, 72, 76], [67, 71, 74, 79], [60, 64, 67, 71]], every: 6500, bell: 0.7, bells: [72, 76, 79, 84, 88], shift: 0 },
  night:  { chords: [[41, 48, 53, 57], [43, 50, 55, 59], [38, 45, 50, 53], [36, 43, 48, 52]], every: 12000, bell: 0.2, bells: [64, 67, 69, 72], shift: 0 },
  love:   { chords: [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 68]], every: 8500, bell: 0.5, bells: [74, 76, 78, 81, 83], shift: 0 },
  cheer:  { chords: [[60, 64, 67, 69], [62, 65, 69, 72], [64, 67, 71, 74], [65, 69, 72, 76]], every: 5000, bell: 0.8, bells: [76, 79, 81, 84, 86], shift: 0 },
};
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
    this.waves = ctx.createGain(); this.waves.gain.value = 0; this.waves.connect(this.master);
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

    // hail: a dry rattle of tiny random clicks
    const cbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), cd = cbuf.getChannelData(0);
    for (let n = 0; n < 900; n++) {
      const at = Math.floor(Math.random() * (cd.length - 400)), amp = 0.3 + Math.random() * 0.7;
      for (let i = 0; i < 300; i++) cd[at + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / 40);
    }
    this.hail = ctx.createGain(); this.hail.gain.value = 0; this.hail.connect(this.master);
    { const src = ctx.createBufferSource(); src.buffer = cbuf; src.loop = true; src.start();
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      src.connect(hp); hp.connect(this.hail); }

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
    this._mm = this._mm || MOOD_MUSIC.none;
    const playChord = () => {
      const t = ctx.currentTime, set = this._mm.chords, notes = set[this._chord++ % set.length];
      for (const n of notes) for (const [type, det] of [['triangle', -4], ['sine', 5]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = hz(n); o.detune.value = det;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 3); g.gain.linearRampToValueAtTime(0, t + 10);
        o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 10.5);
      }
    };
    const playBell = () => {
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      const bells = this._mm.bells;
      o.type = 'sine'; o.frequency.value = hz(bells[Math.floor(Math.random() * bells.length)]);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 3.2);
    };
    this._playChord = playChord; this._playBell = playBell;
    playChord();
    this._schedule();
  }

  _schedule() {
    (this._timers || []).forEach(clearInterval);
    const m = this._mm;
    this._timers = [setInterval(this._playChord, m.every), setInterval(() => Math.random() < m.bell && this._playBell(), 2300)];
  }

  /** The letter's mood: 'none', 'miss', 'thanks', 'night', 'love', 'cheer' - shifts the music. */
  setMood(id) {
    this._mm = MOOD_MUSIC[id] || MOOD_MUSIC.none;
    if (!this.ctx) return;
    this._chord = 0; this._playChord(); this._schedule();
  }

  _noiseHit(dur, filterType, freq, q, gain, when = 0) {
    if (!this.ctx || this.muted || !this._whiteBuf) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this._whiteBuf;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(0.01, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }

  /** Writing: a soft pen scratch per key (a little different each time). */
  scratch() {
    const now = performance.now(); if (now - (this._scr || 0) < 35) return; this._scr = now;
    this._noiseHit(0.05 + Math.random() * 0.04, 'bandpass', 2600 + Math.random() * 2200, 1.6, 0.05 + Math.random() * 0.03);
  }

  /** A page rustle (new line, changing paper). */
  rustle() {
    this._noiseHit(0.22, 'bandpass', 1500, 0.6, 0.08);
    this._noiseHit(0.18, 'highpass', 3500, 0.5, 0.05, 0.08);
  }

  /** A paper crease for fold step n (each a little higher and crisper than the last). */
  crease(n = 0) {
    this._noiseHit(0.16, 'bandpass', 900 + n * 260, 1.4, 0.05);
    this._noiseHit(0.1, 'highpass', 3000 + n * 300, 0.7, 0.03, 0.03);
  }

  /** The shape is finished: a firm paper snap and a soft low knock. */
  ready() {
    this._noiseHit(0.26, 'bandpass', 2400, 0.9, 0.06);
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.2);
  }

  /** A soft water plop, pitched per friend (i). */
  plop(i = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime, f0 = 300 + ((i * 7) % 12) * 40;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + 0.09);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.2);
  }

  /** A cork popping out of a bottle. */
  cork() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(1300, t + 0.05);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.1);
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

  /** A foghorn: a long, deep, two-tone blast. */
  foghorn() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = ctx.createGain(); out.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    out.connect(lp); lp.connect(this.master);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.34, t + 0.35);
    out.gain.setValueAtTime(0.34, t + 2.4); out.gain.linearRampToValueAtTime(0, t + 3.3);
    for (const [f, type, g] of [[98, 'sawtooth', 0.5], [147, 'square', 0.18], [49, 'sine', 0.6]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.4);   // the blast settles onto pitch
      const gg = ctx.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(out); o.start(t); o.stop(t + 3.4);
    }
  }

  /** Little magic moments: 'rainbow' (rising bell arpeggio) or 'sun' (soft shimmer). */
  chime(kind = 'rainbow') {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const notes = kind === 'rainbow' ? [72, 76, 79, 83, 84, 88] : [79, 84, 88];
    notes.forEach((n, i) => {
      const t = t0 + i * (kind === 'rainbow' ? 0.11 : 0.18), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = hz(n);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(kind === 'rainbow' ? 0.09 : 0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 2.4);
    });
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(m ? 0 : 0.8, t, 0.4);
  }

  update(storm, night, rain = 0, wind = storm, hail = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.waves.gain.setTargetAtTime(0, t, 0.5);                       // no ocean wave sound
    this.wind.gain.setTargetAtTime(0.03 + Math.max(storm, wind) * 0.22, t, 0.5);
    this.rain.gain.setTargetAtTime(rain * 0.9, t, 0.8);
    this.hail.gain.setTargetAtTime(hail * 0.7, t, 0.4);
    this.music.gain.setTargetAtTime(0.11 - storm * 0.05 + night * 0.02, t, 1);
  }
}
