// The chat button: a speech bubble drawn in live water, the same water as the friends' rings
// (uneven thickness, foam on the crests, glints, the sea's colours for the time of day). Its inside
// is clear, so the sea shows through; three little foam dots sit inside. It is "naked": no disc
// behind it, only a soft shadow (by day) or a faint glow (at night) so it reads on any water.
import { waves, disp, bodyAt } from './WaterRing.js';

const TAU = Math.PI * 2;
const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
const TAIL = 2.25;                              // the tail points down and to the left (radians, y down)

/** Radius of the bubble outline at angle a (a circle with a pointed tail). */
function shape(a, R) {
  const d = Math.cos(a - TAIL);
  return R * (1 + 0.95 * Math.pow(Math.max(0, d), 22)) * (1 + 0.06 * Math.cos(2 * a));   // a pointed tail; a little wider than tall
}

export class ChatBubble {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.w = waves(11.3); this.t = Math.random() * 40;
    this.col = { hi: [235, 250, 255], mid: [140, 210, 250], deep: [60, 150, 225], foam: [255, 255, 255] };
    this.light = 1; this.size = 0;
  }

  setColors(hi, mid, deep, foam, light = 1) { Object.assign(this.col, { hi, mid, deep, foam }); this.light = light; }

  draw(dt) {
    const cv = this.cv, size = cv.clientWidth; if (!size) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.size !== size) { this.size = size; cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); }
    this.t += dt;
    const g = this.g, c = size / 2, t = this.t, w = this.w, col = this.col;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, size, size);
    const R = size * 0.27, thick = Math.max(3.4, size * 0.068), A = size * 0.006, N = 160;   // gentle ripples: the bubble shape stays clear
    const outer = [], inner = [], crest = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU, mid = shape(a, R);
      const d1 = disp(w, a, t), d2 = disp(w, a, t * 1.13, 1.7);
      const tail = Math.pow(Math.max(0, Math.cos(a - TAIL)), 22);
      const half = thick * (0.7 + 0.3 * bodyAt(w, a, t)) * (1 - 0.35 * tail) / 2;   // a little thicker here and thinner there
      const ro = mid + half + d1 * A, ri = mid - half + d2 * A * 0.6;
      outer.push([c + ro * Math.cos(a), c + ro * Math.sin(a)]);
      inner.push([c + ri * Math.cos(a), c + ri * Math.sin(a)]);
      crest.push(d1);
    }
    const path = (pts, close = true) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); };
    // a faint clear inside: the sea shows through, just a touch brighter
    path(inner); g.fillStyle = rgba(col.hi, 0.16); g.fill();
    // the body of water, lit from the upper left; a soft shadow by day, a faint glow at night
    const night = Math.max(0, Math.min(1, (0.6 - this.light) / 0.35));
    const lg = g.createLinearGradient(c - R, c - R, c + R, c + R);
    lg.addColorStop(0, rgba(col.hi, 0.96)); lg.addColorStop(0.45, rgba(col.mid, 0.9)); lg.addColorStop(1, rgba(col.deep, 0.94));
    path(outer);
    for (let i = inner.length - 1; i >= 0; i--) (i === inner.length - 1 ? g.moveTo : g.lineTo).call(g, inner[i][0], inner[i][1]);
    g.closePath();
    g.shadowColor = night > 0.5 ? rgba(col.foam, 0.7 * night) : 'rgba(10, 40, 80, 0.45)';
    g.shadowBlur = night > 0.5 ? 10 : 6; g.shadowOffsetY = night > 0.5 ? 0 : 2;
    g.fillStyle = lg; g.fill('evenodd');
    g.shadowColor = 'transparent';
    // foam on the crests of the outer edge
    g.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const f = Math.min(1, Math.max(0, (crest[i] - 0.15) / 0.9)); if (f <= 0.02) continue;
      g.strokeStyle = rgba(col.foam, (0.25 + 0.7 * f).toFixed(3)); g.lineWidth = 0.8 + f * 1.4;
      g.beginPath(); g.moveTo(outer[i][0], outer[i][1]); g.lineTo(outer[i + 1][0], outer[i + 1][1]); g.stroke();
    }
    g.strokeStyle = rgba(col.foam, 0.5); g.lineWidth = 0.8; path(inner, true); g.stroke();
    // glints drifting along the water
    for (let k = 0; k < 3; k++) {
      const a0 = ((t * (0.2 + k * 0.08) * (k % 2 ? -1 : 1) + k * 2.1) % TAU + TAU) % TAU, span = 0.22 + 0.1 * Math.sin(t * 0.7 + k);
      g.strokeStyle = rgba(col.foam, (0.55 + 0.35 * Math.sin(t * 1.3 + k * 1.7)).toFixed(3)); g.lineWidth = 1.3;
      g.beginPath();
      for (let s = 0; s <= 8; s++) { const a = a0 + span * s / 8, r = shape(a, R) + Math.sin(t + k) * thick * 0.2; (s ? g.lineTo : g.moveTo).call(g, c + r * Math.cos(a), c + r * Math.sin(a)); }
      g.stroke();
    }
    // three foam dots inside, rising and falling like little bubbles
    for (let k = 0; k < 3; k++) {
      const x = c + (k - 1) * R * 0.42, y = c + Math.sin(t * 2.4 - k * 0.9) * R * 0.07;
      g.fillStyle = rgba(col.foam, 0.95); g.shadowColor = 'rgba(10, 40, 80, 0.35)'; g.shadowBlur = 3;
      g.beginPath(); g.arc(x, y, Math.max(2, R * 0.1), 0, TAU); g.fill();
    }
    g.shadowColor = 'transparent';
  }
}
