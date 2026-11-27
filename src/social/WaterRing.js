// A live ring of water round each avatar, drawn on a small canvas every frame:
// several wave trains run round the ring at different speeds and directions,
// so its edges keep reshaping unevenly like real water; a slow swell makes
// some stretches choppy and others nearly flat; crests catch foam; a few
// glints drift along it; the light comes from the upper left.

const TAU = Math.PI * 2;

function waves(seed) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const list = [];
  for (const k of [3, 5, 7, 9, 12, 15, 19]) {
    list.push({ k, amp: (0.35 + rnd() * 0.65) / (1 + k * 0.08), speed: (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.9), phase: rnd() * TAU });
  }
  return { list, swell: [rnd() * TAU, rnd() * TAU, 0.15 + rnd() * 0.2] };
}

/** -1 … 1-ish displacement of the water surface at angle a, time t. */
function disp(w, a, t, shift = 0) {
  let v = 0;
  for (const c of w.list) v += c.amp * Math.sin(c.k * a - c.speed * t + c.phase + shift * c.k * 0.37);
  const env = 1 + 0.55 * Math.sin(2 * a + w.swell[2] * t + w.swell[0]) + 0.3 * Math.sin(3 * a - 0.17 * t + w.swell[1]);
  return v * Math.max(0.2, env) * 0.75;
}

export class WaterRings {
  /** @param {HTMLElement[]} ports  the avatar containers (each sized like its picture) */
  constructor(ports) {
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.items = ports.map((port, i) => {
      const cv = document.createElement('canvas');
      cv.className = 'water'; cv.setAttribute('aria-hidden', 'true');
      port.prepend(cv);
      return { port, cv, ctx: cv.getContext('2d'), w: waves(i * 7.31 + 3.7), size: 0, t0: Math.random() * 50 };
    });
  }

  draw(now = performance.now()) {
    const t = this.reduce ? 0 : now / 1000, dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const it of this.items) {
      const face = it.port.offsetWidth;
      if (!face) continue;
      const pad = Math.round(face * 0.34), size = face + pad * 2;
      if (it.size !== size) {
        it.size = size;
        it.cv.width = Math.round(size * dpr); it.cv.height = Math.round(size * dpr);
        Object.assign(it.cv.style, { width: size + 'px', height: size + 'px', left: -pad + 'px', top: -pad + 'px' });
      }
      this._ring(it, face / 2, size, t + it.t0, dpr);
    }
  }

  _ring(it, faceR, size, t, dpr) {
    const g = it.ctx, c = size / 2, w = it.w;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    const thick = Math.max(3.2, faceR * 0.16), mid = faceR + faceR * 0.2 + thick / 2;   // a gap of sea between picture and water
    const A = Math.max(1.1, faceR * 0.06), N = 120;
    const outer = [], inner = [], crest = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const d1 = disp(w, a, t), d2 = disp(w, a, t * 1.13, 1.7);
      const ro = mid + thick / 2 + d1 * A, ri = mid - thick / 2 + d2 * A * 0.6;
      outer.push([c + ro * Math.cos(a), c + ro * Math.sin(a)]);
      inner.push([c + ri * Math.cos(a), c + ri * Math.sin(a)]);
      crest.push(d1);
    }
    // the body of water: light where it faces the sun (upper left), deeper blue elsewhere
    const lg = g.createLinearGradient(c - mid, c - mid, c + mid, c + mid);
    lg.addColorStop(0, 'rgba(235, 250, 255, 0.95)');
    lg.addColorStop(0.45, 'rgba(140, 210, 250, 0.85)');
    lg.addColorStop(1, 'rgba(60, 150, 225, 0.9)');
    g.beginPath();
    outer.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    for (let i = inner.length - 1; i >= 0; i--) (i === inner.length - 1 ? g.moveTo : g.lineTo).call(g, inner[i][0], inner[i][1]);
    g.closePath();
    g.fillStyle = lg;
    g.shadowColor = 'rgba(20, 80, 140, 0.35)'; g.shadowBlur = 3; g.shadowOffsetY = 1;
    g.fill('evenodd');
    g.shadowColor = 'transparent';
    // foam where the crests pile up on the outer edge
    g.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const f = Math.min(1, Math.max(0, (crest[i] - 0.15) / 0.9));
      if (f <= 0.02) continue;
      g.strokeStyle = `rgba(255, 255, 255, ${(0.25 + 0.7 * f).toFixed(3)})`;
      g.lineWidth = 0.8 + f * 1.4;
      g.beginPath(); g.moveTo(outer[i][0], outer[i][1]); g.lineTo(outer[i + 1][0], outer[i + 1][1]); g.stroke();
    }
    // a thin bright line on the inner edge
    g.strokeStyle = 'rgba(255, 255, 255, 0.45)'; g.lineWidth = 0.8;
    g.beginPath(); inner.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    // glints drifting along the water at different speeds
    for (let k = 0; k < 3; k++) {
      const a0 = ((t * (0.18 + k * 0.07) * (k % 2 ? -1 : 1) + k * 2.1) % TAU + TAU) % TAU;
      const span = 0.18 + 0.1 * Math.sin(t * 0.7 + k);
      g.strokeStyle = `rgba(255, 255, 255, ${(0.55 + 0.35 * Math.sin(t * 1.3 + k * 1.7)).toFixed(3)})`;
      g.lineWidth = 1.3;
      g.beginPath(); g.arc(c, c, mid + Math.sin(t + k) * thick * 0.2, a0, a0 + span); g.stroke();
    }
  }
}
