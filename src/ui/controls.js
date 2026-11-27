import { TIMES, CHIP_COLORS, STYLES, STYLE_IDS, styleSwatch } from '../ocean/palettes.js';

/**
 * Account settings panel, opened from the account button (top right, next to
 * sound). A card under the buttons on desktop and a bottom sheet on phones
 * (the layout switch lives in styles.css). Holds the ocean settings: time of
 * day, sea state, foam, glitter and reef shallows.
 */
const MODES = [
  { id: 'realtime', name: 'Real time', hint: 'Follows your clock' },
  { id: 'cycle', name: '1-hour cycle', hint: 'Dawn to night every hour' },
  { id: 'manual', name: 'Manual', hint: 'Pick a time below' },
];

export function createControls(panel, { initial, onTimeOfDay, onMode, onStyle, onStorm, onFoam, onGlitter, onReef }) {
  panel.innerHTML = `
    <div class="panel-head">
      <span class="avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4" fill="currentColor"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0z" fill="currentColor"/></svg></span>
      <span class="panel-who"><span class="panel-title" id="panel-title">Account settings</span><span class="hint">Guest</span></span>
      <button class="panel-close" type="button" aria-label="Close settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
    </div>
    <div class="panel-body" id="panel-body">
      <div class="row head"><span class="eyebrow">Time of day</span><span class="value" data-tod-label>Day</span></div>
      <input type="range" min="0" max="4.999" step="0.001" data-tod-slider aria-label="Time of day">
      <div class="chips">
        ${TIMES.map((t, i) => `<button type="button" class="chip" data-tod="${i}" style="--chip:${CHIP_COLORS[i]}">${t.name}</button>`).join('')}
      </div>
      <div class="modes" role="radiogroup" aria-label="Time of day mode">
        ${MODES.map(m => `<button type="button" class="mode" role="radio" data-mode="${m.id}" title="${m.hint}">${m.name}</button>`).join('')}
      </div>
      <div class="hint" data-mode-hint></div>
      <div class="divider"></div>
      <div class="row head"><span class="eyebrow">Ocean colour</span><span class="value" data-style-label></span></div>
      <div class="styles" role="radiogroup" aria-label="Ocean colour">
        ${STYLE_IDS.map(id => `<button type="button" class="style" role="radio" data-style="${id}"><span class="swatch" style="background:${styleSwatch(id)}"></span><span>${STYLES[id].name}</span></button>`).join('')}
      </div>
      <div class="divider"></div>
      <div class="row head"><span class="eyebrow">Sea state</span><span class="hint">Calm → Stormy</span></div>
      <input type="range" min="0" max="1" step="0.01" data-storm aria-label="Sea state">
      <div class="row head"><span class="eyebrow">Foam</span><span class="hint">Less → More</span></div>
      <input type="range" min="0" max="1" step="0.01" data-foam aria-label="Foam amount">
      <div class="row head"><span class="eyebrow">Glitter</span><span class="hint">Less → More</span></div>
      <input type="range" min="0" max="1" step="0.01" data-glitter aria-label="Glitter amount">
      <label class="check"><input type="checkbox" data-reef> Reef shallows</label>
    </div>`;

  const $ = s => panel.querySelector(s);
  const slider = $('[data-tod-slider]'), label = $('[data-tod-label]');
  const modeHint = $('[data-mode-hint]'), storm = $('[data-storm]'), foam = $('[data-foam]'), glitter = $('[data-glitter]'), reef = $('[data-reef]');

  slider.value = initial.tod; storm.value = initial.storm; foam.value = initial.foam; glitter.value = initial.glitter; reef.checked = initial.reef;

  // closed until the account button opens it
  const listeners = new Set();
  const setOpen = open => {
    panel.classList.toggle('open', open);
    panel.hidden = !open;
    listeners.forEach(f => f(open));
  };
  setOpen(false);
  $('.panel-close').addEventListener('click', () => setOpen(false));

  const setLabel = name => { label.textContent = name; };
  const modeBtns = [...panel.querySelectorAll('[data-mode]')];
  const setMode = id => {
    for (const b of modeBtns) { const on = b.dataset.mode === id; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
    modeHint.textContent = MODES.find(m => m.id === id).hint;
  };
  setMode(initial.mode);

  const styleBtns = [...panel.querySelectorAll('[data-style]')], styleLabel = $('[data-style-label]');
  const setStyle = id => {
    for (const b of styleBtns) { const on = b.dataset.style === id; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
    styleLabel.textContent = STYLES[id].name;
  };
  setStyle(initial.style);
  styleBtns.forEach(b => b.addEventListener('click', () => { setStyle(b.dataset.style); onStyle(b.dataset.style); }));
  modeBtns.forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); onMode(b.dataset.mode); }));
  // picking a time switches to manual
  const pick = v => { setMode('manual'); onTimeOfDay(v); setLabel(TIMES[Math.round(v) % TIMES.length].name); slider.value = v; };

  slider.addEventListener('input', () => pick(+slider.value));
  panel.querySelectorAll('[data-tod]').forEach(b => b.addEventListener('click', () => pick(+b.dataset.tod)));
  storm.addEventListener('input', () => onStorm(+storm.value));
  foam.addEventListener('input', () => onFoam(+foam.value));
  glitter.addEventListener('input', () => onGlitter(+glitter.value));
  reef.addEventListener('change', () => onReef(reef.checked));

  return {
    setTimeOfDay(v, name) { slider.value = v; setLabel(name); },
    get open() { return panel.classList.contains('open'); },
    setOpen,
    onOpenChange(f) { listeners.add(f); },
    setMode,
  };
}
