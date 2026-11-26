import { TIMES, CHIP_COLORS } from '../ocean/palettes.js';

/**
 * Settings panel. A floating card on desktop and a bottom sheet on phones
 * (the layout switch lives in styles.css).
 */
export function createControls(panel, { initial, onTimeOfDay, onAuto, onStorm, onFoam, onGlitter, onReef }) {
  panel.innerHTML = `
    <button class="panel-toggle" type="button" aria-expanded="false" aria-controls="panel-body">
      <span class="panel-toggle-dot" aria-hidden="true"></span>
      <span class="panel-toggle-label">Day</span>
      <svg class="panel-toggle-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="panel-body" id="panel-body">
      <div class="row head"><span class="eyebrow">Time of day</span><span class="value" data-tod-label>Day</span></div>
      <input type="range" min="0" max="4.999" step="0.001" data-tod-slider aria-label="Time of day">
      <div class="chips">
        ${TIMES.map((t, i) => `<button type="button" class="chip" data-tod="${i}" style="--chip:${CHIP_COLORS[i]}">${t.name}</button>`).join('')}
      </div>
      <label class="check"><input type="checkbox" data-auto> Cycle automatically</label>
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
  const toggle = $('.panel-toggle'), toggleLabel = $('.panel-toggle-label');
  const slider = $('[data-tod-slider]'), label = $('[data-tod-label]');
  const auto = $('[data-auto]'), storm = $('[data-storm]'), foam = $('[data-foam]'), glitter = $('[data-glitter]'), reef = $('[data-reef]');

  slider.value = initial.tod; auto.checked = initial.auto; storm.value = initial.storm; foam.value = initial.foam; glitter.value = initial.glitter; reef.checked = initial.reef;

  const setOpen = open => { panel.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  // Desktop starts expanded, phones start collapsed.
  setOpen(!matchMedia('(max-width: 640px)').matches);

  const setLabel = name => { label.textContent = name; toggleLabel.textContent = name; };
  const pick = v => { auto.checked = false; onTimeOfDay(v); setLabel(TIMES[Math.round(v) % TIMES.length].name); slider.value = v; };

  slider.addEventListener('input', () => pick(+slider.value));
  panel.querySelectorAll('[data-tod]').forEach(b => b.addEventListener('click', () => pick(+b.dataset.tod)));
  auto.addEventListener('change', () => onAuto(auto.checked));
  storm.addEventListener('input', () => onStorm(+storm.value));
  foam.addEventListener('input', () => onFoam(+foam.value));
  glitter.addEventListener('input', () => onGlitter(+glitter.value));
  reef.addEventListener('change', () => onReef(reef.checked));

  return {
    setTimeOfDay(v, name) { slider.value = v; setLabel(name); },
  };
}
