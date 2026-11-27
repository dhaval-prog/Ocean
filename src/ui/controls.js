import { TIMES, CHIP_COLORS, STYLES, STYLE_IDS, styleSwatch } from '../ocean/palettes.js';
import { PRESETS, PRESET_IDS } from '../weather/Weather.js';

const WX_ICON = {
  clear: '<circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  cloudy: '<path d="M7 18h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 18z" fill="currentColor"/>',
  rain: '<path d="M7 14h10.5a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.7 1A3.1 3.1 0 0 0 7 14z" fill="currentColor"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  storm: '<path d="M7 13h10.5a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.7 1A3.1 3.1 0 0 0 7 13z" fill="currentColor"/><path d="M12.5 13l-2.5 4.5h3l-2 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  fog: '<path d="M4 8h16M6 12h14M4 16h12M8 20h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};
const WX_MODES = [
  { id: 'auto', name: 'Changing' },
  { id: 'local', name: 'Near me' },
  { id: 'manual', name: 'Fixed' },
];

/**
 * Account settings panel, opened from the account button (top right, next to
 * sound). A card under the buttons on desktop and a bottom sheet on phones
 * (the layout switch lives in styles.css). Holds the ocean settings: time of
 * day, weather, ocean colour, sea state, foam, clouds, glitter and reef shallows.
 */
const MODES = [
  { id: 'realtime', name: 'Real time', hint: 'Follows your clock' },
  { id: 'cycle', name: '2-hour cycle', hint: 'Dawn to night every 2 hours: 24 min each, with clear, cloudy, rain, storm and fog in turn (about 5 min each)' },
  { id: 'manual', name: 'Manual', hint: 'Pick a time below' },
];

export function createControls(panel, { initial, onTimeOfDay, onMode, onStyle, onWeatherMode, onPreset, onStorm, onFoam, onClouds, onGlitter, onReef, onGraphics }) {
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
      <div class="row head"><span class="eyebrow">Weather</span><span class="value" data-wx-label></span></div>
      <div class="wx" role="radiogroup" aria-label="Weather">
        ${PRESET_IDS.map(id => `<button type="button" class="wx-chip" role="radio" data-wx="${id}"><svg viewBox="0 0 24 24" aria-hidden="true">${WX_ICON[id]}</svg><span>${PRESETS[id].name}</span></button>`).join('')}
      </div>
      <div class="modes" role="radiogroup" aria-label="Weather mode">
        ${WX_MODES.map(m => `<button type="button" class="mode" role="radio" data-wx-mode="${m.id}">${m.name}</button>`).join('')}
      </div>
      <div class="hint" data-wx-hint></div>
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
      <div class="row head"><span class="eyebrow">Clouds</span><span class="hint">Clear → Overcast</span></div>
      <input type="range" min="0" max="1" step="0.01" data-clouds aria-label="Cloud cover">
      <div class="row head"><span class="eyebrow">Glitter</span><span class="hint">Less → More</span></div>
      <input type="range" min="0" max="1" step="0.01" data-glitter aria-label="Glitter amount">
      <label class="check"><input type="checkbox" data-reef> Reef shallows</label>
      <div class="divider"></div>
      <div class="row head"><span class="eyebrow">Graphics</span><span class="value" data-gfx-label></span></div>
      <label class="check gfx"><input type="checkbox" switch data-gfx> High-quality graphics</label>
      <div class="hint" data-gfx-hint></div>
    </div>`;

  const $ = s => panel.querySelector(s);
  const slider = $('[data-tod-slider]'), label = $('[data-tod-label]');
  const modeHint = $('[data-mode-hint]'), storm = $('[data-storm]'), foam = $('[data-foam]'), clouds = $('[data-clouds]'), glitter = $('[data-glitter]'), reef = $('[data-reef]');

  slider.value = initial.tod; storm.value = initial.storm; foam.value = initial.foam; clouds.value = initial.clouds; glitter.value = initial.glitter; reef.checked = initial.reef;

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
  clouds.addEventListener('input', () => onClouds(+clouds.value));

  // weather: presets (switch to Fixed), modes, status line
  const wxBtns = [...panel.querySelectorAll('[data-wx]')], wxModeBtns = [...panel.querySelectorAll('[data-wx-mode]')];
  const wxLabel = $('[data-wx-label]'), wxHint = $('[data-wx-hint]');
  const setWeather = ({ mode, preset, name, status }) => {
    for (const b of wxBtns) { const on = mode === 'manual' && b.dataset.wx === preset; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
    for (const b of wxModeBtns) { const on = b.dataset.wxMode === mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
    wxLabel.textContent = name; wxHint.textContent = status;
  };
  wxBtns.forEach(b => b.addEventListener('click', () => onPreset(b.dataset.wx)));
  wxModeBtns.forEach(b => b.addEventListener('click', () => onWeatherMode(b.dataset.wxMode)));
  // sliders follow the weather while it changes by itself (not while being dragged)
  const setWeatherValues = v => {
    for (const [el, key] of [[storm, 'storm'], [foam, 'foam'], [clouds, 'clouds']]) if (document.activeElement !== el) el.value = v[key];
  };
  glitter.addEventListener('input', () => onGlitter(+glitter.value));
  reef.addEventListener('change', () => onReef(reef.checked));
  // graphics: high quality, or a battery saver that keeps the phone smooth and cool
  const gfx = $('[data-gfx]'), gfxLabel = $('[data-gfx-label]'), gfxHint = $('[data-gfx-hint]');
  const setGraphics = hq => {
    gfx.checked = hq; gfxLabel.textContent = hq ? 'High' : 'Battery saver';
    gfxHint.textContent = hq ? 'Sharpest picture and smoothest edges. Uses more battery and can warm the phone.'
      : 'Lower 3D resolution, no extra edge smoothing, 30 fps while nothing is moving fast. Smoother and cooler on phones; text stays sharp.';
  };
  setGraphics(initial.graphics !== false);
  gfx.addEventListener('change', () => { setGraphics(gfx.checked); onGraphics?.(gfx.checked); });

  return {
    setTimeOfDay(v, name) { slider.value = v; setLabel(name); },
    setWeather, setWeatherValues,
    get open() { return panel.classList.contains('open'); },
    setOpen,
    onOpenChange(f) { listeners.add(f); },
    setMode,
  };
}
