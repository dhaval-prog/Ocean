import { ME, FRIENDS, NOTIFICATIONS, INBOX } from './people.js';
import { WaterRings } from './WaterRing.js';
import { resolvePaper, inkFor } from './Stationery.js';
import { STICKERS, stickerURL } from './stickers.js';
import { CircleFX } from './Circles.js';

// The letter you write on the paper that pops out of the sea, plus the row of
// people at the top of the screen.
//   Writing: every letter draws itself in like a pen stroke, in ink that follows
//   the time of day; "to …" writes itself at the top and your name signs at
//   the bottom; every few words bubbles (fireflies at night) drift up. The paper
//   (stationery, mood) is painted by Stationery.js onto the 3D sheet.
//   Decorate: doodle with the pen, add stickers, choose paper and mood, add a
//   voice note (a wavy ink line) or a photo (a clipped-on polaroid).
//   Gestures: swipe sideways to choose who it's for; drag / flick up for a paper
//   plane, down for a bottle (see SinkSequence.send).

const ICONS = {
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="12" cy="13.2" r="3.2" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  inbox: '<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4zM4 13h4.5l1.5 2h4l1.5-2H20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
  person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M4 20l1.2-4.6L15.8 4.8a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 7l3.5 3.5" stroke="currentColor" stroke-width="1.8"/></svg>',
  eraser: '<svg viewBox="0 0 24 24"><path d="M5 15l8-8 6 6-6 6H9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 19h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="7" y="5.5" width="3.6" height="13" rx="1" fill="currentColor"/><rect x="13.4" y="5.5" width="3.6" height="13" rx="1" fill="currentColor"/></svg>',
  dictate: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5h8M3.5 11.5h6.5M3.5 15.5h4.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><rect x="14.6" y="3.5" width="5" height="9" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12.8 10.6a4.3 4.3 0 0 0 8.6 0M17.1 15v3.5M15 18.5h4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  clip: '<svg viewBox="0 0 24 40"><path d="M8 34V9a4 4 0 0 1 8 0v22a2.5 2.5 0 0 1-5 0V12" fill="none" stroke="#9aa3b2" stroke-width="2.2" stroke-linecap="round"/></svg>',
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** How far a finger may wobble before a touch counts as a drag (more on phones). */
const slop = () => (COARSE ? 15 : 10);
/** Touches starting right at the screen's side edges belong to the browser (iPhone back swipe). */
const nearEdge = e => e.pointerType !== 'mouse' && (e.clientX < 20 || e.clientX > window.innerWidth - 20);

export class Letter {
  constructor({ root, seq, hint }) {
    this.root = root;
    this.seq = seq;
    this.hint = hint;
    this.audio = null;                    // set by the app: Ambience (writing sounds, plops, mood music)
    this.recipients = [ME, ...FRIENDS];
    this.index = 0;                       // 0 = writing to yourself
    this.visible = false;
    this.look = { style: 'auto', mood: 'none', tod: 1, rain: 0, light: 1 };
    this.stickers = [];                   // { type, x, y, rot, scale, el }
    this.strokes = [];                    // doodles: { pts: [[u, v]], color }
    this.photo = null;                    // { url, img, x, y, rot, el }
    this.voice = null;                    // { peaks, url, y }
    this.pen = false;
    this._born = [];                      // when each character was typed (for the ink animation)
    this._words = 0;

    // --- writing overlay that sits exactly on top of the paper -------------
    this.el = document.createElement('div');
    this.el.className = 'letter';
    this.el.hidden = true;
    this.el.innerHTML = `
      <canvas class="doodle" aria-hidden="true"></canvas>
      <div class="deco"></div>
      <div class="tray" hidden>
        <div class="tray-pane" data-pane="stickers">${Object.keys(STICKERS).map(k => `<button type="button" class="stk-pick" data-sticker="${k}" aria-label="Add a ${k}"><img src="${stickerURL(k)}" alt="" draggable="false"></button>`).join('')}</div>
      </div>
      <div class="dear" aria-hidden="true"></div>
      <div class="ink-wrap">
        <div class="ink" aria-hidden="true"></div>
        <textarea class="letter-text" rows="6" maxlength="400" spellcheck="false" aria-label="Your letter"></textarea>
      </div>
      <div class="voice" hidden><canvas></canvas><button type="button" class="vplay" aria-label="Play the voice note">${ICONS.play}</button></div>
      <div class="sign" aria-hidden="true"></div>
      <div class="sparks" aria-hidden="true"></div>
      <div class="letter-actions">
        <div class="acts-track">
          <button type="button" data-tool="clear" class="tool" aria-label="Clear doodles" hidden>${ICONS.eraser}</button>
          <button type="button" data-tool="pen" class="tool" aria-label="Doodle with the pen" aria-pressed="false">${ICONS.pen}</button>
          <button type="button" data-act="camera" aria-label="Add a photo">${ICONS.camera}</button>
          <button type="button" data-act="mic" class="primary" aria-label="Record a voice note">${ICONS.mic}<i class="del" aria-hidden="true">×</i></button>
          <button type="button" data-act="dictate" aria-label="Speak to write" aria-pressed="false">${ICONS.dictate}</button>
          <button type="button" data-act="bell" aria-label="Remind me">${ICONS.bell}</button>
          <button type="button" data-act="inbox" aria-label="Letters in your inbox">${ICONS.inbox}<span class="badge">${INBOX}</span></button>
          <button type="button" data-tool="decor" class="tool" aria-label="Stickers" aria-expanded="false">${ICONS.sparkle}</button>
        </div>
      </div>
      <input type="file" accept="image/*" hidden>`;
    root.appendChild(this.el);
    const $ = s => this.el.querySelector(s);
    this.text = $('.letter-text'); this.ink = $('.ink'); this.dearEl = $('.dear'); this.signEl = $('.sign');
    this.doodle = $('.doodle'); this.deco = $('.deco'); this.sparks = $('.sparks'); this.tray = $('.tray');
    this.voiceEl = $('.voice'); this.file = $('input[type=file]');
    this.text.addEventListener('input', e => this._onInput(e));
    this.text.addEventListener('scroll', () => { this.ink.scrollTop = this.text.scrollTop; });
    this.text.addEventListener('focus', () => this._syncHint());
    this.text.addEventListener('blur', () => setTimeout(() => this._syncHint(), 0));

    // sticker images (for painting the finished letter onto the paper)
    for (const k of Object.keys(STICKERS)) { const im = new Image(); im.src = stickerURL(k); seq.images[k] = im; }

    this._bindTools();
    this._bindPaperGestures();
    this._buildRow(root);
    this.circles = new CircleFX(this);
    this.select(0);
  }

  get recipient() { return this.recipients[this.index]; }

  // --- people row ------------------------------------------------------------
  _buildRow(root) {
    this.row = document.createElement('div');
    this.row.className = 'people';
    this.row.hidden = true;
    // each avatar sits in a circle of water (WaterRing.js) round a photo or the
    // coloured initials; extras (bottle, lanterns …) come from Circles.js
    const bubbles = '<span class="bubbles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
    const water = k => `style="--d:${((k * 0.83) % 2.6).toFixed(2)}s"`;
    const avatar = (p, i) => {
      const who = p.id === 'me' ? 'yourself' : p.name;
      const extra = [p.unread ? `${p.unread} unread` : '', p.online ? 'on the ocean now' : ''].filter(Boolean).join(', ');
      return `
      <button type="button" class="person" data-i="${i}" aria-label="Write to ${esc(who)}${extra ? ` (${esc(extra)})` : ''}">
        <span class="port" ${water(i + 2)}>
          <span class="splash" aria-hidden="true"></span>
          <span class="face" style="--c:${p.color}">
            <span class="initials">${esc(p.initials)}</span>
            ${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
            ${bubbles}
          </span>
          ${p.online ? `<span class="online" title="On the ocean now" aria-hidden="true"></span>` : ''}
          ${p.unread ? `<span class="badge unread" aria-hidden="true">${p.unread > 99 ? '99+' : p.unread}</span>` : ''}
        </span>
        <span class="name">${esc(p.name)}</span><span class="city">${esc(p.city)}</span>
      </button>`;
    };
    this.row.innerHTML = `
      <svg class="constellation" aria-hidden="true"></svg>
      <div class="people-track">
        <div class="person extra"><span class="port" ${water(0)}><span class="splash" aria-hidden="true"></span><span class="face bell">${ICONS.bell}${bubbles}</span><span class="badge warm">${NOTIFICATIONS > 9 ? '9+' : NOTIFICATIONS}</span></span><span class="name">Notifications</span></div>
        <div class="person extra"><span class="port" ${water(1)}><span class="splash" aria-hidden="true"></span><span class="face status">${ICONS.person}${bubbles}</span><span class="plus">+</span></span><span class="name">Add Status</span></div>
        ${this.recipients.map(avatar).join('')}
      </div>
      <label class="haptic" aria-hidden="true"><input type="checkbox" switch tabindex="-1"></label>`;
    this._haptic = this.row.querySelector('.haptic');
    root.appendChild(this.row);
    this.track = this.row.querySelector('.people-track');
    this.people = [...this.row.querySelectorAll('.person[data-i]')];
    this.allPeople = [...this.row.querySelectorAll('.person')];
    this.water = new WaterRings([...this.row.querySelectorAll('.port')]);
    this._swipedAt = 0;
    this.people.forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      if (performance.now() - this._swipedAt > 350 && !this.circles?.busy) this.select(+b.dataset.i);
    }));

    // anywhere else on the letter screen: swipe left / right to choose, flick up / down to send
    let sw = null;
    root.addEventListener('pointerdown', e => {
      if (this._menu && !e.target.closest('.lmenu')) this._closeMenu();
      if (!this.visible || e.target.closest('.letter, .peek, .unsend, .lmenu')) return;
      if (this.pen && !e.target.closest('.people')) this._setPen(false);      // a tap outside the paper ends drawing
      if (nearEdge(e)) return;
      if (this._shapeable() && !e.target.closest('.people, button')) { this._startShape(e, false); return; }   // fold / roll it by hand
      sw = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    }, { capture: true });
    window.addEventListener('pointerup', e => {
      if (!sw || sw.id !== e.pointerId) return;
      const s0 = sw; sw = null;
      if (this.circles?.busy) return;                                        // a contact is being dragged / peeked
      const dx = e.clientX - s0.x, dy = e.clientY - s0.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { this.select(this.index + (dx < 0 ? 1 : -1)); this._swipedAt = performance.now(); }
    });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') this._closeMenu();
      if (!this.visible || e.target === this.text) return;
      if (e.key === 'ArrowRight') this.select(this.index + 1);
      if (e.key === 'ArrowLeft') this.select(this.index - 1);
    });
    window.addEventListener('resize', () => this._layoutRow());
  }

  select(i) {
    const prev = this.index;
    this.index = clamp(i, 0, this.recipients.length - 1);
    this.people.forEach((b, k) => b.classList.toggle('selected', k === this.index));
    const sel = this.allPeople.indexOf(this.people[this.index]);
    this.allPeople.forEach((b, k) => {
      const d = Math.abs(k - sel);
      b.style.opacity = d === 0 ? '1' : String(Math.max(0.12, 0.58 - 0.16 * (d - 1)));
      b.style.transform = d === 0 ? '' : `scale(${Math.max(0.7, 0.9 - 0.07 * (d - 1))})`;
    });
    const changed = prev !== this.index || this._first !== false;
    if (changed) {
      const port = this.people[this.index].querySelector('.port');
      port.classList.remove('pop'); void port.offsetWidth; port.classList.add('pop');
      if (this._first === false) {
        this._tick(); this.audio?.plop(this.index);                          // a water plop, pitched per friend
        if (this.recipient._bday) this.circles?.confetti(this.people[this.index]);   // birthday!
      }
    }
    this._first = false;
    if (changed && this.visible) { this._writeDear(); this._typePrompts(); }
    this._layoutRow();
  }

  _layoutRow() {
    const b = this.people[this.index];
    if (!b) return;
    const mid = b.offsetLeft + b.offsetWidth / 2;
    this.track.style.transform = `translateX(${this.row.clientWidth / 2 - mid}px)`;
  }

  /** A light haptic tick: vibrate where supported (Android), the switch-control trick on iPhone (iOS 18+). */
  _tick() { try { if (navigator.vibrate) navigator.vibrate(8); else this._haptic?.click(); } catch {} }

  _syncHint() {
    const m = this.seq.mode, v = this.seq.shapeS || 0;
    let text = null;
    if (!this.visible) text = null;
    else if (this.pen && m === 'card') text = null;
    else if (m === 'shaping') text = v >= 0.99 ? (this.learned ? 'Flick to throw · slide sideways to steer' : 'Keep pulling down and let go fast to throw · slide sideways to steer · drag up to unfold')
      : v <= -0.99 ? (this.learned ? 'Flick up to drop it in the sea' : 'Keep pushing up and let go fast to drop it in the sea · drag down to unroll') : null;
    else if (m === 'card') text = document.activeElement === this.text ? null
      : this.learned ? '↓ paper plane · ↑ bottle · swipe to choose' : 'Drag down: paper plane · drag up: bottle · swipe sideways to choose · hold for more';
    if (text) this.hint.textContent = text;
    this.hint.hidden = !text;
  }

  // --- the look: stationery, ink, mood ---------------------------------------------
  /** From the app: time of day (0 … 5), rain (0 … 1), light (0 … 1). Repaints the paper when it changes. */
  setLook({ tod, rain, light }) {
    Object.assign(this.look, { tod, rain, light });
    this._applyLook();
  }

  _applyLook(force = false) {
    const L = this.look, P = resolvePaper(L.style, L.tod, L.rain);
    const key = `${P.key}|${L.mood}|${Math.round(L.tod)}`;
    if (key !== this._lookKey || force) {
      this._lookKey = key;
      Object.assign(this.seq.look, { style: L.style, tod: L.tod, rain: L.rain, mood: L.mood });
      if (this.seq.mode !== 'idle' && this.visible) this.seq.paint();
      const ink = inkFor(L.tod, P.dark);
      this.inkCol = ink.ink;
      this.el.style.setProperty('--ink', ink.ink);
      this.el.style.setProperty('--ink-glow', ink.glow);
      this.el.classList.toggle('dark-paper', P.dark);
      this._redrawDoodles();
    }
  }

  // --- ink that flows ------------------------------------------------------------
  _onInput(e) {
    const now = performance.now(), n = this.text.value, o = this._last || '';
    let p = 0; while (p < o.length && p < n.length && o[p] === n[p]) p++;
    let s = 0; while (s < o.length - p && s < n.length - p && o[o.length - 1 - s] === n[n.length - 1 - s]) s++;
    const ins = n.length - p - s;
    this._born = [...this._born.slice(0, p), ...Array(ins).fill(0).map((_, k) => now + k * 35), ...this._born.slice(o.length - s)];
    this._last = n;
    this._renderInk();
    this._syncHint();
    // sounds, haptics, glowing words, the lifted corner
    const it = e?.inputType || '';
    if (it === 'insertLineBreak') this.audio?.rustle();
    else if (it.startsWith('insert')) this.audio?.scratch();
    if (it.startsWith('insert') && /[\s]$/.test(n.slice(0, p + ins)) && /\S/.test(n.slice(Math.max(0, p - 1), p))) {
      this._tick();
      if (++this._words % 3 === 0) this._glowWord(p - 1);
    }
    this._liftAt(p + ins - 1);
  }

  _renderInk() {
    const t = this.text.value, now = performance.now();
    let html = '', word = '';
    const flush = () => { if (word) { html += `<span class="w">${word}</span>`; word = ''; } };
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === ' ' || ch === '\n') { flush(); html += ch === ' ' ? ' ' : '\n'; continue; }
      const age = now - (this._born[i] || 0), r = ((i * 7919) % 9 - 4) * 0.5, y = ((i * 104729) % 5 - 2) * 0.25;
      const fresh = age < 650 ? ` f" style="animation-delay:${(-age).toFixed(0)}ms;--r:${r}deg;--y:${y}px` : `" style="--r:${r}deg;--y:${y}px`;
      word += `<span class="c${fresh}" data-i="${i}">${esc(ch)}</span>`;
    }
    flush();
    this.ink.innerHTML = html + '​';
    this.ink.scrollTop = this.text.scrollTop;
  }

  _charRect(i) {
    const c = this.ink.querySelector(`.c[data-i="${i}"]`);
    return c ? c.getBoundingClientRect() : null;
  }

  _liftAt(i) {
    const r = this._charRect(i), box = this.el.getBoundingClientRect();
    if (!r || !box.width) return;
    this.seq.lift.u = ((r.left + r.width / 2 - box.left) / box.width) * 2 - 1;
    this.seq.lift.v = 1 - ((r.top + r.height / 2 - box.top) / box.height) * 2;
    this.seq.lift.amt = Math.min(1, this.seq.lift.amt + 0.3);
  }

  /** Every few words: a few bubbles (fireflies at night) drift up off the line you just wrote. */
  _glowWord(i) {
    const r = this._charRect(i), box = this.el.getBoundingClientRect();
    if (!r) return;
    const night = this.look.light < 0.55 || this.el.classList.contains('dark-paper');
    for (let k = 0; k < 5; k++) {
      const d = document.createElement('i');
      d.className = night ? 'firefly' : 'bubble';
      d.style.left = (r.left - box.left - k * 6 + Math.random() * 10) + 'px';
      d.style.top = (r.top - box.top + Math.random() * 6) + 'px';
      d.style.animationDelay = (k * 90) + 'ms';
      d.style.setProperty('--dx', ((Math.random() - 0.5) * 30).toFixed(0) + 'px');
      this.sparks.appendChild(d);
      setTimeout(() => d.remove(), 2400);
    }
  }

  /** "to Aarav" writes itself at the top; your name signs at the bottom. */
  _writeDear() {
    const r = this.recipient, text = r.id === 'me' ? 'to myself' : `to ${r.name}`;
    const chars = [...text].map((ch, i) => ch === ' ' ? ' ' : `<span class="c f" style="animation-delay:${i * 55}ms">${esc(ch)}</span>`).join('');
    this.dearEl.innerHTML = `<span class="dear-text">${chars}</span>`;
    this.dearEl.style.setProperty('--len', text.length);
    this.dear = text;
  }

  /** The empty letter's prompt types itself, holds, erases and moves on to the next one. */
  _typePrompts() {
    clearTimeout(this._promptTimer);
    const r = this.recipient, who = r.id === 'me' ? 'future you' : r.name;
    const prompts = ['Write something for your loved one', `Tell ${who} about your day...`, 'What made you smile today?', `Something only ${who} would get...`];
    let p = 0, n = 0, dir = 1;
    const step = () => {
      if (!this.visible) { this.text.placeholder = ''; return; }
      const full = prompts[p];
      n += dir;
      this.text.placeholder = full.slice(0, n);
      let wait = dir > 0 ? 70 + Math.random() * 60 : 28;
      if (dir > 0 && n >= full.length) { dir = -1; wait = 2200; }
      else if (dir < 0 && n <= 0) { dir = 1; p = (p + 1) % prompts.length; wait = 450; }
      this._promptTimer = setTimeout(step, wait);
    };
    this.text.placeholder = ''; n = 0;
    this._promptTimer = setTimeout(step, 700);
  }

  _writeSign() {
    const text = `— ${ME.name}`;
    this.signEl.innerHTML = [...text].map((ch, i) => ch === ' ' ? ' ' : `<span class="c f" style="animation-delay:${600 + i * 70}ms">${esc(ch)}</span>`).join('');
    this.sign = text;
  }

  /** The bottom carousel starts with the mic button in the middle. */
  _centreActions() {
    const a = this.el.querySelector('.letter-actions'), m = a.querySelector('[data-act=mic]');
    if (this._actsTouched || !a.clientWidth) return;                         // the user has scrolled it themselves
    const ar = a.getBoundingClientRect(), mr = m.getBoundingClientRect();
    a.scrollLeft += (mr.left + mr.width / 2) - (ar.left + ar.width / 2);
  }

  /** Drawing with the pen on or off (the pen button, a tap outside the paper or a second finger ends it). */
  _setPen(on) {
    this.pen = on;
    const b = this.el.querySelector('.letter-actions [data-tool=pen]');
    b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on);
    this.el.classList.toggle('pen-on', on); this.el.querySelector('[data-tool=clear]').hidden = !on;
    if (on) { this.text.blur(); this._coachOff(); }
    this._syncHint();
  }

  // --- tools: pen, decorate tray, photo, voice -------------------------------------
  _bindTools() {
    const tools = this.el.querySelector('.letter-actions');
    tools.addEventListener('pointerdown', e => e.stopPropagation());
    tools.addEventListener('click', e => {
      const b = e.target.closest('[data-tool]'); if (!b) return;
      e.stopPropagation();
      const t = b.dataset.tool;
      if (t === 'pen') this._setPen(!this.pen);
      else if (t === 'clear') { this.strokes = []; this._redrawDoodles(); }
      else if (t === 'decor') this._toggleTray();
    });
    this.tray.addEventListener('pointerdown', e => e.stopPropagation());
    this.tray.addEventListener('click', e => {
      e.stopPropagation();
      const sk = e.target.closest('[data-sticker]');
      if (sk) this._addSticker(sk.dataset.sticker, 0.2 + Math.random() * 0.6, 0.3 + Math.random() * 0.4, true);
    });
    // actions along the bottom
    this.el.querySelector('.letter-actions').addEventListener('pointerdown', e => { e.stopPropagation(); this._actsTouched = true; });
    this.el.querySelector('[data-act=camera]').addEventListener('click', e => { e.stopPropagation(); this.file.click(); });
    this.file.addEventListener('change', () => { const f = this.file.files?.[0]; if (f) this._addPhoto(f); this.file.value = ''; });
    this.el.querySelector('[data-act=mic]').addEventListener('click', e => { e.stopPropagation(); this._toggleVoice(); });
    this.voiceEl.querySelector('.vplay').addEventListener('click', e => { e.stopPropagation(); this._playVoice(); });
    this.voiceEl.addEventListener('pointerdown', e => e.stopPropagation());
    this.el.querySelector('[data-act=dictate]').addEventListener('click', e => { e.stopPropagation(); this._toggleDictation(); });
  }

  _toggleTray(open = this.tray.hidden) {
    this.tray.hidden = !open;
    this.el.querySelector('[data-tool=decor]').setAttribute('aria-expanded', String(open));
    this.el.querySelector('[data-tool=decor]').classList.toggle('on', open);
  }

  _addSticker(type, x, y, pop = false) {
    const s = { type, x, y, rot: Math.round((Math.random() - 0.5) * 30), scale: 0.9 + Math.random() * 0.3 };
    const el = document.createElement('img');
    el.className = 'stk' + (pop ? ' pop' : ''); el.src = stickerURL(type); el.alt = ''; el.draggable = false;
    s.el = el; this._place(s);
    this.deco.appendChild(el); this.stickers.push(s);
    this.audio?.plop(9);
    return s;
  }

  _place(s) {
    s.el.style.left = (s.x * 100) + '%'; s.el.style.top = (s.y * 100) + '%';
    s.el.style.setProperty('--rot', (s.rot || 0) + 'deg'); s.el.style.setProperty('--sc', s.scale || 1);
  }

  _addPhoto(file) {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      this.photo?.el.remove();
      const el = document.createElement('div');
      el.className = 'polaroid pop';
      el.innerHTML = `<span class="clip">${ICONS.clip}</span><img src="${url}" alt="Your photo" draggable="false">`;
      this.photo = { url, img, x: 0.7, y: 0.56, rot: 6, el, type: 'photo' };
      this._place(this.photo);
      this.deco.appendChild(el);
      this.audio?.rustle();
    };
    img.src = url;
  }

  async _toggleVoice() {
    const mic = this.el.querySelector('[data-act=mic]');
    if (this._rec) { this._rec.stop(); return; }
    if (this.voice?.url) { this._deleteVoice(); return; }                // a voice note already: the mic button deletes it
    if (this._sr) this._stopDictation();                                  // one thing on the microphone at a time
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { this._toast('Voice notes need a microphone'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { this._toast('Microphone permission was not given'); return; }
    const AC = window.AudioContext || window.webkitAudioContext, ac = new AC(), an = ac.createAnalyser();
    an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize), peaks = [], chunks = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = e => chunks.push(e.data);
    this.voice = { peaks, url: null, y: 0.66 };
    this.voiceEl.hidden = false; this.voiceEl.classList.add('rec');
    mic.firstElementChild.outerHTML = ICONS.stop; mic.classList.add('on'); mic.setAttribute('aria-label', 'Stop recording');
    let last = 0;
    const tick = now => {
      if (rec.state !== 'recording') return;
      if (now - last > 70) {
        last = now; an.getByteTimeDomainData(buf);
        let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128));
        peaks.push(Math.min(1, m / 60)); if (peaks.length > 90) peaks.shift();
        this._drawVoice();
      }
      requestAnimationFrame(tick);
    };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop()); ac.close();
      this.voice.url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      this.voiceEl.classList.remove('rec');
      mic.firstElementChild.outerHTML = ICONS.mic; mic.classList.remove('on');
      mic.classList.add('has-voice'); mic.setAttribute('aria-label', 'Delete the voice note');
      this._rec = null; this._drawVoice();
    };
    rec.start(); this._rec = rec; requestAnimationFrame(tick);
    setTimeout(() => this._rec === rec && rec.stop(), 20000);       // up to 20 s
  }

  /** Play the voice note again (tap again to pause; it goes back to the start when it ends). */
  _playVoice() {
    if (!this.voice?.url) return;
    const b = this.voiceEl.querySelector('.vplay');
    if (!this._audioEl || this._audioEl._url !== this.voice.url) {
      this._audioEl?.pause();
      const a = new Audio(this.voice.url); a._url = this.voice.url; a.preload = 'auto';
      a.onended = a.onpause = () => { b.innerHTML = ICONS.play; b.setAttribute('aria-label', 'Play the voice note'); this.voiceEl.classList.remove('playing'); };
      a.onplay = () => { b.innerHTML = ICONS.pause; b.setAttribute('aria-label', 'Pause the voice note'); this.voiceEl.classList.add('playing'); };
      this._audioEl = a;
    }
    const a = this._audioEl;
    if (a.paused) { if (a.ended) a.currentTime = 0; a.play().catch(() => this._toast('Could not play the voice note')); } else a.pause();
  }

  /** Delete the voice note (the mic button, once there is one). */
  _deleteVoice() {
    this._audioEl?.pause(); this._audioEl = null;
    if (this.voice?.url) URL.revokeObjectURL(this.voice.url);
    this.voice = null; this.voiceEl.hidden = true; this._audioEl?.pause(); this._audioEl = null; this._stopDictation();
    this.el.querySelector('[data-act=mic]').classList.remove('has-voice'); this.voiceEl.classList.remove('playing');
    const mic = this.el.querySelector('[data-act=mic]');
    mic.classList.remove('has-voice'); mic.setAttribute('aria-label', 'Record a voice note');
    this.audio?.rustle(); this._tick(); this._toast('Voice note deleted');
    this._syncHint();
  }

  // --- speak to write: what you say is written on the letter as you say it -------------
  _toggleDictation() {
    if (this._sr) { this._stopDictation(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this._toast('Speech to text isn\'t available in this browser'); return; }
    if (this._rec) this._rec.stop();                                       // one thing on the microphone at a time
    const b = this.el.querySelector('[data-act=dictate]'), t = this.text, max = +t.maxLength || 400;
    const sr = new SR(); sr.continuous = true; sr.interimResults = true; sr.lang = navigator.language || 'en-US';
    let prefix = '', finals = '';
    const begin = () => {
      const v = t.value; prefix = v + (v && !/\s$/.test(v) ? ' ' : ''); finals = '';
      try { sr.start(); } catch {}
    };
    const cap = (s, after) => (!after.trim() || /[.!?]\s*$/.test(after) ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    sr.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i], said = r[0].transcript;
        if (r.isFinal) finals += said; else interim += said;
      }
      const spoken = (finals + interim).replace(/^\s+/, '');
      const next = (prefix + cap(spoken, prefix)).slice(0, max);
      if (next !== t.value) { t.value = next; this._onInput({ inputType: 'insertText' }); }
    };
    sr.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this._toast('Microphone permission was not given'); this._stopDictation(); }
    };
    sr.onend = () => { if (this._sr === sr && !this._srStopping) begin(); else this._dictationOff(); };   // phones stop after a pause: carry on
    this._sr = sr; this._srStopping = false;
    b.classList.add('on', 'listening'); b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', 'Stop speaking to write');
    this.text.blur(); this._coachOff(); this._toast('Listening… speak and it writes');
    begin();
  }
  _stopDictation() { if (!this._sr) return; this._srStopping = true; try { this._sr.stop(); } catch {} this._dictationOff(); }
  _dictationOff() {
    this._sr = null;
    const b = this.el.querySelector('[data-act=dictate]');
    b.classList.remove('on', 'listening'); b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Speak to write');
  }

  /** The voice note as a wavy ink line across the paper (always a gentle wave, bigger when louder). */
  _drawVoice() {
    const cv = this.voiceEl.querySelector('canvas'), w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (!w) return;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const p = this.voice?.peaks || []; if (p.length < 2) return;
    g.strokeStyle = this.inkCol || '#1f3a8a'; g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i < p.length; i++) { const x = 4 + (w - 8) * i / (p.length - 1), a = (0.18 + p[i] * 0.82) * h * 0.42; g.lineTo(x, h / 2 + Math.sin(i * 0.9) * a); }
    g.stroke();
  }

  _toast(msg) {
    const t = document.createElement('div'); t.className = 'letter-toast'; t.textContent = msg;
    this.el.appendChild(t); setTimeout(() => t.remove(), 2600);
  }

  // --- gestures on the paper: write, doodle, move stickers, swipe, pick up ------------
  _bindPaperGestures() {
    let press = null;
    const box = () => this.el.getBoundingClientRect();
    const toUV = e => { const b = box(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };
    const down = new Set();                                                 // fingers on the paper
    this.el.addEventListener('contextmenu', e => { e.preventDefault(); if (this.seq.mode === 'card') this._openMenu(e.clientX, e.clientY); });
    window.addEventListener('pointerup', e => down.delete(e.pointerId));
    window.addEventListener('pointercancel', e => down.delete(e.pointerId));
    this.el.addEventListener('pointerdown', e => {
      if (e.target.closest('button, .tray, .letter-actions')) return;
      down.add(e.pointerId);
      this._coachOff();
      if (this.pen && down.size > 1) {                                       // a second finger: drawing ends
        if (press?.mode === 'pen') { this.strokes.pop(); this._redrawDoodles(); press = null; }
        this._setPen(false); return;
      }
      if (nearEdge(e)) return;
      const item = e.target.closest('.stk, .polaroid');
      if (item) {                                                           // move a sticker / the photo
        const s = item === this.photo?.el ? this.photo : this.stickers.find(k => k.el === item);
        press = { id: e.pointerId, mode: 'item', s, x: e.clientX, y: e.clientY };
        item.setPointerCapture?.(e.pointerId); e.preventDefault(); e.stopPropagation(); return;
      }
      if (this.pen) {                                                       // doodle in ink
        press = { id: e.pointerId, mode: 'pen', stroke: { pts: [toUV(e)], color: this.inkCol } };
        this.strokes.push(press.stroke); this._redrawDoodles();
        e.preventDefault(); return;
      }
      if (this._shapeable()) { this._startShape(e, true); e.preventDefault(); return; }   // fold / roll it by hand
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, mode: null };
      e.preventDefault();
    });
    window.addEventListener('pointermove', e => {
      if (!press || press.id !== e.pointerId) return;
      if (press.mode === 'item') {
        const [u, v] = toUV(e); press.s.x = u; press.s.y = v; this._place(press.s);
        press.s.el.classList.toggle('leaving', u < -0.05 || u > 1.05 || v < -0.05 || v > 1.05);
        return;
      }
      if (press.mode === 'pen') { press.stroke.pts.push(toUV(e)); this._redrawDoodles(); return; }
      if (press.mode) return;
      const dx = e.clientX - press.x, dy = e.clientY - press.y;
      if (Math.hypot(dx, dy) < slop()) return;
      this.text.blur();
      if (Math.abs(dx) > Math.abs(dy) * 1.15) press.mode = 'swipe';      // sideways: choose someone else
      else { press.mode = 'grab'; this.seq.grab({ pointerId: e.pointerId, clientX: press.x, clientY: press.y }); }   // up / down: pick it up
    });
    window.addEventListener('pointerup', e => {
      if (!press || press.id !== e.pointerId) return;
      const p = press; press = null;
      if (p.mode === 'item') {                                              // dragged off the paper: gone
        const s = p.s;
        if (s.x < -0.05 || s.x > 1.05 || s.y < -0.05 || s.y > 1.05) {
          s.el.remove();
          if (s === this.photo) this.photo = null; else this.stickers = this.stickers.filter(k => k !== s);
        } else { s.x = clamp(s.x, 0.05, 0.95); s.y = clamp(s.y, 0.05, 0.95); this._place(s); }
        return;
      }
      if (p.mode === 'pen') return;
      if (!p.mode) { this.text.focus(); const n = this.text.value.length; this.text.setSelectionRange(n, n); }
      else if (p.mode === 'swipe') {
        const dx = e.clientX - p.x;
        if (Math.abs(dx) > 40) { this.select(this.index + (dx < 0 ? 1 : -1)); this._swipedAt = performance.now(); }
      }
    });
  }

  // --- folding and rolling by hand ----------------------------------------------------
  //   drag down → it folds into a paper plane, fold by fold; keep pulling and let go fast to throw it
  //               (a finished plane can also be flicked up); drag up → it unfolds
  //   drag up   → it rolls up into a bottle, step by step; keep pushing and let go fast to drop it
  //               in the sea; drag down → it unrolls
  //   letting go: a quick pull finishes the shape, a quick pull back undoes it, otherwise the
  //   nearest; past either end it gives a little (rubber band)
  //   holding the finished plane: sideways steers (and picks the friend on that side), up / down
  //   folds or throws, never both in one movement
  //   press and hold the flat letter (or right-click): a menu with buttons for all of it

  /** True when the letter has something on it (words, stickers, a doodle, a photo, a voice note). */
  hasContent() { return !!(this.text.value.trim() || this.stickers.length || this.strokes.length || this.photo || this.voice?.peaks?.length); }

  _shapeable() {
    const m = this.seq.mode;
    return !this.pen && (m === 'shaping' || m === 'card');               // blank or written: the same gestures
  }

  _startShape(e, onPaper) {
    const g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), onPaper, axis: null, side: null,
      s0: this.seq.mode === 'shaping' ? this.seq.shapeS : 0, trail: [{ x: e.clientX, y: e.clientY, t: performance.now() }], anchor: null };
    this._shapeG = g;
    const R = () => Math.max(220, window.innerHeight * 0.42);           // drag distance for a full fold
    const done = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      clearTimeout(g.lp); this._shapeG = null;
      this.seq.setSteer?.(0); this.seq.setStretch?.(0); this._aim(null);
    };
    // press and hold the flat letter (without moving): a menu with buttons for every gesture
    if (onPaper && this.seq.mode === 'card') g.lp = setTimeout(() => { if (!g.axis && this._shapeG === g) { done(); this._openMenu(g.x0, g.y0); } }, 550);
    const move = ev => {
      if (ev.pointerId !== g.id) return;
      const dx = ev.clientX - g.x0, dy = ev.clientY - g.y0, now = performance.now();
      g.trail.push({ x: ev.clientX, y: ev.clientY, t: now }); if (g.trail.length > 12) g.trail.shift();
      if (!g.axis) {
        if (Math.hypot(dx, dy) < slop()) return;
        clearTimeout(g.lp);
        const finished = Math.abs(g.s0) >= 0.97;
        g.axis = finished ? 'y' : Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y';
        if (g.axis === 'y') {
          this.text.blur(); this._toggleTray(false); this._coachOff();
          g.side = g.s0 > 0 ? 'plane' : g.s0 < 0 ? 'bottle' : dy > 0 ? 'plane' : 'bottle';   // down: paper plane · up: bottle
          if (this.seq.mode === 'card') this.seq.beginShape();
          g.step = Math.floor(Math.abs(g.s0) * 8 + 0.001); g.atEnd = finished;
        }
      }
      if (g.axis !== 'y') return;
      const end = g.side === 'plane' ? 1 : -1, raw = g.s0 + dy / R();
      let v = g.side === 'plane' ? clamp(raw, 0, 1) : clamp(raw, -1, 0);
      // the finished plane, held: each movement is either sideways (steer) or up / down (fold, throw), never both
      if (g.side === 'plane' && !g.anchor && v >= 0.99) g.anchor = { x: ev.clientX, y: ev.clientY, lock: null };
      if (g.anchor) {
        const ax = ev.clientX - g.anchor.x, ay = ev.clientY - g.anchor.y;
        if (!g.anchor.lock && Math.hypot(ax, ay) > slop()) g.anchor.lock = Math.abs(ax) > Math.abs(ay) * 1.2 ? 'steer' : 'vert';
        if (g.anchor.lock === 'steer') {
          v = 1; this.seq.setSteer(ax / 90);
          this._aim(Math.abs(ax) > 25 ? this.index + Math.sign(ax) : null);   // light up the friend it's heading for
          if (Math.abs(ax) > 80) {
            const dir = Math.sign(ax), before = this.index;
            this.select(this.index + dir);
            if (this.index !== before) { this.seq.gust(dir); this._windGust(dir); this.seq.paint(this._composition()); this.audio?.rustle(); }
            g.anchor.x = ev.clientX; this._aim(null);
          }
        } else if (v < 0.97) g.anchor = null;                            // unfolding again
      }
      // rubber band: pulling past either end gives a little, with resistance
      const over = g.anchor?.lock === 'steer' ? 0 : (raw - v) * R();
      this.seq.setStretch(Math.sign(over) * 0.22 * Math.tanh(Math.abs(over) / 160));
      this.seq.setShapeS(v);
      const step = Math.floor(Math.abs(v) * 8 + 0.001);                  // each fold step: a tick and its own crease sound
      if (step !== g.step) { g.step = step; this._tick(); this.audio?.crease?.(step); }
      const atEnd = Math.abs(v - end) < 0.01;
      if (atEnd && !g.atEnd) { this._tickStrong(); this.audio?.ready?.(); }   // finished: a firmer snap
      g.atEnd = atEnd;
      this._syncHint();
    };
    const up = ev => {
      if (ev.pointerId !== g.id) return;
      done();
      const dx = ev.clientX - g.x0, now = performance.now();
      if (!g.axis) {                                                      // a tap: write (on the flat letter)
        if (g.onPaper && this.seq.mode === 'card') { this.text.focus(); const n = this.text.value.length; this.text.setSelectionRange(n, n); }
        return;
      }
      if (g.axis === 'x') {                                               // sideways: choose who it's for
        if (Math.abs(dx) > 40) { this.select(this.index + (dx < 0 ? 1 : -1)); this._swipedAt = now; if (this.seq.mode === 'shaping') this.seq.paint(this._composition()); }
        return;
      }
      if (this.seq.mode !== 'shaping') return;
      const end = g.side === 'plane' ? 1 : -1, v = this.seq.shapeS;
      if (g.anchor?.lock === 'steer') { this.seq.snapShape(end); return; }   // steering never throws
      // finger speed over the last ~120 ms (px/s, + = down), and along the shaping direction
      let ri = g.trail.findIndex(q => now - q.t < 120); if (ri < 0) ri = g.trail.length - 1;
      const ref = g.trail[Math.max(0, Math.min(ri, g.trail.length - 2))];   // at least one move back (slow frames)
      const vy = (ev.clientY - ref.y) / Math.max(0.016, (now - ref.t) / 1000), along = vy * end;
      const atEnd = Math.abs(v - end) < 0.02;
      const flickUpPlane = g.side === 'plane' && g.s0 >= 0.97 && vy < -650 && ev.clientY < g.y0 - 25 && now - g.t0 < 600;
      if ((atEnd && along > 650) || flickUpPlane) {                        // keep going and let go fast (or flick a plane up): throw
        this.seq.setShapeS(end); this.seq.throwShape(); this._markLearned();
        return;
      }
      // settle: a quick pull finishes the fold, a quick pull back undoes it, otherwise the nearest
      const target = along > 500 ? end : along < -500 ? 0 : Math.abs(v) > 0.5 ? end : 0;
      if (target === end && !atEnd) { this._tickStrong(); this.audio?.ready?.(); }
      this.seq.snapShape(target);
      setTimeout(() => this._syncHint(), 350);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }

  /** Light up the circle the held plane is heading for (null: none). */
  _aim(i) {
    this.people.forEach((b, k) => b.classList.toggle('aim', i != null && k === i && k !== this.index));
  }

  _tickStrong() { try { if (navigator.vibrate) navigator.vibrate([12, 40, 22]); else { this._haptic?.click(); setTimeout(() => this._haptic?.click(), 70); } } catch {} }

  get learned() { try { return localStorage.getItem('ocean.gesturesLearned') === '1'; } catch { return false; } }
  _markLearned() { try { localStorage.setItem('ocean.gesturesLearned', '1'); } catch {} this._coachOff(); }

  // --- first letter: a finger shows the two gestures ---------------------------------
  _coach() {
    if (this.learned || this._coachEl || this._coached) return;
    this._coached = true;
    const c = document.createElement('div'); c.className = 'coach'; c.setAttribute('aria-hidden', 'true');
    c.innerHTML = '<i class="finger"></i><span class="lbl down">Drag down · paper plane</span><span class="lbl up">Drag up · bottle</span>';
    this.el.appendChild(c); this._coachEl = c;
    this._coachT = setTimeout(() => this._coachOff(), 9800);
  }
  _coachOff() { clearTimeout(this._coachT); this._coachEl?.remove(); this._coachEl = null; }

  // --- press and hold: every gesture as a button -------------------------------------
  _openMenu(x, y) {
    this._closeMenu();
    this.text.blur(); this._tick();
    const m = document.createElement('div'); m.className = 'lmenu'; m.setAttribute('role', 'menu');
    const prev = this.recipients[this.index - 1], next = this.recipients[this.index + 1];
    m.innerHTML = `<button type="button" role="menuitem" data-m="plane">Send as paper plane</button>
      <button type="button" role="menuitem" data-m="bottle">Send in a bottle</button>
      ${prev ? `<button type="button" role="menuitem" data-m="prev">← ${esc(prev.name)}</button>` : ''}
      ${next ? `<button type="button" role="menuitem" data-m="next">${esc(next.name)} →</button>` : ''}`;
    const root = this.row.parentNode; root.appendChild(m);
    const w = 210, h = m.offsetHeight || 170;
    m.style.left = clamp(x - w / 2, 10, window.innerWidth - w - 10) + 'px';
    m.style.top = clamp(y - h - 16, 10, window.innerHeight - h - 10) + 'px';
    m.addEventListener('pointerdown', e => e.stopPropagation());
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      e.stopPropagation(); this._closeMenu();
      const k = b.dataset.m;
      if (k === 'plane' || k === 'bottle') { this._coachOff(); this.seq.send(k); }
      else this.select(this.index + (k === 'next' ? 1 : -1));
    });
    this._menu = m;
    m.querySelector('button')?.focus({ preventScroll: true });
  }
  _closeMenu() { this._menu?.remove(); this._menu = null; }

  // --- after a throw: a few seconds to take it back ------------------------------------
  _offerUnsend() {
    this._unsendEl?.remove();
    const t = document.createElement('div'); t.className = 'unsend';
    t.innerHTML = `<span>Sent to ${esc(this.recipient.name)}</span><button type="button">Unsend</button>`;
    t.addEventListener('pointerdown', e => e.stopPropagation());
    t.querySelector('button').addEventListener('click', e => {
      e.stopPropagation();
      if (this.seq.unsend()) { this._shaped = true; this.audio?.rustle(); this._tick(); }
      t.remove(); this._unsendEl = null;
    });
    this.row.parentNode.appendChild(t); this._unsendEl = t;
    clearTimeout(this._unsendT);
    this._unsendT = setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.remove(); if (this._unsendEl === t) this._unsendEl = null; }, 300); }, 3000);
  }

  /** Wind streaks sweeping across the screen (dir −1 to the left, +1 to the right). */
  _windGust(dir) {
    if (REDUCED) return;
    const w = document.createElement('div');
    w.className = 'gust' + (dir < 0 ? ' left' : '');
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('i');
      s.style.top = (38 + Math.random() * 40).toFixed(1) + '%';
      s.style.width = (18 + Math.random() * 30).toFixed(0) + '%';
      s.style.animationDelay = (Math.random() * 0.22).toFixed(2) + 's';
      s.style.opacity = (0.35 + Math.random() * 0.5).toFixed(2);
      w.appendChild(s);
    }
    this.row.parentNode.appendChild(w);
    setTimeout(() => w.remove(), 1300);
  }

  _redrawDoodles() {
    const cv = this.doodle, w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (!w) return;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    this._strokeAll(g, w, h, 2.4);
  }

  _strokeAll(g, w, h, lw) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of this.strokes) {
      g.strokeStyle = s.color || this.inkCol; g.lineWidth = lw; g.beginPath();
      s.pts.forEach(([u, v], i) => (i ? g.lineTo(u * w, v * h) : g.moveTo(u * w, v * h)));
      if (s.pts.length === 1) { g.lineTo(s.pts[0][0] * w + 0.1, s.pts[0][1] * h); }
      g.stroke();
    }
  }

  // --- sending ------------------------------------------------------------------
  /** Everything on the letter, for painting onto the paper as it is folded or rolled. */
  _composition() {
    const W = this.seq.canvas.width, H = this.seq.canvas.height;
    let doodles = null;
    if (this.strokes.length) { doodles = document.createElement('canvas'); doodles.width = W; doodles.height = H; this._strokeAll(doodles.getContext('2d'), W, H, W * 0.008); }
    return {
      dear: this.dear, text: this.text.value.trim(), sign: this.sign, ink: this.inkCol, doodles,
      stickers: this.stickers.map(({ type, x, y, rot, scale }) => ({ type, x, y, rot, scale })),
      photo: this.photo ? { img: this.photo.img, x: this.photo.x, y: this.photo.y, rot: this.photo.rot } : null,
      voice: this.voice?.peaks?.length ? { peaks: this.voice.peaks, y: this.voice.y } : null,
    };
  }

  _clear() {
    this.text.value = ''; this._last = ''; this._born = []; this._renderInk();
    this.stickers.forEach(s => s.el.remove()); this.stickers = [];
    this.strokes = []; this._redrawDoodles();
    this.photo?.el.remove(); this.photo = null;
    this.voice = null; this.voiceEl.hidden = true;
    this._toggleTray(false);
    if (this.pen) this._setPen(false);
  }

  /** Call when the sequence changes mode. */
  onMode(mode) {
    const writing = mode === 'card' || mode === 'held';
    const rowOn = writing || mode === 'shaping' || mode === 'fold' || mode === 'plane' || mode === 'bottle';
    if (mode !== 'card' && mode !== 'held') { this._stopDictation(); this._audioEl?.pause(); }   // leaving the letter: stop listening / playing
    if (mode === 'shaping') {                                    // folding / rolling by hand: the letter goes onto the paper
      this.text.blur(); this._toggleTray(false);
      this.seq.paint(this._composition()); this._shaped = true;
      this.audio?.rustle();
    }
    if (mode === 'card' && this._shaped) { this._shaped = false; this.seq.paint(); }   // unfolded again: back to writing on it
    if (writing && this.visible && this.el.hidden) { this.el.hidden = false; requestAnimationFrame(() => this._redrawDoodles()); }
    if (writing && !this.visible) {
      this.visible = true;
      this.el.hidden = false; this.row.hidden = false;
      document.body.classList.add('writing');
      this._applyLook(true);
      this._writeDear(); this._writeSign(); this._typePrompts();
      this._actsTouched = false;
      requestAnimationFrame(() => { this._layoutRow(); this._redrawDoodles(); this._centreActions(); });
      setTimeout(() => this._centreActions(), 300);
      setTimeout(() => { if (this.seq.mode === 'card') this._coach(); }, 1600);   // the very first letter: show the gestures
      this.circles.open();
    }
    if (mode === 'fold') { this.text.blur(); this._toggleTray(false); this.seq.paint(this._composition()); this._shaped = true; }
    if (mode === 'plane' || mode === 'bottle') { this._closeMenu(); this._coachOff(); this._offerUnsend(); }   // thrown: a moment to take it back   // everything on the letter goes onto the paper as it folds
    if (!writing && this.el && !this.el.hidden) { this.el.hidden = true; this.text.blur(); }
    if (!rowOn && this.visible) {
      this.visible = false;
      this.row.hidden = true;
      document.body.classList.remove('writing');
      this.circles.close();
    }
    if (mode === 'idle') { this._clear(); this.select(0); }
    this._syncHint();
  }

  /** The letter arrived: the chosen contact's circle catches it with a splash. */
  caught(kind) { this.circles.catch(this.index, kind); }

  /** Screen point of the chosen contact's circle (where the paper plane flies). */
  targetPoint() {
    const r = this.people[this.index]?.querySelector('.port')?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }

  /** Every frame: keep the overlay glued to the paper, animate the circles. */
  update(dt = 0.016) {
    if (!this.visible) return;
    this.water.draw();
    this.circles.update(dt);
    if (this.el.hidden) return;
    const r = this.seq.screenRect(), s = this.el.style;
    s.left = r.x + 'px'; s.top = r.y + 'px'; s.width = r.w + 'px'; s.height = r.h + 'px';
    s.setProperty('--u', (r.w / 100) + 'px');
    if (Math.abs((this._dw || 0) - r.w) > 2) { this._dw = r.w; this._redrawDoodles(); if (this.voice) this._drawVoice(); this._centreActions(); }
    const vh = window.innerHeight;
    this.hint.style.top = Math.min(r.y + r.h + 12, vh - (this.hint.offsetHeight || 22) - 10) + 'px';
  }
}
