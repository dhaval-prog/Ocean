// Stickers for the letter: little cartoon things from the sea, each a small SVG
// with an ink outline (the same images are painted onto the paper when sent).

const INK = '#3a3350';

export const STICKERS = {
  shell: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 8C17 8 7 20 7 33c0 5 3 9 7 11l4 9h28l4-9c4-2 7-6 7-11C57 20 47 8 32 8z" fill="#f7c6a3" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 12v40M21 15l6 37M43 15l-6 37M12 25l14 27M52 25L38 52" stroke="#d9906a" stroke-width="2" stroke-linecap="round"/><path d="M18 53h28" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  starfish: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 5l7 17 18 2-14 12 5 19-16-10-16 10 5-19L7 24l18-2z" fill="#ff9a6b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><g fill="#ffd3b8"><circle cx="32" cy="17" r="1.8"/><circle cx="32" cy="27" r="1.8"/><circle cx="45" cy="27" r="1.8"/><circle cx="19" cy="27" r="1.8"/><circle cx="40" cy="42" r="1.8"/><circle cx="24" cy="42" r="1.8"/></g></svg>`,
  stamp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M8 8h48v48H8z" fill="#fff8ec" stroke="${INK}" stroke-width="2.5" stroke-dasharray="3.2 2.4"/><rect x="14" y="14" width="36" height="30" fill="#8fd0ee" stroke="${INK}" stroke-width="2"/><path d="M14 36c6-5 12-5 18 0s12 5 18 0v8H14z" fill="#3f8fd0" stroke="${INK}" stroke-width="2"/><circle cx="40" cy="22" r="4" fill="#ffd36b"/><text x="32" y="53" font-family="Georgia,serif" font-size="7" text-anchor="middle" fill="${INK}">OCEAN</text></svg>`,
  boat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M8 40h48l-7 12H15z" fill="#e8674b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 40V28h18v12" fill="#fff4e0" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M42 40V20h7v20" fill="#3d4a7a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><rect x="24" y="31" width="4" height="4" fill="#8fd0ee"/><rect x="31" y="31" width="4" height="4" fill="#8fd0ee"/><path d="M6 55c6-3 10-3 16 0s10 3 16 0 10-3 16 0" fill="none" stroke="#3f8fd0" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  fish: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M10 32c8-12 26-14 36-4l10-8-2 12 2 12-10-8C36 46 18 44 10 32z" fill="#ffb347" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M26 22c4 6 4 14 0 20" fill="none" stroke="#e07a2f" stroke-width="2"/><circle cx="18" cy="30" r="2.6" fill="${INK}"/><path d="M30 20c2-4 6-6 10-5" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/></svg>`,
};

const cache = {};
/** A data: URL for a sticker's SVG (for <img> and for painting onto the paper). */
export function stickerURL(type) {
  return cache[type] || (cache[type] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(STICKERS[type]));
}
