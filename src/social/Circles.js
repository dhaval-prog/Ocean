import { TIMES } from '../ocean/palettes.js';
import { todFromClock } from '../core/Clock.js';

// Everything that makes the contact circles feel alive (the water itself is
// WaterRing.js):
//   - the chosen circle swirls faster with a koi swimming laps; the rest calm down
//   - a friend's ring takes the colours of THEIR local time of day, and rain or
//     snow falls inside it if that's their weather (Open-Meteo, by city)
//   - "writing to you…": bubbles rise faster and the ring pulses outward
//   - long-press to peek: their status, the first line of their last letter, when you last wrote
//   - drag a circle down onto the letter: it splashes and writes "Dear …,"
//   - new letters arrive as a bottle bobbing into the ring, the number pops up
//   - streak shells, birthday fish + confetti, night lanterns over online
//     friends, night constellations between the friends you write to most,
//     their status floating in a bottle (tap to pop the cork)
// The "writing" and "new letter" moments are simulated for the demo.

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SHELL = '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 3 7.5 3 12c0 2 1 3.4 2.6 4.2L7 20h10l1.4-3.8C20 15.4 21 14 21 12c0-4.5-3.5-9-9-9z" fill="#ffd9c0" stroke="#7a4a3a" stroke-width="1.6"/><path d="M12 5v14M8 6l2 13M16 6l-2 13" stroke="#d9906a" stroke-width="1.2"/></svg>';
const BOTTLE = '<svg viewBox="0 0 24 24"><path d="M10 2h4v3l1 2v13a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V7l1-2z" fill="rgba(190,235,240,.75)" stroke="#2f6f7a" stroke-width="1.4"/><rect x="10" y="1" width="4" height="3" rx="1" fill="#b07a45" class="cork"/><path d="M10.5 11h3v6h-3z" fill="#fff7e3" stroke="#c9a46a" stroke-width=".8"/></svg>';
const LANTERN = '<svg viewBox="0 0 24 32"><path d="M12 1v4" stroke="#7a5a3a" stroke-width="1.4"/><path d="M6 8c0-2 2.7-3 6-3s6 1 6 3v12c0 2-2.7 3-6 3s-6-1-6-3z" fill="#ffcf73" stroke="#c0712f" stroke-width="1.4"/><path d="M8 7v15M12 6v17M16 7v15" stroke="#e8964a" stroke-width=".8" opacity=".7"/><path d="M9 25h6l-1 3h-4z" fill="#c0712f"/></svg>';
const FISH = '<svg viewBox="0 0 32 20"><path d="M2 10c4-7 14-8 20-2l8-5-2 7 2 7-8-5C16 18 6 17 2 10z" fill="#ff9d4d" stroke="#7a3a2a" stroke-width="1.3"/><circle cx="8" cy="9" r="1.4" fill="#2a1a1a"/></svg>';

function hourIn(tz) {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    const h = +p.find(x => x.type === 'hour').value, m = +p.find(x => x.type === 'minute').value;
    const d = new Date(); d.setHours(h, m, 0, 0); return d;
  } catch { return new Date(); }
}
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
/** Ring colours (bright, shallow, deep, foam) for a time of day 0 … 5. */
function ringColors(tod) {
  const n = TIMES.length, f = ((tod % n) + n) % n, i = Math.floor(f), j = (i + 1) % n, k = f - i;
  const c = idx => mix(hex(TIMES[i].pal[idx]), hex(TIMES[j].pal[idx]), k);
  return [c(4), c(3), c(1), c(5)];
}
const birthdayToday = p => {
  if (!p.birthday) return false;
  if (p.birthday === 'today') return true;
  const d = new Date(); return p.birthday === `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export class CircleFX {
  constructor(letter) {
    this.L = letter;
    this.busy = false;                 // a contact is being dragged or peeked (the row swipe / click wait)
    this.night = false;
    this.weather = {};                 // friend id → 'rain' | 'snow' | null
    this.myPrecip = null;
    this._wx = false;
    this._t = { writing: 12 + Math.random() * 10, arrive: 25 + Math.random() * 15, fish: 3, col: 0 };
    const people = letter.recipients;
    letter.people.forEach((btn, i) => {
      const p = people[i], port = btn.querySelector('.port');
      if (p.streak > 0) {                                       // friendship streak: shells round the ring
        const n = Math.min(p.streak, 7);
        port.insertAdjacentHTML('beforeend', `<span class="streak" title="${p.streak}-day streak" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<i style="--a:${-118 - k * 15}deg">${SHELL}</i>`).join('')}${p.streak > 7 ? '<b>+</b>' : ''}</span>`);
      }
      if (p.status) {                                           // status in a bottle
        port.insertAdjacentHTML('beforeend', `<button type="button" class="sbottle" aria-label="${esc(p.name)}'s status">${BOTTLE}</button>`);
        port.querySelector('.sbottle').addEventListener('click', e => { e.stopPropagation(); this._popStatus(btn, p); });
        port.querySelector('.sbottle').addEventListener('pointerdown', e => e.stopPropagation());
      }
      if (p.online) port.insertAdjacentHTML('beforeend', `<span class="lantern" aria-hidden="true">${LANTERN}</span>`);
      if (birthdayToday(p)) { btn.classList.add('birthday'); p._bday = true; }
      port.insertAdjacentHTML('beforeend', '<span class="pulse" aria-hidden="true"></span><span class="pulse p2" aria-hidden="true"></span>');
    });
    this._bindPress();
  }

  // --- open / close / every frame -----------------------------------------------------
  open() {
    if (!this._wx) { this._wx = true; this._fetchWeather(); }
    this._recolour();
  }

  close() { this._closePeek(); this._stopWriting(); }

  update(dt) {
    const L = this.L, T = this._t;
    // the chosen circle comes alive; the rest calm down
    L.water.items.forEach((it, k) => {
      const ri = k - 2, sel = ri === L.index;
      it.speed = sel ? 2.1 : 0.55; it.calm = sel ? 1.15 : 0.7; it.koi = sel;
      const p = ri >= 0 ? L.recipients[ri] : null;
      it.precip = p && p.id !== 'me' ? this.weather[p.id] || null : this.myPrecip;
    });
    if ((T.col -= dt) <= 0) { T.col = 20; this._recolour(); }
    // demo moments: a friend writing to you, a new letter arriving, birthday fish
    if ((T.writing -= dt) <= 0) { T.writing = 22 + Math.random() * 20; this._startWriting(); }
    if ((T.arrive -= dt) <= 0) { T.arrive = 30 + Math.random() * 25; this._arrive(); }
    if ((T.fish -= dt) <= 0) { T.fish = 3.5 + Math.random() * 3; L.people.forEach((b, i) => L.recipients[i]._bday && this._leap(b)); }
    // night: lanterns over online friends, constellations between close friends
    const night = L.look.light < 0.5;
    if (night !== this.night) { this.night = night; L.row.classList.toggle('night', night); }
    if (night) this._drawConstellation();
  }

  /** Friend rings in the colours of their own local time of day (mine and the extras follow the sea). */
  _recolour() {
    const L = this.L;
    L.water.items.forEach((it, k) => {
      const p = L.recipients[k - 2];
      it.col = p && p.tz && p.id !== 'me' ? (() => { const [hi, mid, deep, foam] = ringColors(todFromClock(hourIn(p.tz))); return { hi, mid, deep, foam }; })() : null;
    });
  }

  async _fetchWeather() {
    const fr = this.L.recipients.filter(p => p.id !== 'me' && p.lat != null);
    if (!fr.length) return;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${fr.map(p => p.lat).join(',')}&longitude=${fr.map(p => p.lon).join(',')}&current=weather_code`;
      const res = await fetch(url); if (!res.ok) return;
      let data = await res.json(); if (!Array.isArray(data)) data = [data];
      data.forEach((d, i) => {
        const c = d?.current?.weather_code ?? 0;
        this.weather[fr[i].id] = (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95 ? 'rain' : null;
      });
    } catch { /* offline: no weather in the circles */ }
  }

  // --- "writing to you…" ---------------------------------------------------------------
  _startWriting() {
    const L = this.L, cands = L.recipients.map((p, i) => [p, i]).filter(([p, i]) => p.online && i !== L.index);
    if (!cands.length) return;
    const [p, i] = cands[Math.floor(Math.random() * cands.length)], btn = L.people[i];
    btn.classList.add('writing');
    const city = btn.querySelector('.city'); city.dataset.city = city.textContent; city.innerHTML = 'writing<span class="dots"><i>.</i><i>.</i><i>.</i></span>';
    clearTimeout(this._wt); this._wbtn = btn;
    this._wt = setTimeout(() => this._stopWriting(), 6000 + Math.random() * 4000);
  }

  _stopWriting() {
    const b = this._wbtn; if (!b) return;
    b.classList.remove('writing');
    const city = b.querySelector('.city'); if (city.dataset.city) city.textContent = city.dataset.city;
    this._wbtn = null;
  }

  // --- a new letter arrives ----------------------------------------------------------------
  _arrive() {
    const L = this.L, cands = L.recipients.map((p, i) => i).filter(i => i !== 0 && i !== L.index);
    if (!cands.length) return;
    const i = cands[Math.floor(Math.random() * cands.length)], p = L.recipients[i], port = L.people[i].querySelector('.port');
    const b = document.createElement('span'); b.className = 'arrive'; b.innerHTML = BOTTLE; port.appendChild(b);
    setTimeout(() => b.remove(), 2600);
    setTimeout(() => {
      p.unread = (p.unread || 0) + 1;
      let badge = port.querySelector('.badge.unread');
      if (!badge) { badge = document.createElement('span'); badge.className = 'badge unread'; port.appendChild(badge); }
      badge.classList.remove('read', 'bump'); void badge.offsetWidth; badge.classList.add('bump');
      badge.textContent = p.unread > 99 ? '99+' : p.unread;
      L.audio?.plop(i + 3);
    }, 1500);
  }

  // --- birthday: fish leap out of the ring; confetti when you pick them ------------------
  _leap(btn) {
    const port = btn.querySelector('.port'), f = document.createElement('span');
    f.className = 'leap'; f.innerHTML = FISH; f.style.setProperty('--side', Math.random() < 0.5 ? -1 : 1);
    port.appendChild(f); setTimeout(() => f.remove(), 1600);
  }

  confetti(btn) {
    const port = btn.querySelector('.port'), cols = ['#ff7a59', '#ffc94a', '#5ed39b', '#4aa8ff', '#b27bff', '#ff9ec7'];
    for (let k = 0; k < 18; k++) {
      const c = document.createElement('i'); c.className = 'confetti';
      c.style.background = cols[k % cols.length];
      c.style.setProperty('--x', ((Math.random() - 0.5) * 120).toFixed(0) + 'px');
      c.style.setProperty('--y', (-30 - Math.random() * 60).toFixed(0) + 'px');
      c.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      port.appendChild(c); setTimeout(() => c.remove(), 1400);
    }
  }

  // --- night constellation between the friends you write to most -----------------------------
  _drawConstellation() {
    const L = this.L, svg = L.row.querySelector('.constellation'), box = L.row.getBoundingClientRect();
    const order = L.recipients.map((p, i) => [p, i]).filter(([p]) => p.id === 'me' || (p.writes || 0) >= 15)
      .sort((a, b) => (b[0].id === 'me') - (a[0].id === 'me') || (b[0].writes || 0) - (a[0].writes || 0));
    const pts = order.map(([, i]) => { const r = L.people[i].querySelector('.face').getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; });
    if (pts.length < 2) { svg.innerHTML = ''; return; }
    const [me, ...rest] = pts;
    let d = '';
    rest.forEach((p, k) => { const a = k ? rest[k - 1] : me; d += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${p[0].toFixed(1)} ${p[1].toFixed(1)}`; });
    svg.innerHTML = `<path d="${d}"/>${pts.map(([x, y], k) => `<circle cx="${x.toFixed(1)}" cy="${(y - 0).toFixed(1)}" r="2.2" style="animation-delay:${k * 0.4}s"/>`).join('')}`;
  }

  // --- status in a bottle -------------------------------------------------------------------
  _popStatus(btn, p) {
    const port = btn.querySelector('.port'), b = port.querySelector('.sbottle');
    b.classList.remove('popped'); void b.offsetWidth; b.classList.add('popped');
    this.L.audio?.cork();
    port.querySelector('.say')?.remove();
    const say = document.createElement('span'); say.className = 'say'; say.textContent = p.status;
    port.appendChild(say); setTimeout(() => say.remove(), 3200);
  }

  // --- the circle catches a letter --------------------------------------------------------
  catch(i, kind) {
    const btn = this.L.people[i]; if (!btn) return;
    const port = btn.querySelector('.port');
    port.classList.remove('catch'); void port.offsetWidth; port.classList.add('catch');
    port.dataset.caught = kind === 'bottle' ? '🍾' : '✉';
    setTimeout(() => port.classList.remove('catch'), 1500);
    this.L.audio?.plop(i); this.L.audio?.chime('sun');
    this.L._tick();
  }

  // --- long-press to peek / drag a contact onto the letter ------------------------------------
  _bindPress() {
    const L = this.L;
    let pr = null;
    L.people.forEach((btn, i) => btn.addEventListener('pointerdown', e => {
      if (e.target.closest('.sbottle')) return;
      pr = { id: e.pointerId, i, btn, x: e.clientX, y: e.clientY, mode: null };
      pr.timer = setTimeout(() => { if (pr && !pr.mode && L.recipients[i].id !== 'me') { pr.mode = 'peek'; this.busy = true; this._peek(btn, L.recipients[i]); } }, 450);
    }));
    window.addEventListener('pointermove', e => {
      if (!pr || pr.id !== e.pointerId) return;
      const dx = e.clientX - pr.x, dy = e.clientY - pr.y;
      if (!pr.mode && Math.hypot(dx, dy) > 10) {
        clearTimeout(pr.timer);
        if (dy > 12 && dy > Math.abs(dx) * 1.2) { pr.mode = 'drag'; this.busy = true; pr.ghost = this._ghost(pr.btn); }
        else pr.mode = 'none';
      }
      if (pr.mode === 'drag') { pr.ghost.style.left = e.clientX + 'px'; pr.ghost.style.top = e.clientY + 'px'; }
    });
    const up = e => {
      if (!pr || pr.id !== e.pointerId) return;
      clearTimeout(pr.timer);
      const p = pr; pr = null;
      if (p.mode === 'drag') {
        const box = L.el.getBoundingClientRect();
        const onPaper = !L.el.hidden && e.clientX > box.left && e.clientX < box.right && e.clientY > box.top && e.clientY < box.bottom;
        if (onPaper) {                                     // dropped on the letter: splash, "Dear …,"
          p.ghost.classList.add('dropped');
          const s = document.createElement('i'); s.className = 'drop-splash';
          s.style.left = (e.clientX - box.left) + 'px'; s.style.top = (e.clientY - box.top) + 'px';
          L.sparks.appendChild(s); setTimeout(() => s.remove(), 900);
          L.select(p.i); L.audio?.plop(p.i);
        } else p.ghost.classList.add('back');
        setTimeout(() => p.ghost.remove(), 450);
      }
      if (p.mode === 'peek') setTimeout(() => this._closePeek(), 1800);
      setTimeout(() => { this.busy = false; }, 60);
    };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    window.addEventListener('pointerdown', e => { if (this._peekEl && !e.target.closest('.peek')) this._closePeek(); }, { capture: true });
  }

  _ghost(btn) {
    const f = btn.querySelector('.face'), r = f.getBoundingClientRect(), g = f.cloneNode(true);
    g.classList.add('ghost'); g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    g.style.left = (r.left + r.width / 2) + 'px'; g.style.top = (r.top + r.height / 2) + 'px';
    document.body.appendChild(g);
    return g;
  }

  _peek(btn, p) {
    this._closePeek();
    const r = btn.querySelector('.port').getBoundingClientRect(), el = document.createElement('div');
    el.className = 'peek';
    const ago = p.lastWrote == null ? '' : p.lastWrote === 0 ? 'You wrote today' : p.lastWrote === 1 ? 'You last wrote yesterday' : `You last wrote ${p.lastWrote} days ago`;
    el.innerHTML = `<b>${esc(p.name)}</b>${p.status ? `<span class="st">${esc(p.status)}</span>` : ''}${p.lastLetter ? `<q>${esc(p.lastLetter)}</q>` : ''}<small>${ago}${p.streak ? ` · ${p.streak}-day streak` : ''}</small>`;
    el.style.left = Math.max(12, Math.min(innerWidth - 232, r.left + r.width / 2 - 110)) + 'px';
    el.style.top = (r.bottom + 34) + 'px';
    el.style.setProperty('--ox', (r.left + r.width / 2 - Math.max(12, Math.min(innerWidth - 232, r.left + r.width / 2 - 110))) + 'px');
    this.L.root.appendChild(el); this._peekEl = el;
    this.L._tick();
  }

  _closePeek() { this._peekEl?.remove(); this._peekEl = null; }
}
