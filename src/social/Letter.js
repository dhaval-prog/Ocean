import { ME, FRIENDS, NOTIFICATIONS, INBOX } from './people.js';

// The letter you write on the paper that pops out of the sea, plus the row of
// people at the top of the screen (you in the middle, friends in the ocean to
// the right, dimmed). Swipe left / right (or tap an avatar) to choose who the
// letter is for. Drag and flick the paper to send it back into the sea.

const ICONS = {
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="12" cy="13.2" r="3.2" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  inbox: '<svg viewBox="0 0 24 24"><path d="M4 6h16v12H4zM4 13h4.5l1.5 2h4l1.5-2H20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
  person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Letter {
  constructor({ root, seq, hint }) {
    this.seq = seq;
    this.hint = hint;
    this.recipients = [ME, ...FRIENDS];
    this.index = 0;                       // 0 = writing to yourself
    this.visible = false;

    // --- writing overlay that sits exactly on top of the paper -------------
    this.el = document.createElement('div');
    this.el.className = 'letter';
    this.el.hidden = true;
    this.el.innerHTML = `
      <textarea class="letter-text" rows="6" maxlength="400" spellcheck="false" aria-label="Your letter"></textarea>
      <div class="letter-actions">
        <button type="button" data-act="camera" aria-label="Add a photo">${ICONS.camera}</button>
        <button type="button" data-act="mic" class="primary" aria-label="Record a voice note">${ICONS.mic}</button>
        <button type="button" data-act="bell" aria-label="Remind me">${ICONS.bell}</button>
        <button type="button" data-act="inbox" aria-label="Letters in your inbox">${ICONS.inbox}<span class="badge">${INBOX}</span></button>
      </div>`;
    root.appendChild(this.el);
    this.text = this.el.querySelector('.letter-text');
    this.text.addEventListener('input', () => this._syncHint());

    // a tap on the paper writes; a drag on it picks the paper up to flick it
    let press = null;
    this.el.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, grabbed: false };
      e.preventDefault();
    });
    window.addEventListener('pointermove', e => {
      if (!press || press.id !== e.pointerId || press.grabbed) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) {
        press.grabbed = true;
        this.text.blur();
        this.seq.grab({ pointerId: e.pointerId, clientX: press.x, clientY: press.y });
      }
    });
    window.addEventListener('pointerup', e => {
      if (!press || press.id !== e.pointerId) return;
      if (!press.grabbed) { this.text.focus(); const n = this.text.value.length; this.text.setSelectionRange(n, n); }
      press = null;
    });

    // --- people row at the top ---------------------------------------------
    this.row = document.createElement('div');
    this.row.className = 'people';
    this.row.hidden = true;
    const badge = n => (n ? `<span class="badge">${n}</span>` : '');
    const avatar = (p, i) => `
      <button type="button" class="person" data-i="${i}" aria-label="Write to ${esc(p.id === 'me' ? 'yourself' : p.name)}">
        <span class="face" style="--c:${p.color};--r:${p.ring || 'rgba(0,0,0,0.12)'}">${esc(p.initials)}${badge(p.badge)}</span>
        <span class="name">${esc(p.name)}</span><span class="city">${esc(p.city)}</span>
      </button>`;
    this.row.innerHTML = `
      <div class="people-track">
        <div class="person extra"><span class="face bell">${ICONS.bell}<span class="badge warm">${NOTIFICATIONS > 9 ? '9+' : NOTIFICATIONS}</span></span><span class="name">Notifications</span></div>
        <div class="person extra"><span class="face status">${ICONS.person}<span class="plus">+</span></span><span class="name">Add Status</span></div>
        ${this.recipients.map(avatar).join('')}
      </div>`;
    root.appendChild(this.row);
    this.track = this.row.querySelector('.people-track');
    this.people = [...this.row.querySelectorAll('.person[data-i]')];
    this.people.forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (performance.now() - this._swipedAt > 350) this.select(+b.dataset.i); }));
    this._swipedAt = 0;

    // swipe left / right anywhere outside the paper to change who it's for
    let sw = null;
    root.addEventListener('pointerdown', e => {
      if (!this.visible || e.target.closest('.letter')) return;   // swipes can start anywhere but the paper
      sw = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    }, { capture: true });
    window.addEventListener('pointerup', e => {
      if (!sw || sw.id !== e.pointerId) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { this.select(this.index + (dx < 0 ? 1 : -1)); this._swipedAt = performance.now(); }
      sw = null;
    });
    window.addEventListener('keydown', e => {
      if (!this.visible || e.target === this.text) return;
      if (e.key === 'ArrowRight') this.select(this.index + 1);
      if (e.key === 'ArrowLeft') this.select(this.index - 1);
    });
    window.addEventListener('resize', () => this._layoutRow());
    this.select(0);
  }

  get recipient() { return this.recipients[this.index]; }

  select(i) {
    this.index = Math.max(0, Math.min(this.recipients.length - 1, i));
    this.people.forEach((b, k) => b.classList.toggle('selected', k === this.index));
    const r = this.recipient;
    this.text.placeholder = r.id === 'me' ? 'Write something for your loved one' : `Write something for ${r.name}`;
    this._layoutRow();
  }

  _layoutRow() {
    // slide the row so the chosen person sits in the middle of the screen
    const b = this.people[this.index];
    if (!b) return;
    const mid = b.offsetLeft + b.offsetWidth / 2;
    this.track.style.transform = `translateX(${this.row.clientWidth / 2 - mid}px)`;
  }

  _syncHint() { this.hint.hidden = !this.visible || this.text.value.trim().length > 0; }

  /** Call when the sequence changes mode. */
  onMode(mode) {
    const show = mode === 'card' || mode === 'held';
    if (show && !this.visible) {
      this.visible = true;
      this.el.hidden = false; this.row.hidden = false;
      document.body.classList.add('writing');
      requestAnimationFrame(() => this._layoutRow());
    }
    if (mode === 'thrown') this.seq.paint(this.text.value.trim());     // the words fly away with the paper
    if (!show && this.visible) {
      this.visible = false;
      this.el.hidden = true; this.row.hidden = true;
      this.text.blur();
      document.body.classList.remove('writing');
    }
    if (mode === 'idle') { this.text.value = ''; this.select(0); }
    this._syncHint();
  }

  /** Every frame: keep the overlay glued to the paper. */
  update() {
    if (!this.visible) return;
    const r = this.seq.screenRect(), s = this.el.style;
    s.left = r.x + 'px'; s.top = r.y + 'px'; s.width = r.w + 'px'; s.height = r.h + 'px';
    s.setProperty('--u', (r.w / 100) + 'px');              // 1% of the paper width
    // guide text sits just under the paper (or inside its bottom edge if the screen is short)
    const vh = window.innerHeight;
    this.hint.style.top = Math.min(r.y + r.h + 12, vh - 34) + 'px';
  }
}
