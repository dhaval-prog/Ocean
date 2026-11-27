// A live ring of water round each avatar, drawn on a small canvas every frame:
// several wave trains run round the ring at different speeds and directions,
// so its edges keep reshaping unevenly like real water; a slow swell makes
// some stretches choppy and others nearly flat; crests catch foam; a few
// glints drift along it; the light comes from the upper left. The ring is
// thick in some places and thin in others (the swell of water drifts round),
// and it takes its colours from the sea at the current time of day.

const TAU = Math.PI * 2;

function waves(seed) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const list = [];
  for (const k of [3, 5, 7, 9, 12, 15, 19]) {
    list.push({ k, amp: (0.35 + rnd() * 0.65) / (1 + k * 0.08), speed: (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.9), phase: rnd() * TAU });
  }
  return { list, swell: [rnd() * TAU, rnd() * TAU, 0.15 + rnd() * 0.2], body: [rnd() * TAU, rnd() * TAU, (rnd() < 0.5 ? -1 : 1) * (0.12 + rnd() * 0.15)] };
}

/** -1 … 1-ish displacement of the water surface at angle a, time t. */
function disp(w, a, t, shift = 0) {
  let v = 0;
  for (const c of w.list) v += c.amp * Math.sin(c.k * a - c.speed * t + c.phase + shift * c.k * 0.37);
  const env = 1 + 0.55 * Math.sin(2 * a + w.swell[2] * t + w.swell[0]) + 0.3 * Math.sin(3 * a - 0.17 * t + w.swell[1]);
  return v * Math.max(0.2, env) * 0.75;
}

/** How thick the water is at angle a (1 = average): swells and thin stretches that drift round slowly. */
function bodyAt(w, a, t) {
  const [p1, p2, sp] = w.body;
  const v = 0.55 * Math.sin(2 * a + sp * t + p1) + 0.3 * Math.sin(3 * a - sp * 1.6 * t + p2) + 0.15 * Math.sin(7 * a + sp * 3 * t);
  return Math.max(0.22, 1 + v);                        // never quite disappears
}

const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

export class WaterRings {
  /** @param {HTMLElement[]} ports  the avatar containers (each sized like its picture) */
  constructor(ports) {
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // colours of the sea right now (setColors): lit water, mid water, deep water, foam
    this.col = { hi: [235, 250, 255], mid: [140, 210, 250], deep: [60, 150, 225], foam: [255, 255, 255] };
    this.items = ports.map((port, i) => {
      const cv = document.createElement('canvas');
      cv.className = 'water'; cv.setAttribute('aria-hidden', 'true');
      port.prepend(cv);
      // per ring: its own clock (speed), how lively the water is (calm),
      // rain / snow inside (precip) and its own colours (col, else the sea's)
      return { port, cv, ctx: cv.getContext('2d'), w: waves(i * 7.31 + 3.7), size: 0, t: Math.random() * 50, speed: 1, calm: 1, precip: null, col: null, drops: [] };
    });
  }

  /** Take the ring colours from the sea at the current time of day ([r, g, b] 0 … 255 each). */
  setColors(hi, mid, deep, foam) { Object.assign(this.col, { hi, mid, deep, foam }); }

  draw(now = performance.now()) {
    const dt = this._last ? Math.min(0.1, (now - this._last) / 1000) : 0; this._last = now;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const it of this.items) {
      if (!this.reduce) it.t += dt * it.speed;
      const face = it.port.offsetWidth;
      if (!face) continue;
      const pad = Math.round(face * 0.34), size = face + pad * 2;
      if (it.size !== size) {
        it.size = size;
        it.cv.width = Math.round(size * dpr); it.cv.height = Math.round(size * dpr);
        Object.assign(it.cv.style, { width: size + 'px', height: size + 'px', left: -pad + 'px', top: -pad + 'px' });
      }
      this._ring(it, face / 2, size, it.t, dpr, dt);
    }
  }

  _ring(it, faceR, size, t, dpr, dt) {
    const g = it.ctx, c = size / 2, w = it.w, col = it.col || this.col;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    const thick = Math.max(3.4, faceR * 0.17), mid = faceR + faceR * 0.22 + thick / 2;   // a gap of sea between picture and water
    const A = Math.max(1.1, faceR * 0.06) * it.calm, N = 120;
    const outer = [], inner = [], crest = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const d1 = disp(w, a, t), d2 = disp(w, a, t * 1.13, 1.7);
      const half = thick * bodyAt(w, a, t) / 2;                  // thicker here, thinner there
      const ro = mid + half + d1 * A, ri = mid - half + d2 * A * 0.6;
      outer.push([c + ro * Math.cos(a), c + ro * Math.sin(a)]);
      inner.push([c + ri * Math.cos(a), c + ri * Math.sin(a)]);
      crest.push(d1);
    }
    // the body of water: light where it faces the sun (upper left), deeper blue elsewhere
    const lg = g.createLinearGradient(c - mid, c - mid, c + mid, c + mid);
    lg.addColorStop(0, rgba(col.hi, 0.95));
    lg.addColorStop(0.45, rgba(col.mid, 0.88));
    lg.addColorStop(1, rgba(col.deep, 0.92));
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
      g.strokeStyle = rgba(col.foam, (0.25 + 0.7 * f).toFixed(3));
      g.lineWidth = 0.8 + f * 1.4;
      g.beginPath(); g.moveTo(outer[i][0], outer[i][1]); g.lineTo(outer[i + 1][0], outer[i + 1][1]); g.stroke();
    }
    // a thin bright line on the inner edge
    g.strokeStyle = rgba(col.foam, 0.45); g.lineWidth = 0.8;
    g.beginPath(); inner.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    // glints drifting along the water at different speeds
    for (let k = 0; k < 3; k++) {
      const a0 = ((t * (0.18 + k * 0.07) * (k % 2 ? -1 : 1) + k * 2.1) % TAU + TAU) % TAU;
      const span = 0.18 + 0.1 * Math.sin(t * 0.7 + k);
      g.strokeStyle = rgba(col.foam, (0.55 + 0.35 * Math.sin(t * 1.3 + k * 1.7)).toFixed(3));
      g.lineWidth = 1.3;
      g.beginPath(); g.arc(c, c, mid + Math.sin(t + k) * thick * 0.2, a0, a0 + span); g.stroke();
    }
    if (it.precip) this._precip(it, g, c, faceR, dt);
  }

  /** Rain or snow falling inside the circle (their weather). */
  _precip(it, g, c, faceR, dt) {
    const snow = it.precip === 'snow', D = it.drops;
    while (D.length < (snow ? 14 : 18)) D.push({ x: (Math.random() * 2 - 1) * faceR * 0.85, y: -faceR - Math.random() * faceR * 2, v: snow ? 6 + Math.random() * 6 : 38 + Math.random() * 20 });
    g.save(); g.beginPath(); g.arc(c, c, faceR * 0.98, 0, Math.PI * 2); g.clip();
    g.strokeStyle = 'rgba(220, 236, 255, 0.85)'; g.fillStyle = 'rgba(255, 255, 255, 0.95)'; g.lineWidth = 1.1; g.lineCap = 'round';
    for (const d of D) {
      d.y += d.v * dt; if (snow) d.x += Math.sin(d.y * 0.2) * 0.15;
      if (d.y > faceR) { d.y = -faceR - Math.random() * 10; d.x = (Math.random() * 2 - 1) * faceR * 0.85; }
      if (snow) { g.beginPath(); g.arc(c + d.x, c + d.y, 1.3, 0, Math.PI * 2); g.fill(); }
      else { g.beginPath(); g.moveTo(c + d.x, c + d.y); g.lineTo(c + d.x - 1, c + d.y + 4.5); g.stroke(); }
    }
    g.restore();
  }
}
