import * as THREE from 'three';

// Time-of-day presets for the stylized ocean.
// pal: navy, deep, mid, shallow, bright, foam, cloud, glitter, sparkle, sky
// fx:  sparkle, light shafts, night glow, sun/moon disc
// sun: colour and strength of the sun (moon at night) path reflected on the water
// ambient: particles: petals (dawn/sunset), specks (night), glints (lights rising off the water)
export const TIMES = [
  { name: 'Dawn',   light: 0.85, fx: [0.4, 0.3, 0.0, 0.7],  sun: ['#ffd2b8', 0.75], ambient: { petals: 1.0,  specks: 0.0, glints: 0.3 },
    pal: ['#4a4f9e','#5f6fc0','#7f9be0','#a9c3f0','#f2c6dc','#fff4f6','#fbd9e6','#ffe1c4','#ffffff','#f6d9e4'] },
  // day: deep blues sit at a true sea-blue hue (~210°) instead of leaning violet
  { name: 'Day',    light: 1.0,  fx: [0.2, 0.6, 0.0, 0.55], sun: ['#fff6e2', 0.45], ambient: { petals: 0.15, specks: 0.0, glints: 0.1 },
    pal: ['#0c4485','#1468b4','#1590d0','#1cbfdc','#5be3e8','#f2ffff','#d9f2f6','#f6ffff','#ffffff','#d8f1f3'] },
  { name: 'Sunset', light: 0.8,  fx: [0.6, 0.8, 0.0, 1.0],  sun: ['#ffb347', 1.0],  ambient: { petals: 0.9,  specks: 0.0, glints: 0.4 },
    pal: ['#32226e','#53359a','#9c4fa6','#e06e9c','#ffa576','#fff2d8','#ffc7b4','#ffd060','#fff7c4','#f7c9a8'] },
  { name: 'Dusk',   light: 0.55, fx: [0.8, 0.1, 0.35, 0.6], sun: ['#e2cbff', 0.5],  ambient: { petals: 0.2,  specks: 0.4, glints: 0.8 },
    pal: ['#1b1a55','#2a2a7a','#43409e','#6a5fc2','#a78ae0','#e8dcff','#b5a8ec','#f0c8ff','#ffffff','#9b8fd1'] },
  // night: dimmer foam so the sea reads moonlit, not snowy
  { name: 'Night',  light: 0.3,  fx: [0.35, 0.0, 1.0, 0.9],  sun: ['#d6e4ff', 0.85], ambient: { petals: 0.0,  specks: 1.0, glints: 1.0 },
    pal: ['#04071f','#081039','#0f1d55','#123a75','#1667a0','#8d9ccc','#26336f','#d8ecff','#e3e8ff','#1c2350'] },
];

// Button tint for each preset in the UI.
export const CHIP_COLORS = ['#f6d9e4', '#bfe9f0', '#f7c9a8', '#b5a8ec', '#1c2350'];

// Ocean colour styles, applied on top of every time of day as HSL shifts
// (h in turns, s multiplier, l offset scaled by the time's brightness).
// water = navy … bright (0-4), shallowL = extra lift for shallow + bright (3, 4).
export const STYLES = {
  deep:     { name: 'Deep Ocean' },
  tropical: { name: 'Tropical', water: { h: -0.045, s: 1.12, l: 0.04 }, shallowL: 0.05, sky: { h: -0.03, s: 1.05, l: 0.02 } },
  nordic:   { name: 'Nordic',   water: { h: -0.01, s: 0.5, l: -0.02 }, foam: { s: 0.4, l: -0.02 }, sky: { s: 0.5, l: -0.02 } },
  pastel:   { name: 'Pastel',   water: { h: 0.035, s: 0.72, l: 0.1 }, sky: { s: 0.85, l: 0.04 } },
};
export const STYLE_IDS = Object.keys(STYLES);

const _c = new THREE.Color(), _hsl = {};
function shift(hex, t, light, extraL = 0) {
  _c.set(hex);
  if (!t) return _c.getHex();
  _c.getHSL(_hsl);
  _c.setHSL((_hsl.h + (t.h || 0) + 1) % 1, Math.min(1, _hsl.s * (t.s ?? 1)), Math.min(0.97, Math.max(0.02, _hsl.l + ((t.l || 0) + extraL) * light)));
  return _c.getHex();
}

/** A time-of-day palette (10 hex colours) recoloured for an ocean style; returns numbers for THREE.Color.set. */
export function stylePalette(pal, styleId, light = 1) {
  const S = STYLES[styleId] || STYLES.deep;
  return pal.map((hex, i) => {
    if (i <= 4) return shift(hex, S.water, light, i >= 3 ? (S.shallowL || 0) : 0);
    if (i === 5) return shift(hex, S.foam, light);
    if (i === 6 || i === 9) return shift(hex, S.sky, light);
    return shift(hex, null, light);
  });
}

/** CSS gradient previewing a style's daytime water, for the settings buttons. */
export function styleSwatch(styleId) {
  const p = stylePalette(TIMES[1].pal, styleId, 1).map(n => '#' + n.toString(16).padStart(6, '0'));
  return `linear-gradient(135deg, ${p[0]} 0%, ${p[1]} 30%, ${p[3]} 65%, ${p[4]} 85%, ${p[5]} 100%)`;
}
