// Chats: the list of people and groups you write to, a group maker, an "add a friend" page with
// your invite code (QR + six characters), a camera scanner for theirs, and a simple thread view.
// Opened from the round chat button at the bottom right of the ocean.
//   - Chats: "In the air" (groups, and friends with letters flying to you), then each chat with its
//     last letter / message and how long ago; requests you sent wait in a dashed card until accepted
//   - Groups → New group: name it, pick who's in, create
//   - + (top right) → Add a friend: share / copy your code, type theirs, or scan it
//   - a chat → its thread: letters and messages; "Write a letter" opens the letter on the ocean
// There is no server yet: friends are the demo people, and groups, requests and messages are
// kept on this device (localStorage).
import QRCode from 'qrcode';
import { ME } from './people.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'ocean.chats', CODE_KEY = 'ocean.inviteCode';
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';           // no 0/O, 1/I/L: easy to read aloud
const DAY = 86400000;

const IC = {
  plane: '<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M30 2L13 9.5l5 2.6L30 2zm0 0l-9.6 13.5-2.4-3.4" fill="currentColor"/><path d="M2 20c3-1 5-2 7-3.5M7 21c2-.6 3.5-1.3 5-2.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.5 3.5"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5a7.5 7 0 0 1 15 0 7.5 7 0 0 1-10.6 6.4L4 19.5l1.4-3.7A6.8 6.8 0 0 1 4 11.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8.6 11.5h.01M11.5 11.5h.01M14.4 11.5h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  newChat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.5a8 7.5 0 0 1 16 0 8 7.5 0 0 1-11.3 6.8L3.5 20l1.5-3.9a7.3 7.3 0 0 1-1.5-4.6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M11.5 8v7M8 11.5h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  group: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.5" r="3.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 19a6 6 0 0 1 12 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 14.2A6 6 0 0 1 21 19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 13v6h14v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 5.5V5a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 5v8A1.5 1.5 0 0 0 6 14.5h.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  scan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5M4 12h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wave: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14c2.2-2.4 4.4-2.4 6.6 0s4.4 2.4 6.6 0 3.3-2 4.8-1.2M3 9.5c2.2-2.4 4.4-2.4 6.6 0s4.4 2.4 6.6 0 3.3-2 4.8-1.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

/** "17d", "3h", "now" */
function ago(t) {
  const d = Date.now() - t;
  if (d < 60000) return 'now';
  if (d < 3600000) return Math.floor(d / 60000) + 'm';
  if (d < DAY) return Math.floor(d / 3600000) + 'h';
  if (d < 7 * DAY * 52) return Math.floor(d / DAY) + 'd';
  return Math.floor(d / (DAY * 365)) + 'y';
}

function avatar(p, size = '') {
  const inner = p.photo ? `<img src="${esc(p.photo)}" alt="" draggable="false">` : esc(p.initials || p.name.slice(0, 2).toUpperCase());
  return `<span class="c-av ${size}" style="--av:${esc(p.color || '#cfd6c0')}">${inner}</span>`;
}

export class Chats {
  /**
   * root: the app element; friends: the demo people; onWrite(id): write a letter to that friend
   * on the ocean; onOpenChange(open): the chats screen opened / closed.
   */
  constructor({ root, friends, onWrite, onOpenChange, onRead }) {
    this.friends = friends; this.onWrite = onWrite; this.onOpenChange = onOpenChange; this.onRead = onRead;
    this.data = this._load();
    this.code = this._myCode();

    // the chat button, bottom right of the ocean: a glass bubble floating over the sea (all CSS
    // animation): it wobbles and drifts, its shine glides, a rainbow sheen sweeps across now and then,
    // three dots pulse inside and tiny bubbles rise from it; a new letter sends up a burst; a tap pops it
    this.btn = document.createElement('button');
    this.btn.type = 'button'; this.btn.className = 'chats-btn';
    this.btn.setAttribute('aria-label', 'Chats');
    this.btn.innerHTML = `
      <span class="gb-float"><span class="gb-body">
        <span class="gb-glass"></span><span class="gb-sheen"></span>
        <span class="gb-shine"><i class="gb-hl"></i><i class="gb-hl2"></i></span>
        <span class="gb-dots"><i></i><i></i><i></i></span>
      </span></span>
      <span class="gb-rise" aria-hidden="true"></span><span class="badge" hidden></span>`;
    this.btn.addEventListener('click', e => { e.stopPropagation(); this._popOpen(); });
    root.appendChild(this.btn);
    this.rise = this.btn.querySelector('.gb-rise');
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.saver = false; this._riseIn = 1; this._unreadAt = 0; this._unread = null;

    this.el = document.createElement('section');
    this.el.className = 'chats'; this.el.hidden = true;
    this.el.setAttribute('role', 'dialog'); this.el.setAttribute('aria-label', 'Chats');
    root.appendChild(this.el); this.el._owner = this;
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchstart']) this.el.addEventListener(t, e => e.stopPropagation(), { passive: true });
    this.el.addEventListener('click', e => this._click(e));
    this._bindSheetDrag();
    window.addEventListener('resize', () => { if (this.isOpen && this._bubs) this._layoutBubbles(); });
    this.el.addEventListener('keydown', e => { if (e.key === 'Escape') this.back(); });
    this.stack = [];
    this._badge();
  }

  get isOpen() { return !this.el.hidden; }

  /** Night: the rim, shine and rising bubbles glow softly in the sea's foam colour. */
  setColors(hi, mid, deep, foam, light) {
    this.btn.classList.toggle('night', light < 0.45);
    this.btn.style.setProperty('--gb-glow', `rgb(${foam.join(',')})`);
  }

  /** Battery saver: only the drift and an occasional rising bubble keep going. */
  setSaver(on) { this.saver = on; this.btn.classList.toggle('saver', on); }

  /** Every frame from the app: tiny bubbles rise now and then; a new letter sends up a burst. */
  update(dt) {
    if (this.isOpen) { if (this._bubs && !this.reduce && !this.saver && this.stack.at(-1)?.page === 'list') { this._bubStep(Math.min(dt, 0.05)); this._bubPlace(); } return; }
    if (this.btn.hidden || this.reduce) return;
    if ((this._unreadAt -= dt) <= 0) {
      this._unreadAt = 0.5;
      const n = this.friends.reduce((s, f) => s + (f.unread || 0), 0);
      if (this._unread != null && n > this._unread) this._newLetter();
      if (n !== this._unread) { this._unread = n; this._badge(); }
    }
    if ((this._riseIn -= dt) <= 0) {                        // more often while letters are waiting
      this._riseIn = (this.saver ? 3.2 : this._unread ? 1.1 : 2.1) * (0.7 + Math.random() * 0.6);
      this._riseOne();
    }
  }

  _riseOne(delay = 0) {
    const b = document.createElement('i'), s = 3 + Math.random() * 4;
    b.style.cssText = `--s:${s.toFixed(1)}px;--x:${(Math.random() * 14 - 4).toFixed(1)}px;--sway:${(Math.random() * 10 - 5).toFixed(1)}px;--t:${(1.9 + Math.random() * 0.9).toFixed(2)}s;animation-delay:${delay}s`;
    this.rise.appendChild(b); setTimeout(() => b.remove(), (3 + delay) * 1000);
  }

  /** A new letter: a burst of bubbles, a bigger wobble, the count pops. */
  _newLetter() {
    for (let k = 0; k < 4; k++) this._riseOne(k * 0.12);
    const body = this.btn.querySelector('.gb-body'); body.classList.remove('boing'); void body.offsetWidth; body.classList.add('boing');
    const b = this.btn.querySelector('.badge'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }

  /** Tap: the bubble pops in a ring of droplets and the chats open from there. */
  _popOpen() {
    if (this.reduce) { this.open(); this.el.classList.add('fade-in'); setTimeout(() => this.el.classList.remove('fade-in'), 300); return; }
    if (this.btn.classList.contains('popping')) return;
    this.btn.classList.add('popping');
    for (let k = 0; k < 10; k++) {
      const d = document.createElement('i'), a = k / 10 * Math.PI * 2; d.className = 'gb-drop';
      d.style.setProperty('--dx', (Math.cos(a) * 34).toFixed(1) + 'px'); d.style.setProperty('--dy', (Math.sin(a) * 34).toFixed(1) + 'px');
      this.btn.appendChild(d); setTimeout(() => d.remove(), 600);
    }
    try { navigator.vibrate?.(8); } catch {}
    const r = this.btn.getBoundingClientRect();
    this.el.style.setProperty('--ox', (r.left + r.width / 2) + 'px'); this.el.style.setProperty('--oy', (r.top + r.height / 2) + 'px');
    setTimeout(() => { this.btn.classList.remove('popping'); this.open(); this.el.classList.add('from-bubble'); setTimeout(() => this.el.classList.remove('from-bubble'), 420); }, 190);   // the page grows out of the bubble
  }


  open(page = 'list', arg) {
    this.el.hidden = false; this.btn.hidden = true;
    document.body.classList.add('chats-open');
    this.stack = []; this.sheetFull = false;
    this.go(page, arg, true);
    this.onOpenChange?.(true);
  }

  close() {
    this._stopScan();
    this.el.hidden = true; this.btn.hidden = false;
    if (!this.reduce) { const body = this.btn.querySelector('.gb-body'); body.classList.remove('reform'); void body.offsetWidth; body.classList.add('reform'); }   // a fresh bubble forms
    document.body.classList.remove('chats-open');
    this.stack = [];
    this.onOpenChange?.(false);
  }

  /** Show a page (list, group, add, thread, scan) on top of the current one. */
  go(page, arg, replace = false) {
    if (replace) this.stack = [];
    if (page === 'thread') this._markRead(arg);
    this.stack.push({ page, arg });
    this._render(true);
  }

  /** Opening a chat reads its letters: the count goes, and its bubble will be small. */
  _markRead(id) {
    const f = this.friends.find(x => x.id === id);
    if (f?.unread) { f.unread = 0; this._unread = null; this._badge(); this.onRead?.(id); }
  }

  back() {
    const cur = this.stack.at(-1), prev = this.stack.at(-2);
    // a chat opened from its bubble shrinks back into that spot and turns into its (now small) bubble again
    if (cur?.page === 'thread' && prev?.page === 'list' && this._origin?.id === cur.arg && !this.reduce) { this._shrinkBack(); return; }
    if (this.stack.at(-1)?.page === 'scan') this._stopScan();
    if (this.stack.length <= 1) { this.close(); return; }
    this.stack.pop();
    this._render(false);
  }

  /** Drag the sheet by its handle (or the list's title bar): up for the full height, down to close. */
  _bindSheetDrag() {
    let d = null;
    this.el.addEventListener('pointerdown', e => {
      const h = e.target.closest('.c-grab, .c-thead'); if (!h || e.target.closest('button')) return;
      const sh = this.el.querySelector('.c-sheet'); if (!sh) return;
      d = { id: e.pointerId, y: e.clientY, sh, h: sh.getBoundingClientRect().height };
      sh.style.transition = 'none';
    });
    window.addEventListener('pointermove', e => {                     // (capture: the chats layer stops moves from bubbling)
      if (!d || e.pointerId !== d.id) return;
      const dy = e.clientY - d.y;
      d.sh.style.transform = `translateY(${dy > 0 ? dy : dy * 0.35}px)`;   // upward pull gives a little resistance
    }, true);
    const up = e => {
      if (!d || e.pointerId !== d.id) return;
      const dy = e.clientY - d.y, sh = d.sh; d = null;
      sh.style.transition = ''; sh.style.transform = '';
      if (dy > 60) this.back();                                        // a thread: drag it down to go back
    };
    window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
  }

  /** Someone opened the app through your friend's invite link (…/?invite=CODE). */
  receiveInvite(code) {
    code = this._clean(code);
    if (code.length !== 6) return;
    this.open('add');
    this._submitCode(code);
  }

  // --- data -----------------------------------------------------------------------------
  _load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
    d = d && typeof d === 'object' ? d : {};
    d.groups ||= []; d.messages ||= {};
    // a demo request waiting for an answer, so the dashed card has something to show
    d.requests ||= [{ name: 'Maya', code: 'MYA4K2', at: Date.now() - 2 * DAY }];
    return d;
  }
  _save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch {} this._badge(); }

  _myCode() {
    let c = null;
    try { c = localStorage.getItem(CODE_KEY); } catch {}
    if (!c || c.length !== 6) {
      const r = crypto.getRandomValues(new Uint8Array(6));
      c = [...r].map(v => ALPHA[v % ALPHA.length]).join('');
      try { localStorage.setItem(CODE_KEY, c); } catch {}
    }
    return c;
  }
  _clean(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }
  get inviteUrl() { return `${location.origin}${location.pathname}?invite=${this.code}`; }

  _badge() {
    const n = this.friends.reduce((s, f) => s + (f.unread || 0), 0);
    const b = this.btn.querySelector('.badge');
    b.hidden = !n; b.textContent = n > 99 ? '99+' : n;
  }

  /** All chats, newest first: friends and groups with their last line. */
  _chats() {
    const rows = this.friends.map(f => {
      const msgs = this.data.messages[f.id] || [], last = msgs.at(-1);
      const at = last ? last.at : Date.now() - (f.lastWrote || 1) * DAY;
      const line = last ? (last.from === 'me' ? 'You: ' : '') + last.text
        : f.unread ? `Sent you ${f.unread > 1 ? f.unread + ' letters' : 'a letter'} ✈` : 'You threw a letter ✈';
      return { id: f.id, kind: 'friend', who: [f], name: f.name, line, at, unread: !last && f.unread };
    });
    for (const g of this.data.groups) {
      const msgs = this.data.messages[g.id] || [], last = msgs.at(-1);
      const who = g.members.map(id => this.friends.find(f => f.id === id)).filter(Boolean);
      rows.push({ id: g.id, kind: 'group', who, name: g.name, at: last ? last.at : g.at,
        line: last ? (last.from === 'me' ? 'You: ' : '') + last.text : `Group created · ${who.length + 1} people` });
    }
    return rows.sort((a, b) => b.at - a.at);
  }

  // --- pages ----------------------------------------------------------------------------
  /** forward: true slides in from the right, false from the left, null redraws in place. */
  _render(forward) {
    const { page, arg } = this.stack.at(-1);
    let html = { list: () => this._list(), all: () => this._all(), group: () => this._group(), add: () => this._add(), thread: () => this._thread(arg), scan: () => this._scan() }[page]();
    const anim = forward == null ? '' : forward ? 'in-fwd' : 'in-back';
    // the list and the threads sit in a frosted glass sheet over the live ocean (tap the sea above it,
    // or drag the handle down, to close; drag it up for the full height); the rest are full pages
    const sheet = page === 'thread';
    this.el.className = 'chats page-' + page + (sheet ? ' sheet-mode' : '');
    this.el.innerHTML = sheet
      ? `<div class="c-sky" data-act="back" aria-hidden="true"></div>
         <div class="c-sheet full${forward === true && !this._noRise ? ' rise' : ''}">
           <div class="c-grab" aria-hidden="true"><i></i></div><div class="c-page ${anim}">${html}</div></div>`
      : `<div class="c-page ${anim}">${html}</div>`;
    if (page === 'add') this._drawQR();
    if (page === 'list') requestAnimationFrame(() => this._layoutBubbles()); else this._bubs = null;
    if (page === 'scan') this._startScan();
    if (page === 'thread') { const m = this.el.querySelector('.c-msgs'); if (m) m.scrollTop = m.scrollHeight; }
  }

  /** The bubbles screen: every chat a glass bubble drifting on the sea (bigger = more waiting),
   *  plus two bubbles for "New group" and "Add friend"; "All chats" opens the full list. */
  _list() {
    const chats = this._chats();
    const wander = () => `--wd:${(5 + Math.random() * 3).toFixed(2)}s;--wx:${(Math.random() * 10 - 5).toFixed(1)}px;--wy:${(4 + Math.random() * 4).toFixed(1)}px;--wdl:${(-Math.random() * 6).toFixed(2)}s`;
    const bub = c => {
      const n = c.unread || 0, r = Math.round(Math.min(66, c.kind === 'group' ? 38 : 30 + 9 * Math.sqrt(n)));
      const inner = c.kind === 'group' ? `<span class="c-bgroup">${IC.group}</span>` : avatar(c.who[0]);
      return `<button type="button" class="c-bub${n ? ' waiting' : ''}" data-chat="${c.id}" data-r="${r}" style="--r:${r}px;${wander()}" aria-label="${esc(c.name)}${n ? `, ${n} waiting` : ''}">
        <span class="c-wander"><span class="c-bglass">${inner}</span>${n ? `<span class="c-dot">${n > 99 ? '99+' : n}</span>` : ''}
        <span class="c-blabel">${esc(c.name)}<small>${ago(c.at)}</small></span></span></button>`;
    };
    const act = (a, icon, label) => `<button type="button" class="c-bub action" data-act="${a}" data-r="30" style="--r:30px;${wander()}" aria-label="${label}">
        <span class="c-wander"><span class="c-bglass"><span class="c-bgroup">${icon}</span></span><span class="c-blabel">${label}</span></span></button>`;
    return `
      <div class="c-sea">
        <button type="button" class="c-round c-close" data-act="dismiss" aria-label="Close chats">${IC.close}</button>
        <div class="c-btitle"><b>Chats</b><small>Bigger bubbles have more waiting</small></div>
        <div class="c-bfield">${chats.map(bub).join('')}${act('group', IC.group, 'New group')}${act('add', IC.newChat, 'Add friend')}</div>
        <button type="button" class="c-allbtn" data-act="all">${IC.chat}<span>All chats</span><i>${chats.length}</i></button>
      </div>`;
  }

  /** All chats: the full list on a solid cream page. */
  _all() {
    const req = this.data.requests, chats = this._chats();
    return `
      <header class="c-top">
        <button type="button" class="c-round dark" data-act="back" aria-label="Back">${IC.back}</button>
        <h1>All chats</h1>
        <button type="button" class="c-new" data-act="add" aria-label="Add a friend">${IC.newChat}</button>
      </header>
      <div class="c-scroll">
        <div class="c-list">
          ${chats.map((c, i) => `
            <button type="button" class="c-row" data-chat="${c.id}" style="--i:${i}">
              ${c.kind === 'group' ? `<span class="c-stack">${c.who.slice(0, 2).map(p => avatar(p, 'sm')).join('')}</span>` : avatar(c.who[0])}
              <span class="c-mid"><span class="c-name">${esc(c.name)}</span><span class="c-line${c.unread ? ' new' : ''}">${esc(c.line)}</span></span>
              <span class="c-end"><span class="c-when">${ago(c.at)}</span>${c.unread ? `<span class="c-dot">${c.unread > 99 ? '99+' : c.unread}</span>` : ''}</span>
            </button>`).join('')}
          ${req.map(r => `
            <div class="c-row pending"><span class="c-av c-lock">${IC.lock}</span>
              <span class="c-mid"><span class="c-line"><b>${esc(r.name)}</b> — chat opens when they accept your request.</span></span></div>`).join('')}
        </div>
      </div>`;
  }

  // --- the bubbles drift slowly, nudging each other, inside the sea above the panel -----------
  _layoutBubbles() {
    const field = this.el.querySelector('.c-bfield'); if (!field) { this._bubs = null; return; }
    const W = field.clientWidth, H = field.clientHeight;
    const els = [...field.querySelectorAll('.c-bub')];
    // biggest first, spread out on a loose spiral, then relaxed so none overlap
    const items = els.map(el => ({ el, r: +el.dataset.r })).sort((a, b) => b.r - a.r);
    items.forEach((b, k) => {
      const a = k * 2.4, d = 26 * Math.sqrt(k) + (k ? 30 : 0);
      b.x = W / 2 + Math.cos(a) * d * 1.25; b.y = H * 0.46 + Math.sin(a) * d;
      const sp = 5 + Math.random() * 5, th = Math.random() * Math.PI * 2;
      b.vx = Math.cos(th) * sp; b.vy = Math.sin(th) * sp; b.ph = Math.random() * 10;
    });
    const F = this._focus; this._focus = null;
    const fb = F && items.find(b => b.el.dataset.chat === F.id);
    if (fb) {
      const fr = field.getBoundingClientRect();
      fb.x = F.x - fr.left; fb.y = F.y - fr.top; fb.pinned = true;
    }
    this._bubs = { items, W, H };
    for (let k = 0; k < 120; k++) this._bubStep(0, true);
    if (fb) { fb.pinned = false; fb.el.classList.add('reform'); setTimeout(() => fb.el.classList.remove('reform'), 700); }
    this._bubPlace();
  }

  _bubStep(dt, relax = false) {
    const B = this._bubs; if (!B) return;
    const { items, W, H } = B, pad = 6, labelH = 30;
    for (const b of items) {
      if (!relax) {
        b.ph += dt;
        b.vx += Math.sin(b.ph * 0.7) * 2.4 * dt; b.vy += Math.cos(b.ph * 0.53) * 2.4 * dt;   // a slow wandering current
        const sp = Math.hypot(b.vx, b.vy), max = 11;
        if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
        b.x += b.vx * dt; b.y += b.vy * dt;
      }
      // soft walls (leave room for the name under each bubble)
      if (b.x < b.r + pad) { b.x = b.r + pad; b.vx = Math.abs(b.vx); }
      if (b.x > W - b.r - pad) { b.x = W - b.r - pad; b.vx = -Math.abs(b.vx); }
      if (b.y < b.r + pad) { b.y = b.r + pad; b.vy = Math.abs(b.vy); }
      if (b.y > H - b.r - labelH) { b.y = H - b.r - labelH; b.vy = -Math.abs(b.vy); }
    }
    // they nudge each other apart, gently swapping a little of their drift
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j], dx = b.x - a.x, dy = (b.y - a.y) * 0.8, d = Math.hypot(dx, dy) || 0.01, min = a.r + b.r + 40;   // each bubble and its name below count as one tall shape
      if (d < min) {
        const nx = dx / d, ny = dy / d, wa = a.pinned ? 0 : b.pinned ? 2 : 1, wb = b.pinned ? 0 : a.pinned ? 2 : 1, push = (min - d) / 2;
        a.x -= nx * push * wa; a.y -= ny * push * wa; b.x += nx * push * wb; b.y += ny * push * wb;   // a pinned bubble stays put
        if (!relax) { const k = 0.5; a.vx -= nx * k * 6; a.vy -= ny * k * 6; b.vx += nx * k * 6; b.vy += ny * k * 6; }
      }
    }
  }

  _bubPlace() {
    for (const b of this._bubs?.items || []) b.el.style.transform = `translate(${(b.x - b.r).toFixed(1)}px, ${(b.y - b.r).toFixed(1)}px)`;
  }

  _group() {
    return `
      <div class="c-scroll pad">
        <h1 class="c-title">New group</h1>
        <p class="c-sub">Name it, then pick who's in.</p>
        <label class="c-label" for="c-gname">Group name</label>
        <input id="c-gname" class="c-input" type="text" maxlength="40" placeholder="e.g. Weekend trip" autocomplete="off">
        <p class="c-label">Members to add</p>
        <div class="c-pick">
          ${this.friends.map(f => `<label class="c-row pick">${avatar(f)}<span class="c-mid"><span class="c-name">${esc(f.name)}</span></span><input type="checkbox" value="${f.id}"><span class="c-radio">${IC.check}</span></label>`).join('')}
        </div>
        <button type="button" class="c-primary" data-act="create" disabled>Create group</button>
      </div>
      <button type="button" class="c-fab-back" data-act="back" aria-label="Back">${IC.back}</button>`;
  }

  _add() {
    const c = this.code;
    return `
      <div class="c-scroll pad add">
        <div class="c-bar"><button type="button" class="c-round" data-act="back" aria-label="Back">${IC.back}</button>
          <button type="button" class="c-pill" data-act="share">${IC.share}<span>Share</span></button></div>
        <h1 class="c-title">Add a friend</h1>
        <p class="c-sub">Let them scan your code, or type in the six characters they send you.</p>
        <div class="c-card">
          <span class="c-tag">Scan me</span>
          <div class="c-qr"><canvas width="240" height="240" aria-label="Your invite QR code"></canvas><span class="c-qr-logo">${IC.wave}</span><i class="c-qr-sweep"></i></div>
          <p class="c-card-label">Your invite code</p>
          <p class="c-mycode"><span>${c.slice(0, 3)}</span><i>·</i><span>${c.slice(3)}</span>
            <button type="button" class="c-copy" data-act="copy" aria-label="Copy your code">${IC.copy}</button></p>
        </div>
        <div class="c-or"><span>or add theirs</span></div>
        <div class="c-code" role="group" aria-label="Their six-character code">
          ${Array.from({ length: 6 }, (_, i) => `<input inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="1" aria-label="Character ${i + 1}" data-i="${i}">`).join('')}
        </div>
        <p class="c-codehint" aria-live="polite">Type the six characters your friend sent you.</p>
        <div class="c-grow"></div>
        <button type="button" class="c-primary lime" data-act="scan">${IC.scan}<span>Scan their code</span></button>
        <button type="button" class="c-link" data-act="home">Go to my space →</button>
      </div>`;
  }

  _thread(id) {
    const f = this.friends.find(x => x.id === id), g = this.data.groups.find(x => x.id === id);
    const who = f ? [f] : (g?.members || []).map(m => this.friends.find(x => x.id === m)).filter(Boolean);
    const name = f ? f.name : g?.name || 'Chat';
    const sub = f ? (f.city || '') + (f.online ? ' · on the ocean now' : '') : `You, ${who.map(p => p.name).join(', ')}`;
    const msgs = this.data.messages[id] || [];
    // a friend's thread starts with the letters you've swapped (demo)
    const letters = f ? [
      ...(f.lastLetter ? [{ from: f.id, letter: true, text: f.lastLetter, at: Date.now() - (f.lastWrote || 1) * DAY - 3 * 3600000 }] : []),
      { from: 'me', letter: true, text: 'A letter on the waves', at: Date.now() - (f.lastWrote || 1) * DAY },
    ] : [{ sys: true, text: `${esc(name)} was created`, at: g?.at || Date.now() }];
    const all = [...letters, ...msgs].sort((a, b) => a.at - b.at);
    const person = id2 => this.friends.find(x => x.id === id2);
    return `
      <header class="c-thead">
        <button type="button" class="c-round" data-act="back" aria-label="Back">${IC.back}</button>
        ${f ? avatar(f) : `<span class="c-stack">${who.slice(0, 2).map(p => avatar(p, 'sm')).join('')}</span>`}
        <span class="c-mid"><span class="c-name">${esc(name)}</span><span class="c-line">${esc(sub)}</span></span>
      </header>
      <div class="c-msgs">
        ${all.map(m => m.sys ? `<p class="c-sys">${m.text}</p>`
          : `<div class="c-msg ${m.from === 'me' ? 'me' : 'them'}${m.letter ? ' is-letter' : ''}">
              ${!f && m.from !== 'me' ? `<span class="c-from">${esc(person(m.from)?.name || '')}</span>` : ''}
              ${m.letter ? `<span class="c-letter-tag">✈ ${m.from === 'me' ? 'You threw a letter' : 'Sent you a letter'}</span>` : ''}
              <span class="c-text">${esc(m.text)}</span><span class="c-at">${ago(m.at)}</span></div>`).join('')}
      </div>
      <form class="c-compose" data-thread="${esc(id)}">
        ${f ? `<button type="button" class="c-pill is-letter" data-act="write" data-id="${f.id}">✈ Letter</button>` : ''}
        <input class="c-input" name="t" type="text" maxlength="500" placeholder="Message${f ? '' : ' the group'}…" autocomplete="off" aria-label="Message">
        <button type="submit" class="c-send" aria-label="Send">${IC.send}</button>
      </form>`;
  }

  _scan() {
    return `
      <div class="c-scan">
        <video playsinline muted></video><canvas hidden></canvas>
        <div class="c-scan-frame"><i></i></div>
        <p class="c-scan-msg" aria-live="polite">Point the camera at your friend's code</p>
        <button type="button" class="c-round light" data-act="back" aria-label="Close the scanner">${IC.close}</button>
      </div>`;
  }

  // --- interaction ----------------------------------------------------------------------
  _click(e) {
    const a = e.target.closest('[data-act]'), chat = e.target.closest('[data-chat]'), bub = e.target.closest('.c-bub');
    if (bub) {                                                          // a bubble bursts, and its screen grows out of it
      const page = chat ? 'thread' : bub.dataset.act;
      this._burst(bub, () => this.go(page, chat?.dataset.chat));
      return;
    }
    if (chat) { this.go('thread', chat.dataset.chat); return; }
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'dismiss') this.close();
    else if (act === 'back') this.back();
    else if (act === 'home') this.close();
    else if (act === 'add') this.go('add');
    else if (act === 'all') this.go('all');
    else if (act === 'group') this.go('group');
    else if (act === 'scan') this.go('scan');
    else if (act === 'copy') this._copy();
    else if (act === 'share') this._share();
    else if (act === 'create') this._createGroup();
    else if (act === 'write') { const id = a.dataset.id; this.close(); this.onWrite?.(id); }
  }

  _shrinkBack() {
    if (this._shrinking) return;
    const sh = this.el.querySelector('.c-sheet'), o = this._origin;
    if (!sh) { this.stack.pop(); this._render(false); return; }
    this._shrinking = true;
    const r = sh.getBoundingClientRect();
    sh.style.transformOrigin = `${o.cx - r.left}px ${o.cy - r.top}px`;
    sh.classList.remove('grow', 'rise'); sh.classList.add('shrink');
    this.el.querySelector('.c-sky')?.classList.add('fade');
    setTimeout(() => {
      this._shrinking = false;
      this.stack.pop();
      this._focus = { id: o.id, x: o.cx, y: o.cy };                    // its bubble re-forms where the chat went
      this._render(null);
    }, 360);
  }

  /** Pop a bubble: it swells and bursts into droplets, then the next screen grows from that spot. */
  _burst(bub, then) {
    if (this._bursting) return;
    const r = bub.querySelector('.c-bglass').getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    this._origin = bub.dataset.chat ? { id: bub.dataset.chat, cx, cy } : null;
    if (this.reduce) { then(); return; }
    this._bursting = true;
    bub.classList.add('burst');
    for (let k = 0; k < 12; k++) {
      const d = document.createElement('i'), a = k / 12 * Math.PI * 2, dist = r.width * 0.55 + 18;
      d.className = 'c-drop'; d.style.left = cx + 'px'; d.style.top = cy + 'px';
      d.style.setProperty('--dx', (Math.cos(a) * dist).toFixed(1) + 'px'); d.style.setProperty('--dy', (Math.sin(a) * dist).toFixed(1) + 'px');
      this.el.appendChild(d); setTimeout(() => d.remove(), 600);
    }
    try { navigator.vibrate?.(8); } catch {}
    setTimeout(() => {
      this._bursting = false;
      this._noRise = true; then(); this._noRise = false;
      const sh = this.el.querySelector('.c-sheet');
      if (sh) {                                                         // a chat: the glass sheet grows out of the bubble
        const b = sh.getBoundingClientRect();
        sh.style.transformOrigin = `${cx - b.left}px ${cy - b.top}px`;
        sh.classList.add('grow'); setTimeout(() => sh.classList.remove('grow'), 460);
      } else {                                                          // New group / Add friend: the page opens out of it
        this.el.style.setProperty('--ox', cx + 'px'); this.el.style.setProperty('--oy', cy + 'px');
        this.el.classList.add('from-bubble'); setTimeout(() => this.el.classList.remove('from-bubble'), 420);
      }
    }, 200);
  }

  _toast(msg) {
    this.el.querySelector('.c-toast')?.remove();
    const t = document.createElement('div'); t.className = 'c-toast'; t.textContent = msg;
    this.el.appendChild(t); setTimeout(() => t.remove(), 2200);
  }

  async _copy() {
    try { await navigator.clipboard.writeText(this.code); this._toast('Code copied'); }
    catch { this._toast(`Your code: ${this.code}`); }
  }

  async _share() {
    const text = `Add me on Ocean — my code is ${this.code.slice(0, 3)}·${this.code.slice(3)}`;
    if (navigator.share) { try { await navigator.share({ title: 'Ocean', text, url: this.inviteUrl }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(`${text}\n${this.inviteUrl}`); this._toast('Invite link copied'); } catch { this._toast(this.inviteUrl); }
  }

  async _drawQR() {
    const cv = this.el.querySelector('.c-qr canvas'); if (!cv) return;
    const qr = QRCode.create(this.inviteUrl, { errorCorrectionLevel: 'H' });   // H: the logo in the middle doesn't hurt it
    const n = qr.modules.size, data = qr.modules.data, q = 2, cell = cv.width / (n + q * 2);
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#121a0c';
    const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!data[r * n + c] || finder(r, c)) continue;
      g.fillRect((c + q) * cell, (r + q) * cell, cell + 0.4, cell + 0.4);
    }
    for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {             // rounded finder squares
      const x = (c + q) * cell, y = (r + q) * cell, s = 7 * cell;
      g.beginPath(); g.roundRect(x, y, s, s, cell * 1.6); g.roundRect(x + cell, y + cell, s - 2 * cell, s - 2 * cell, cell); g.fill('evenodd');
      g.beginPath(); g.roundRect(x + 2 * cell, y + 2 * cell, 3 * cell, 3 * cell, cell * 0.8); g.fill();
    }
    const holeS = cell * Math.round(n * 0.26), hx = (cv.width - holeS) / 2;
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(hx, hx, holeS, holeS, cell * 2); g.fill();
    this._wireCode();
  }

  _wireCode() {
    const boxes = [...this.el.querySelectorAll('.c-code input')];
    const value = () => boxes.map(b => b.value).join('');
    const check = () => { boxes.forEach(b => b.classList.toggle('filled', !!b.value)); const v = value(); if (v.length === 6) this._submitCode(v); };
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => {
        const v = this._clean(b.value);
        if (v.length > 1) { [...v].forEach((ch, k) => { if (boxes[i + k]) boxes[i + k].value = ch; }); boxes[Math.min(5, i + v.length)].focus(); }
        else { b.value = v; if (v && boxes[i + 1]) boxes[i + 1].focus(); }
        check();
      });
      b.addEventListener('keydown', e => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) { boxes[i - 1].value = ''; boxes[i - 1].focus(); check(); } });
      b.addEventListener('paste', e => { const v = this._clean(e.clipboardData?.getData('text')); if (v) { e.preventDefault(); [...v].forEach((ch, k) => { if (boxes[k]) boxes[k].value = ch; }); boxes[Math.min(5, v.length)].focus(); check(); } });
    });
  }

  _submitCode(code) {
    const hint = this.el.querySelector('.c-codehint');
    const say = (msg, kind) => { if (hint) { hint.textContent = msg; hint.className = 'c-codehint ' + kind; } else this._toast(msg); };
    if (code === this.code) { say("That's your own code — send it to a friend instead.", 'bad'); return; }
    if (this.data.requests.some(r => r.code === code)) { say('You already asked them — waiting for them to accept.', 'bad'); return; }
    this.data.requests.push({ name: `${code.slice(0, 3)}·${code.slice(3)}`, code, at: Date.now() });
    this._save();
    say('Request sent! The chat opens when they accept.', 'ok');
    setTimeout(() => { if (this.isOpen && this.stack.at(-1)?.page === 'add') { this.stack = [{ page: 'list' }]; this._render(false); } }, 1500);
  }

  _createGroup() {
    const name = this.el.querySelector('#c-gname').value.trim();
    const members = [...this.el.querySelectorAll('.c-pick input:checked')].map(i => i.value);
    if (!name || !members.length) return;
    const g = { id: 'g' + Date.now().toString(36), name, members, at: Date.now() };
    this.data.groups.push(g); this._save();
    this.stack = [{ page: 'list' }, { page: 'thread', arg: g.id }];
    this._render(true);
  }

  // --- camera scanner (BarcodeDetector where there is one; jsQR otherwise, e.g. iPhone) --------
  async _startScan() {
    const video = this.el.querySelector('.c-scan video'), msg = this.el.querySelector('.c-scan-msg');
    if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = 'No camera here — type their code instead.'; return; }
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch { msg.textContent = 'Camera permission was not given — type their code instead.'; return; }
    if (this.stack.at(-1)?.page !== 'scan') { this._stopScan(); return; }
    video.srcObject = this._stream; await video.play().catch(() => {});
    const det = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
    const jsQR = det ? null : (await import('jsqr')).default;
    const cv = this.el.querySelector('.c-scan canvas'), g = cv.getContext('2d', { willReadFrequently: true });
    const tick = async () => {
      if (!this._stream) return;
      let text = null;
      if (video.readyState >= 2) {
        if (det) { try { text = (await det.detect(video))[0]?.rawValue || null; } catch {} }
        else {
          const w = 360, h = Math.round(w * video.videoHeight / video.videoWidth) || 360;
          cv.width = w; cv.height = h; g.drawImage(video, 0, 0, w, h);
          text = jsQR(g.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data || null;
        }
      }
      if (text) {
        const m = /[?&]invite=([A-Za-z0-9]{6})/.exec(text), code = this._clean(m ? m[1] : text);
        if (code.length === 6) { this._stopScan(); this.stack.pop(); this._render(false); this._submitCode(code); return; }
        msg.textContent = "That isn't an Ocean code";
      }
      this._scanT = setTimeout(tick, 180);
    };
    tick();
  }

  _stopScan() {
    clearTimeout(this._scanT);
    this._stream?.getTracks().forEach(t => t.stop()); this._stream = null;
  }
}

/** Group form: enable Create once there's a name and at least one member. */
document.addEventListener('input', e => {
  const page = e.target.closest?.('.chats.page-group'); if (!page) return;
  const ok = page.querySelector('#c-gname').value.trim() && page.querySelector('.c-pick input:checked');
  page.querySelector('[data-act=create]').disabled = !ok;
});
document.addEventListener('change', e => {
  const page = e.target.closest?.('.chats.page-group'); if (!page) return;
  const ok = page.querySelector('#c-gname').value.trim() && page.querySelector('.c-pick input:checked');
  page.querySelector('[data-act=create]').disabled = !ok;
});
/** Thread: send a message (kept on this device). */
document.addEventListener('submit', e => {
  const f = e.target.closest?.('.c-compose'); if (!f) return;
  e.preventDefault();
  const chats = f.closest('.chats')?._owner; const t = f.t.value.trim(); if (!t || !chats) return;
  const id = f.dataset.thread;
  (chats.data.messages[id] ||= []).push({ from: 'me', text: t, at: Date.now() });
  chats._save(); chats._render(null); chats.el.querySelector('.c-compose input')?.focus({ preventScroll: true });
});
