// Stationery: what the paper looks like, painted onto its texture canvas.
//   - 'auto' follows the time of day and weather: pale pink at dawn, cream by
//     day, warm cream at sunset, lavender at dusk, starry navy at night, with
//     faint water stains while it rains
//   - or a chosen style: parchment, wave-lined, starry or sakura
//   - a mood adds a tint and a wavy border in its colour
// paintPaper() also draws the finished letter (header, words, signature,
// doodles, stickers, photo, voice note, seal) when it is sent.

export const PAPER_STYLES = [
  { id: 'auto', name: 'Auto' },
  { id: 'parchment', name: 'Parchment' },
  { id: 'waves', name: 'Waves' },
  { id: 'starry', name: 'Starry' },
  { id: 'sakura', name: 'Sakura' },
];

export const MOODS = [
  { id: 'none', name: 'No mood', color: null },
  { id: 'miss', name: 'Miss you', color: '#9d86d8' },
  { id: 'thanks', name: 'Thank you', color: '#e9b44c' },
  { id: 'night', name: 'Good night', color: '#4a5ba8' },
  { id: 'love', name: 'Love you', color: '#e86f8e' },
  { id: 'cheer', name: 'Cheer up', color: '#4fbf8f' },
];

const AUTO_BG = ['#fde9ec', '#fbf9f3', '#fdf0d8', '#efe9fa', null];   // dawn, day, sunset, dusk, night (starry)

/** The concrete look for the paper right now. */
export function resolvePaper(style, tod, rain) {
  const i = Math.round(((tod % 5) + 5) % 5) % 5;
  let kind = style, bg = '#fbf9f3';
  if (style === 'auto') { kind = i === 4 ? 'starry' : 'plain'; bg = AUTO_BG[i] || '#1d2547'; }
  if (kind === 'parchment') bg = '#f2e3c2';
  if (kind === 'waves') bg = '#fbf8ee';
  if (kind === 'starry') bg = '#1d2547';
  if (kind === 'sakura') bg = '#fcebef';
  return { kind, bg, dark: kind === 'starry', stains: rain > 0.3 && kind !== 'starry', key: `${kind}|${bg}|${rain > 0.3}` };
}

/** Ink colour for the time of day on this paper (light, glowing ink on dark paper). */
export function inkFor(tod, dark) {
  if (dark) return { ink: '#e6edff', glow: 'rgba(190, 215, 255, 0.85)' };
  const i = Math.round(((tod % 5) + 5) % 5) % 5;
  return [
    { ink: '#5a4aa6', glow: 'transparent' },   // dawn: violet-blue
    { ink: '#1f3a8a', glow: 'transparent' },   // day: deep blue
    { ink: '#6b4423', glow: 'transparent' },   // sunset: sepia
    { ink: '#4a3a8c', glow: 'transparent' },   // dusk: purple-ink
    { ink: '#2b2f5e', glow: 'transparent' },   // night on light paper: blue-black
  ][i];
}

// a tiny seeded random, so the patterns stay put between repaints
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function wavyLine(g, x0, x1, y, amp, len) {
  g.beginPath();
  for (let x = x0; x <= x1; x += 4) g.lineTo(x, y + Math.sin((x / len) * Math.PI * 2) * amp);
  g.stroke();
}

function petal(g, x, y, s, rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath(); g.moveTo(0, -s); g.bezierCurveTo(s * 0.9, -s * 0.6, s * 0.7, s * 0.7, 0, s); g.bezierCurveTo(-s * 0.7, s * 0.7, -s * 0.9, -s * 0.6, 0, -s);
  g.fill(); g.restore();
}

/**
 * Paint the paper. look: { style, tod, rain, mood }; comp (optional, when the
 * letter is sent): { dear, text, sign, ink, font, doodles, stickers, photo, voice, seal }.
 */
export function paintPaper(g, w, h, look, grain, comp = null, images = {}) {
  const P = resolvePaper(look.style, look.tod, look.rain);
  const R = rng(1234);
  g.save();
  g.fillStyle = P.bg; g.fillRect(0, 0, w, h);
  if (P.kind === 'parchment') {
    const rg = g.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.8);
    rg.addColorStop(0, 'rgba(255, 248, 225, 0)'); rg.addColorStop(1, 'rgba(140, 95, 40, 0.35)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(120, 80, 30, 0.12)';
    for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(R() * w, R() * h, 1 + R() * 4, 0, Math.PI * 2); g.fill(); }
  } else if (P.kind === 'waves') {
    g.strokeStyle = 'rgba(80, 140, 210, 0.35)'; g.lineWidth = 2;
    for (let y = h * 0.2; y < h * 0.86; y += h * 0.075) wavyLine(g, w * 0.08, w * 0.92, y, 3, w * 0.12);
  } else if (P.kind === 'starry') {
    const lg = g.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, '#26306a'); lg.addColorStop(1, '#141a3a');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const s = R() * 2.4 + 0.6; g.fillStyle = `rgba(255, 255, 255, ${0.35 + R() * 0.6})`; g.beginPath(); g.arc(R() * w, R() * h, s, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(255, 246, 210, 0.9)'; g.beginPath(); g.arc(w * 0.84, h * 0.09, w * 0.045, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1f2753'; g.beginPath(); g.arc(w * 0.865, h * 0.08, w * 0.04, 0, Math.PI * 2); g.fill();
  } else if (P.kind === 'sakura') {
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(240, ${140 + R() * 50}, ${170 + R() * 30}, ${0.35 + R() * 0.4})`; petal(g, R() * w, R() * h, 6 + R() * 9, R() * 6.3); }
    g.strokeStyle = 'rgba(120, 80, 70, 0.55)'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w, h * 0.02); g.quadraticCurveTo(w * 0.8, h * 0.06, w * 0.66, h * 0.03); g.stroke();
    g.fillStyle = 'rgba(245, 160, 190, 0.9)'; for (const [x, y] of [[0.7, 0.035], [0.78, 0.06], [0.9, 0.045]]) petal(g, w * x, h * y, 11, x * 9);
  }
  if (P.stains) {   // faint water stains while it rains
    for (let i = 0; i < 7; i++) {
      const x = R() * w, y = R() * h, r = 14 + R() * 40;
      g.fillStyle = 'rgba(110, 140, 170, 0.07)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(110, 130, 160, 0.16)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    }
  }
  if (grain) { g.globalAlpha = P.dark ? 0.25 : 1; g.drawImage(grain, 0, 0, w, h); g.globalAlpha = 1; }
  // mood: a soft tint and a wavy border in its colour
  const mood = MOODS.find(m => m.id === look.mood);
  if (mood?.color) {
    g.fillStyle = mood.color; g.globalAlpha = 0.1; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
    g.strokeStyle = mood.color; g.lineWidth = 4; g.globalAlpha = 0.8;
    const m = w * 0.04;
    wavyLine(g, m, w - m, m, 4, w * 0.08); wavyLine(g, m, w - m, h - m, 4, w * 0.08);
    g.save(); g.translate(0, 0); g.rotate(Math.PI / 2); wavyLine(g, m, h - m, -m, 4, w * 0.08); wavyLine(g, m, h - m, -(w - m), 4, w * 0.08); g.restore();
    g.globalAlpha = 1;
  }
  if (comp) drawLetter(g, w, h, comp, images);
  g.restore();
  return P;
}

function wrap(g, text, maxW) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (g.measureText(t).width > maxW && line) { lines.push(line); line = word; } else line = t;
    }
    lines.push(line);
  }
  return lines;
}

/** The finished letter, painted onto the paper for its flight. Positions are fractions of the paper. */
function drawLetter(g, w, h, c, images) {
  const font = c.font || 'Caveat';
  g.fillStyle = c.ink; g.textAlign = 'center'; g.textBaseline = 'top';
  if (c.doodles) g.drawImage(c.doodles, 0, 0, w, h);
  if (c.dear) { g.font = `600 ${w * 0.075}px "${font}", cursive`; g.textAlign = 'left'; g.fillText(c.dear, w * 0.1, h * 0.08); g.textAlign = 'center'; }
  if (c.text) {
    const size = w * 0.066; g.font = `500 ${size}px "${font}", "Comic Sans MS", cursive`;
    wrap(g, c.text, w * 0.82).slice(0, 14).forEach((l, i) => g.fillText(l, w / 2, h * 0.18 + i * size * 1.25));
  }
  if (c.sign) { g.font = `600 ${w * 0.062}px "${font}", cursive`; g.textAlign = 'right'; g.fillText(c.sign, w * 0.9, h * 0.74); g.textAlign = 'center'; }
  for (const s of c.stickers || []) {
    const img = images[s.type]; if (!img) continue;
    const sz = w * 0.13 * (s.scale || 1);
    g.save(); g.translate(s.x * w, s.y * h); g.rotate((s.rot || 0) * Math.PI / 180); g.drawImage(img, -sz / 2, -sz / 2, sz, sz); g.restore();
  }
  if (c.photo?.img) {
    const p = c.photo, pw = w * 0.36, ph = pw * 1.18;
    g.save(); g.translate(p.x * w, p.y * h); g.rotate((p.rot || 0) * Math.PI / 180);
    g.fillStyle = '#fff'; g.shadowColor = 'rgba(0, 0, 0, 0.25)'; g.shadowBlur = 8; g.fillRect(-pw / 2, -ph / 2, pw, ph); g.shadowBlur = 0;
    const iw = pw * 0.86, ix = -iw / 2, iy = -ph / 2 + pw * 0.07;
    const im = p.img, s = Math.max(iw / im.width, iw / im.height);
    g.save(); g.beginPath(); g.rect(ix, iy, iw, iw); g.clip(); g.drawImage(im, -im.width * s / 2, iy + iw / 2 - im.height * s / 2, im.width * s, im.height * s); g.restore();
    g.restore();
  }
  if (c.voice?.peaks?.length) {
    const v = c.voice, x0 = w * 0.18, x1 = w * 0.82, y = h * v.y, n = v.peaks.length;
    g.strokeStyle = c.ink; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath();
    for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * i / (n - 1), a = (0.18 + v.peaks[i] * 0.82) * h * 0.035; g.lineTo(x, y + Math.sin(i * 0.9) * a); }
    g.stroke();
  }
  if (c.seal) {
    const r = w * 0.075, x = w * 0.5, y = h * 0.8;
    g.fillStyle = c.seal.color; g.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, rr = r * (1 + 0.07 * Math.sin(a * 9)); g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
    g.fill();
    g.strokeStyle = 'rgba(0, 0, 0, 0.2)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * 0.72, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255, 255, 255, 0.85)'; g.font = `700 ${r * 0.75}px Georgia, serif`; g.textBaseline = 'middle'; g.fillText(c.seal.initials, x, y + 1);
  }
}
