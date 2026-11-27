import * as THREE from 'three';
import { paintPaper } from '../social/Stationery.js';

// Click the boat → it sinks → a wet sheet of paper flutters up out of the
// water like a leaf on the wind (dripping, drying as it rises), hovers in front
// of you with a little bounce and settles onto the screen, breathing with the
// waves. Sending: it folds into a paper plane in 8 real folds and flies to
// the chosen contact's circle, or rolls up from the bottom edge into a bottle
// that drops into the sea; the boat bobs back up.
// Adapted from the "sink → paper → catch → throw → re-form" sequence in the
// Tugboat.html prototype.

const V3 = THREE.Vector3;
export const PW = 1.6, PH = 2.0;                            // paper size (world units)
// tap → letter ready: 1.7 + 1.8 + 0.6 + 0.9 = 5.0 s
// the folded plane, seen from above: nose up the screen, tipped a little away from you
const BOTTLE_SCALE = 0.66;   // the rolled scroll and its bottle shrink so the whole bottle fits the screen
const PLANE_TILT = Math.PI / 3, PLANE_SCALE = 0.72, DIHEDRAL = 0.24;   // nose 60° away from you: you see its back, the T of wings and keel
/** How far the plane has tipped away (radians) at fold progress k: the paper faces you for the first folds, then the nose dips away. */
const planeTilt = k => 0.12 * k + (PLANE_TILT - 0.12) * smoothstep(0.62, 1, k);
/** The plane's turn at fold progress k (and a bank about its nose): it dips its nose away and turns over
 *  so its top faces you and the keel hangs below the wings (the T you see from behind). */
const planeQ = (k, bank = 0) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -planeTilt(k))
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * smoothstep(0.62, 1, k) + bank));
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DUR = { sink: 1.7, fly: 1.1, toScreen: 0.45, hover: 0.45,   // the paper comes up and settles in 2 s
  fold: 1.4, plane: 1.3, bottle: 2.2, reform: 2.2 };

if (REDUCED) { DUR.fold *= 0.55; DUR.plane *= 0.6; DUR.bottle *= 0.6; DUR.reform *= 0.6; }   // reduced motion: quicker folds and flights
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const backOut = k => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

export class SinkSequence {
  /**
   * @param {{ scene, camera, dom, boat, ocean, onChange?: (mode: string) => void,
   *          getWind?: () => { dir: number[], strength: number }, onDrip?: (pos: THREE.Vector3) => void }} o
   */
  constructor({ scene, camera, dom, boat, ocean, onChange, getWind = null, onDrip = null }) {
    Object.assign(this, { scene, camera, dom, boat, ocean, onChange, getWind, onDrip });
    this._dripAt = 0;
    this.mode = 'idle';
    // what the paper looks like (set by the letter: stationery, time, weather, mood) and sticker images
    this.look = { style: 'auto', tod: 1, rain: 0, mood: 'none' };
    this.images = {};
    this.t0 = 0;

    this.geo = new THREE.PlaneGeometry(PW, PH, 72, 90);   // fine enough for crisp diagonal fold lines
    this.base = this.geo.attributes.position.array.slice();
    this.geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(this.geo.attributes.position.count * 3).fill(1), 3));
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640; this.canvas.height = Math.round(640 * PH / PW);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, side: THREE.DoubleSide, alphaTest: 0.5, vertexColors: true });
    // wet paper: darker, greyer blotches and soaked edges that dry out (uWet 1 → 0);
    // the edges stay wet longest, like real paper drying
    this.wet = { value: 0 };
    this.mat.onBeforeCompile = sh => {
      sh.uniforms.uWet = this.wet;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uWet;
          float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
          float wn(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.0 - 2.0*f);
            return mix(mix(wh(i), wh(i + vec2(1, 0)), u.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), u.x), u.y); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          if (uWet > 0.001) {
            vec2 wuv = vMapUv;
            float e = min(min(wuv.x, 1.0 - wuv.x), min(wuv.y, 1.0 - wuv.y));        // 0 at the edge
            float blot = wn(wuv*6.0) * 0.6 + wn(wuv*15.0) * 0.4;
            float edgeWet = smoothstep(0.03 + 0.3*sqrt(uWet), 0.0, e + (blot - 0.5)*0.08);   // soaked rim, shrinking as it dries
            float inner = smoothstep(1.0 - uWet*0.9, 1.05 - uWet*0.9, blot + 0.25);          // patchy damp spots drying first
            float damp = clamp(edgeWet*min(1.0, uWet*1.8) + inner*uWet + uWet*0.35, 0.0, 1.0);   // soaked all over at first
            diffuseColor.rgb *= mix(vec3(1.0), vec3(0.58, 0.66, 0.76), damp);                 // wet paper: darker, a little see-through blue
            diffuseColor.rgb += vec3(0.1, 0.12, 0.14)*damp*smoothstep(0.55, 0.85, wn(wuv*5.0 + 3.0))*uWet;   // soft wet sheen
          }`);
    };
    this.paint();                                        // a blank sheet with a faint paper grain
    this.paper = new THREE.Mesh(this.geo, this.mat);
    this.paper.visible = false;
    this.paper.renderOrder = 50;
    this.paper.frustumCulled = false;
    scene.add(this.paper);

    this.lift = { u: 0.8, v: -0.6, amt: 0 };             // the corner near the typing lifts a little (amt decays)
    this.planeTarget = null;                             // () => {x, y} screen point of the chosen contact's circle
    this.onSent = null;                                  // (kind) → the letter arrived (circle catches it)
    this.sendKind = 'plane';
    this._buildBottle(scene);
    this._ray = new THREE.Raycaster();
    this._vel = new V3();
    this._held = null;
    this._lastRip = 0;
    this._bindPointer();
  }

  get active() { return this.mode !== 'idle'; }

  /** Redraw the paper: the stationery for `this.look`, plus (when sending) the whole letter `comp`. */
  paint(comp = null) {
    const cv = this.canvas, g = cv.getContext('2d'), w = cv.width, h = cv.height;
    if (!this._grain) {                                  // faint speckled paper fibres, made once
      const gc = document.createElement('canvas'); gc.width = w; gc.height = h;
      const gg = gc.getContext('2d'), img = gg.createImageData(w, h);
      let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < img.data.length; i += 4) { const v = 236 + rnd() * 18; img.data[i] = v; img.data[i + 1] = v - 1; img.data[i + 2] = v - 5; img.data[i + 3] = 40; }
      gg.putImageData(img, 0, 0);
      this._grain = gc;
    }
    const P = paintPaper(g, w, h, this.look, this._grain, comp, this.images);
    this.tex.needsUpdate = true;
    return P;
  }

  /** Screen rectangle (CSS px) the paper covers, from its four corners. */
  screenRect() {
    const r = this.dom.getBoundingClientRect(), P = this.paper; P.updateMatrixWorld();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of [[-PW / 2, -PH / 2], [PW / 2, -PH / 2], [PW / 2, PH / 2], [-PW / 2, PH / 2]]) {
      const v = new V3(x, y, 0).applyMatrix4(P.matrixWorld).project(this.camera);
      const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /** Start dragging the paper from a pointer event (used by the writing overlay above it). */
  grab(e) {
    if (this.mode !== 'card') return;
    this._pick(e);
    this._held = this._planePoint(); this._vel.set(0, 0, 0);
    this._heldId = e.pointerId;
    this._trail = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    this.setMode('held');
  }

  /** at: when the new stage starts (default now); passing the previous stage's scheduled end keeps the total exact at any frame rate. */
  setMode(m, at = this._now) { this.mode = m; this.t0 = at; this.onChange?.(m); }

  /** Start the sequence (only from idle). */
  start() {
    if (this.mode !== 'idle' || !this.boat.ready) return;
    this.boat.frozen = true;
    this._now = performance.now();                       // the clock starts at the tap itself
    this._flatten(); this.bottle.visible = false; this.shapeS = 0; this._shapeTarget = null;
    this.spot = new V3(this.boat.position.x, this.ocean.base, this.boat.position.y);
    this._lastRip = -1;
    this.setMode('sink');
  }

  /** Throw the paper back (button), with a default toss away from the camera. */
  throwBack() { this.send('plane'); }

  // --- shaping by hand (a letter with something on it) ------------------------------
  // shapeS: −1 = rolled up inside a bottle … 0 = the flat letter … +1 = folded into a paper plane.
  // The letter drives it with the finger (setShapeS), lets it settle (snapShape) and throws it (throwShape).

  /** Start shaping from the flat letter (card). */
  beginShape() {
    if (this.mode !== 'card') return false;
    this.shapeS = 0; this._shapeTarget = null; this.steer = 0; this._bank = 0; this._gust = null;
    this.setMode('shaping');
    return true;
  }

  setShapeS(v) { this.shapeS = Math.max(-1, Math.min(1, v)); this._shapeTarget = null; }

  /** Steer the folded plane with the finger (−1 left … +1 right): it banks its wings that way. */
  setSteer(v) { this.steer = Math.max(-1, Math.min(1, v)); }

  /** A strong gust shoves the plane sideways (dir −1 left, +1 right); just a nudge with reduced motion. */
  gust(dir) { this._gust = { dir: REDUCED ? dir * 0.3 : dir, t0: this._now }; }

  /** Rubber band at the ends of a fold / roll: how far (screen-down, world units) the finger pulls past the end. */
  setStretch(v) { this._stretchTo = v; }

  /**
   * Take a thrown letter back (while it flies, or just after it arrived): the paper
   * comes back flat in front of you to write on again.
   */
  unsend() {
    if (!['plane', 'bottle', 'reform'].includes(this.mode)) return false;
    const P = this.paper, B = this.boat, tg = this._cardTarget();
    B.group.visible = false; B.sinkY = -2.6; B.sinkRoll = 0.5; B.sinkPitch = 0.25; B.frozen = true;
    this.bottle.visible = false; this._planeEnd = null; this._gust = null; this.steer = 0; this._bank = 0;
    if (!P.visible) {                                                     // already arrived: it comes back from their circle
      const tgt = this.planeTarget?.() || { x: this.dom.clientWidth / 2, y: 60 };
      P.position.copy(this._screenToWorld(tgt.x, tgt.y, tg.D * 0.6)); P.quaternion.copy(tg.q);
    }
    this._flatten(); P.scale.setScalar(1); P.visible = true;
    this._fromP = P.position.clone(); this._fromQ = P.quaternion.clone();
    this._dry = true;                                                     // it never touched the water
    this.setMode('toScreen');
    return true;
  }

  /** Glide to −1, 0 or +1; back at 0 it is the flat letter again. */
  snapShape(target) { this._shapeTarget = target; }

  /** Throw the fully folded plane (+1) or the bottle (−1). */
  throwShape() {
    if (this.mode !== 'shaping') return;
    const P = this.paper;
    this._fromP = P.position.clone(); this._fromQ = P.quaternion.clone(); this._planeEnd = null;
    if (this.shapeS >= 0.99) { this.sendKind = 'plane'; this._shape('plane', 1); this.setMode('plane'); }
    else if (this.shapeS <= -0.99) {
      this.sendKind = 'bottle'; this._splashed = false; this._shape('bottle', 1);
      this.bottle.visible = true; this._placeBottle(1);
      this.setMode('bottle', this._now - 0.15 * DUR.bottle * 1000);          // already in its bottle: straight to the throw
    }
  }

  /** Send the letter: 'plane' (folds up and flies to the contact's circle) or 'bottle' (rolls up and drops into the sea). */
  send(kind = 'plane') {
    if (this.mode !== 'card' && this.mode !== 'held') return;
    this.sendKind = kind;
    this._fromP = this.paper.position.clone(); this._fromQ = this.paper.quaternion.clone();
    this.dom.style.cursor = '';
    this.setMode('fold');
  }

  /** Send the paper into the sea in a screen direction (sx, sy: −1 … 1, y down) at `speed`. */
  flick(sx, sy) { this.send(sy < 0 ? 'plane' : 'bottle'); }   // up: paper plane, down: bottle

  _cardTarget() {
    // sits below the avatar row: ~58% of the height, centred well below the middle
    const c = this.camera, tf = Math.tan(THREE.MathUtils.degToRad(c.fov) / 2);
    const D = Math.max(PH / (2 * tf * 0.58), PW / (2 * tf * c.aspect * 0.86));
    const down = 2 * D * tf * 0.115;
    const p = new V3(0, -down, -D).applyQuaternion(c.quaternion).add(c.position);
    return { p, q: c.quaternion.clone(), D };
  }

  _bend(t, amp) {
    const a = this.geo.attributes.position, b = this.base;
    for (let i = 0; i < a.count; i++) {
      const x = b[i * 3], y = b[i * 3 + 1];
      a.setZ(i, amp * (0.22 * Math.sin(x * 2.6 + t * 9) + 0.16 * Math.sin(y * 2.1 - t * 7 + x) + 0.16 * x * x));
    }
    a.needsUpdate = true;
  }

  /** Water drips off the lower edge of the wet paper (handed to the app's spray). */
  _drip(dt, P, every) {
    if (!this.onDrip || this.wet.value < 0.2) return;
    if ((this._dripAt -= dt) > 0) return;
    this._dripAt = every * (0.6 + Math.random() * 0.8) / Math.max(this.wet.value, 0.3);
    P.updateMatrixWorld();
    // the lowest corner/edge of the sheet right now
    let low = null;
    for (const x of [-PW / 2, -PW / 4, 0, PW / 4, PW / 2]) for (const y of [-PH / 2, PH / 2]) {
      const v = new V3(x, y, 0).applyMatrix4(P.matrixWorld);
      if (!low || v.y < low.y) low = v;
    }
    this.onDrip(low);
  }

  _ripples(k, every, strength) {
    if (this._now - this._lastRip > every) {
      this._lastRip = this._now;
      for (let i = 0; i < 2; i++) this.ocean.addRipple(this.spot.x + (Math.random() - 0.5) * 1.2, this.spot.z + (Math.random() - 0.5) * 1.2, strength);
    }
  }

  _glass() { return this.bottle.children[0].material; }

  /** The letter is on its way: put the paper away and bring the boat back up. */
  _arrive() {
    const P = this.paper;
    P.visible = false; this._flatten();
    this.ocean.addRipple(this.spot.x, this.spot.z, 1);
    this.boat.group.visible = true;
    this._lastRip = -1;
    this.setMode('reform');
  }

  /** Card pose bend: a faint ripple across the sheet plus the lifted corner near the typing. */
  _bendCard(t) {
    const a = this.geo.attributes.position, b = this.base, L = this.lift;
    const cx = Math.sign(L.u || 1) * PW / 2, cy = Math.sign(L.v || -1) * PH / 2;
    for (let i = 0; i < a.count; i++) {
      const x = b[i * 3], y = b[i * 3 + 1];
      const wave = 0.02 * (0.22 * Math.sin(x * 2.6 + t * 2) + 0.16 * Math.sin(y * 2.1 - t * 1.6 + x));
      const d = Math.hypot(x - cx, y - cy), c = Math.max(0, 1 - d / 0.9);
      a.setZ(i, wave + L.amt * 0.16 * c * c);
    }
    a.needsUpdate = true;
  }

  /** Morph the sheet: 0 = flat paper, 1 = folded into a paper plane ('plane') or rolled up into a scroll ('bottle'). */
  _shape(kind, k) {
    if (kind === 'plane') { this._foldPlane(k); this._shade(k > 0); } else { this._rollUp(k); this._shade(false); }
  }

  /** Soft light from the upper right on the folded paper, so the wings, folds and keel read in 3D (plain white when off). */
  _shade(on) {
    const c = this.geo.attributes.color;
    if (!on) { if (this._shaded) { c.array.fill(1); c.needsUpdate = true; this._shaded = false; } return; }
    // vertex normals, each face added with its sign matched to what the vertex has so far: a folded-over
    // flap faces the other way, and plain averaging would cancel out along the crease (a sawtooth of shade)
    const pos = this.geo.attributes.position.array, idx = this.geo.index.array;
    const acc = this._nacc || (this._nacc = new Float32Array(pos.length)); acc.fill(0);
    for (let f = 0; f < idx.length; f += 3) {
      const a = idx[f] * 3, b = idx[f + 1] * 3, d = idx[f + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[d] - pos[a], vy = pos[d + 1] - pos[a + 1], vz = pos[d + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const o of [a, b, d]) {
        const sg = acc[o] * nx + acc[o + 1] * ny + acc[o + 2] * nz < 0 ? -1 : 1;
        acc[o] += sg * nx; acc[o + 1] += sg * ny; acc[o + 2] += sg * nz;
      }
    }
    const lx = 0.25, ly = 0.18, lz = 0.95;                                              // mostly from the front: the keel and side panels read darker
    for (let i = 0; i < c.count; i++) {
      const o = i * 3, l = Math.hypot(acc[o], acc[o + 1], acc[o + 2]) || 1;
      const v = Math.min(1, 0.36 + 0.68 * Math.abs((acc[o] * lx + acc[o + 1] * ly + acc[o + 2] * lz) / l));
      const ln = this._crease?.[i] ? 0.86 : 1;                                          // a faint line along every fold
      c.setXYZ(i, v * ln, v * ln, v * ln * 1.01);
    }
    c.needsUpdate = true; this._shaded = true;
  }

  /**
   * A classic paper dart in 8 folds (k 0 … 1, one eighth each), the paper
   * facing you, nose at the top:
   *   1 fold in half lengthwise and open it again (a crease)
   *   2, 3 fold the top corners in to the centre line
   *   4, 5 fold the new slanted edges in to the centre line again
   *   6 fold it in half (the halves go back, away from you)
   *   7, 8 fold each wing down, level
   * Folds 1-5 are flat folds: the flap swings over toward you about its crease
   * and lies on top. Each vertex is folded in order, so later folds carry the
   * earlier flaps along. Once a fold starts, the points right next to its
   * crease snap onto the crease line, so every fold edge is perfectly straight
   * (instead of following the grid in steps). The wings spread a little and end slightly raised.
   */
  _foldPlane(k) {
    const a = this.geo.attributes.position, b = this.base, hw = PW / 2, hh = PH / 2, d = 0.27;
    const snap = 1.01 * Math.hypot(PW / 72, PH / 90);                   // ≥ the longest triangle edge: no triangle can straddle a crease unbent
    const st = i => Math.min(1, Math.max(0, k * 8 - i));                 // progress of fold i (0-based)
    const e = i => { const x = st(i); return x * x * (3 - 2 * x); };
    const s22 = Math.sin(Math.PI / 8), c22 = Math.cos(Math.PI / 8), r2 = Math.SQRT1_2;
    // flat folds: [line point, line direction, which side moves (sign of cross)]
    const flats = [
      null,                                                               // 1: the crease (opened again)
      [0, hh, -r2, -r2, -1], [0, hh, r2, -r2, 1],                         // 2, 3: top corners to the centre
      [0, hh, -s22, -c22, -1], [0, hh, s22, -c22, 1],                     // 4, 5: slanted edges to the centre
    ];
    const cz = this._crease || (this._crease = new Uint8Array(a.count)); cz.fill(0);   // vertices on a fold line
    for (let n = 0; n < a.count; n++) {
      let qx = b[n * 3], qy = b[n * 3 + 1], qz = 0, out = null;
      // 1: fold the right half over to the left and open it again
      const p1 = st(0);
      if (p1 > 0 && Math.abs(qx) < snap) { qx = 0; cz[n] = 1; }          // onto the centre crease
      if (p1 > 0 && p1 < 1 && qx > 0) { const th = Math.PI * 0.94 * Math.sin(Math.PI * p1); out = [qx * Math.cos(th), qy, qx * Math.sin(th)]; }
      // 2-5: flat folds, each flap swinging over toward you onto the paper
      for (let i = 1; i <= 4 && !out; i++) {
        const p = st(i); if (p <= 0) break;
        const [ax, ay, dx, dy, sgn] = flats[i];
        let vx = qx - ax, vy = qy - ay, cr = dx * vy - dy * vx;
        if (Math.abs(cr) < snap) { qx -= -dy * cr; qy -= dx * cr; cz[n] = 1; continue; }   // onto the crease: a straight fold edge
        if (cr * sgn <= 0) continue;                                      // not on the moving side
        const pr = vx * dx + vy * dy, px = vx - pr * dx, py = vy - pr * dy, pl = Math.hypot(px, py) || 1e-6;
        if (p < 1) {                                                      // part-way: lifting about the crease
          const th = Math.PI * e(i), cx = ax + pr * dx, cy = ay + pr * dy;
          out = [cx + px * Math.cos(th), cy + py * Math.cos(th), qz + pl * Math.sin(th)];
        } else { qx = ax + pr * dx - px; qy = ay + pr * dy - py; qz += 0.0035; }   // done: mirrored, on top
      }
      // 6-8: fold in half (halves swing back), then each wing down
      if (!out && st(5) > 0) {
        if (Math.abs(qx) < snap) qx = 0;                                  // onto the centre (keel) crease
        const phi = e(5) * (Math.PI / 2 - 0.22 * Math.pow(Math.min(1, Math.max(0, (hh - qy) / PH)), 3)), side = qx >= 0 ? 1 : -1, psi = side > 0 ? e(7) : e(6);   // the keel stays shut (stuck together) most of the way and opens only toward the tail
        let u = Math.abs(qx); if (Math.abs(u - d) < snap && psi > 0) { u = d; cz[n] = 1; }  // onto the wing crease
        else if (u < d - snap) cz[n] = 0;                                 // inside the keel: no fold lines (they'd dot the top seam)
        let X, Z;
        if (u <= d || psi === 0) { X = side * u * Math.cos(phi); Z = -u * Math.sin(phi); }
        else {
          const fx = side * d * Math.cos(phi), fz = -d * Math.sin(phi), w = u - d;
          let a1 = Math.atan2(-Math.sin(phi), side * Math.cos(phi)); if (side < 0 && a1 > 0) a1 -= 2 * Math.PI;
          const al = a1 + ((side > 0 ? DIHEDRAL : -Math.PI - DIHEDRAL) - a1) * psi;   // wings end a little raised
          X = fx + w * Math.cos(al) * (1 + 0.2 * psi); Z = fz + w * Math.sin(al);   // wings spread a little: a broad dart
        }
        out = [X + (qx === 0 ? 0 : side) * qz * Math.sin(phi), qy, Z + qz * Math.cos(phi)];   // the seam itself isn't pushed to one side
      }
      if (!out) out = [qx, qy, qz];
      a.setXYZ(n, out[0], out[1], out[2]);
    }
    a.needsUpdate = true;
  }

  /**
   * Roll the letter up from its bottom edge toward the top (k 0 … 1): the rolled
   * part is a tight spiral curling toward you, the rest stays flat. The sheet is
   * kept centred, so the finished scroll sits where the letter was (its axis
   * runs across the paper, along local x).
   */
  _rollUp(k) {
    const a = this.geo.attributes.position, b = this.base, hh = PH / 2, R0 = 0.11, L = k * PH;
    for (let n = 0; n < a.count; n++) {
      const x = b[n * 3], y = b[n * 3 + 1], l = y + hh;                // distance from the bottom edge
      let Y = y, Z = 0;
      if (l < L) {                                                       // already rolled up
        const arc = L - l, th = arc / R0, r = R0 * (1 - 0.07 * th / (2 * Math.PI));   // inner turns a little tighter
        Y = -hh + L - r * Math.sin(th); Z = R0 - r * Math.cos(th);
      }
      a.setXYZ(n, x, Y - L / 2, Z - R0 * k);
    }
    a.needsUpdate = true;
  }

  /** The bottle round the scroll: same place, turned to lie along the scroll (local x). */
  _placeBottle(scale) {
    const P = this.paper, Bt = this.bottle;
    Bt.position.copy(P.position);
    Bt.quaternion.copy(P.quaternion).multiply(this._bottleTurn || (this._bottleTurn = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), -Math.PI / 2)));
    Bt.scale.setScalar(Math.max(0.01, scale) * 1.45 * P.scale.x);      // sized to the scroll inside it
  }

  _flatten() { this._shade(false); this.geo.attributes.position.array.set(this.base); this.geo.attributes.position.needsUpdate = true; this.paper.scale.setScalar(1); }

  _buildBottle(scene) {
    // a little glass bottle with a cork, slipped round the rolled-up letter
    const prof = [[0, -0.56], [0.3, -0.55], [0.33, -0.48], [0.33, 0.26], [0.3, 0.36], [0.15, 0.48], [0.12, 0.58], [0.14, 0.62], [0.12, 0.66]].map(([x, y]) => new THREE.Vector2(x, y));
    const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), new THREE.MeshStandardMaterial({ color: '#bfe7ea', transparent: true, opacity: 0.38, roughness: 0.08, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.14, 16), new THREE.MeshStandardMaterial({ color: '#b07a45', roughness: 0.9 }));
    cork.position.y = 0.7;
    this.bottle = new THREE.Group(); this.bottle.add(glass, cork);
    this.bottle.visible = false; this.bottle.renderOrder = 51; glass.renderOrder = 51;
    scene.add(this.bottle);
  }

  /** World point just in front of the camera under a screen point (for the plane to fly into a contact's circle). */
  _screenToWorld(sx, sy, dist) {
    const r = this.dom.getBoundingClientRect();
    this._ray.setFromCamera(new THREE.Vector2(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1), this.camera);
    return this._ray.ray.at(dist, new V3());
  }

  update(dt, now) {
    this._now = now;
    if (this.mode === 'idle') return;
    const t = (now - this.t0) / 1000, B = this.boat, P = this.paper;

    if (this.mode === 'sink') {
      const k = Math.min(1, t / DUR.sink);
      B.sinkRoll = 0.5 * ease(Math.min(1, k * 1.6));                       // lists to one side
      B.sinkPitch = Math.sin(t * 3) * 0.08 * (1 - k) + 0.25 * k;           // stern goes first
      B.sinkY = 0.08 * Math.sin(t * 4) * (1 - k) - 2.6 * Math.pow(k, 2.2);
      this._ripples(k, 450, 0.9);
      if (k >= 1) {
        B.group.visible = false;
        P.visible = true;
        this.paint();
        const s = this.spot, c = this.camera.position;
        const mid = s.clone().lerp(c, 0.42);
        this._flight = new THREE.CatmullRomCurve3([
          s.clone().setY(this.ocean.base - 0.3), s.clone().add(new V3(0.3, 1.6, 0.3)),
          s.clone().add(new V3(-0.8, 3.2, 0.9)), mid,
        ]);
        this.ocean.addRipple(s.x, s.z, 1);
        this.wet.value = 1;                                            // comes out soaked
        this.setMode('fly', this.t0 + DUR.sink * 1000);
      }
    } else if (this.mode === 'fly') {
      // like a leaf on the wind: rising in pulses along the flight path, it swings
      // side to side, tilts into each swing, dips at the end of it, flips over
      // once on the way up and drifts with the wind
      const k = Math.min(1, t / DUR.fly);
      const along = 1 - Math.pow(1 - k, 1.5);
      const base = this._flight.getPoint(along);
      const right = new V3(1, 0, 0).applyQuaternion(this.camera.quaternion).setY(0).normalize();
      const ph = t * 3.8, swing = Math.sin(ph), amp = 0.25 + 0.75 * Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5);   // swings grow once clear of the water
      const fade = 1 - smoothstep(0.75, 1, k);                     // calms down as it nears you
      const w = this.getWind?.() || { dir: [1, 0], strength: 0.3 };
      const drift = k * k * (0.4 + w.strength * 1.6) * fade;
      P.position.copy(base)
        .addScaledVector(right, swing * 0.9 * amp * fade)
        .add(new V3(0, -Math.abs(Math.cos(ph)) * 0.35 * amp * fade + 0.18 * amp * fade, 0))   // dips at the end of each swing
        .add(new V3(w.dir[0] * drift, 0, w.dir[1] * drift));
      const flip = Math.PI * 2 * smoothstep(0.32, 0.62, k);         // one full flip over, mid-flight
      const roll = -Math.cos(ph) * 0.75 * amp * fade;               // leans into the swing
      const pitch = Math.sin(ph * 2) * 0.25 * amp * fade;
      const yaw = Math.sin(t * 0.8) * 0.5 + Math.atan2(w.dir[0], w.dir[1]) * 0.15 * k;
      P.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2 + pitch + flip, yaw, roll, 'YXZ'));
      this._bend(t, Math.min(1, 0.35 + Math.abs(Math.cos(ph)) * 0.6) * (0.4 + 0.6 * fade));   // curls as it catches the air
      this.wet.value = 1 - smoothstep(0.35, 1.0, k) * 0.55;            // starts drying in the air
      this._drip(dt, P, k < 0.85 ? 0.06 : 0.14);
      if (k >= 1) { this._fromP = P.position.clone(); this._fromQ = P.quaternion.clone(); this.setMode('toScreen', this.t0 + DUR.fly * 1000); }
    } else if (this.mode === 'toScreen') {
      const k = ease(Math.min(1, t / DUR.toScreen)), tg = this._cardTarget();
      P.position.lerpVectors(this._fromP, tg.p, k);
      P.quaternion.slerpQuaternions(this._fromQ, tg.q, k);
      this._bend(t, 0.6 * (1 - k));
      this.wet.value = this._dry ? 0 : 0.45 - 0.2 * k;
      if (!this._dry) this._drip(dt, P, 0.2);
      if (k >= 1) this.setMode('hover', this.t0 + DUR.toScreen * 1000);
    } else if (this.mode === 'hover') {
      // a short pause in front of you: a little springy bounce and a gentle sway, then it settles
      const k = Math.min(1, t / DUR.hover), tg = this._cardTarget();
      const up = new V3(0, 1, 0).applyQuaternion(tg.q), rt = new V3(1, 0, 0).applyQuaternion(tg.q);
      const bounce = 0.16 * Math.exp(-t * 5) * Math.cos(t * 14);
      const sway = Math.sin(t * 4.6) * Math.exp(-t * 3.4);
      P.position.copy(tg.p).addScaledVector(up, bounce).addScaledVector(rt, sway * 0.07);
      P.quaternion.copy(tg.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(bounce * 0.8, sway * 0.1, -sway * 0.12)));
      this._bend(t, 0.25 * Math.exp(-t * 4) + 0.02);
      this.wet.value = this._dry ? 0 : 0.25 * (1 - k);                   // the last damp edges dry off
      if (k >= 1) { this.wet.value = 0; this._dry = false; this.setMode('card', this.t0 + DUR.hover * 1000); }
    } else if (this.mode === 'card') {
      // the paper breathes: it rises and falls gently with the waves under it, and
      // the corner nearest where you're typing lifts a little
      const tg = this._cardTarget(), sw = Math.sin(t * 1.1), sw2 = Math.sin(t * 0.7 + 1);
      P.position.copy(tg.p).add(new V3(Math.sin(t * 0.5) * 0.02, sw * 0.055 + sw2 * 0.02, 0).applyQuaternion(tg.q));
      P.quaternion.copy(tg.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(sw * 0.035, Math.sin(t * 0.9) * 0.04, Math.sin(t * 0.6) * 0.015)));
      this.lift.amt *= Math.exp(-dt * 1.6);
      this._bendCard(t);
    } else if (this.mode === 'held') {
      const tg = this._cardTarget(), before = P.position.clone();
      P.position.lerp(this._held, 1 - Math.exp(-18 * dt));
      if (dt > 0) this._vel.lerp(P.position.clone().sub(before).divideScalar(dt), 0.35);
      const local = this._vel.clone().applyQuaternion(tg.q.clone().invert());
      P.quaternion.copy(tg.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-local.y * 0.05, local.x * 0.05, -local.x * 0.03)));
      this._bend(t, Math.min(0.5, this._vel.length() * 0.04));
    } else if (this.mode === 'shaping') {
      // folded / rolled by hand: the shape follows shapeS; a little lift as a plane, a dip toward the bottle
      if (this._shapeTarget != null) {
        const d = this._shapeTarget - this.shapeS;
        this.shapeS += d * Math.min(1, dt * 9);
        if (Math.abs(d) < 0.004) {
          this.shapeS = this._shapeTarget; this._shapeTarget = null;
          if (this.shapeS === 0) { this._flatten(); this.bottle.visible = false; this.setMode('card'); return; }
        }
      }
      const sv = this.shapeS, tg = this._cardTarget(), sw = Math.sin(t * 1.1) * (1 - Math.abs(sv) * 0.6);
      const up = new V3(0, 1, 0).applyQuaternion(tg.q);
      P.position.copy(tg.p).addScaledVector(up, sw * 0.05 + (sv > 0 ? 0.25 * sv : 0));
      // steering: the wings bank toward the finger; a gust shoves it sideways, yawing and fluttering
      this._bank = (this._bank || 0) + ((this.steer || 0) * (sv >= 0.99 ? 1 : 0) - (this._bank || 0)) * Math.min(1, dt * 8);
      let gx = 0, gYaw = 0, gRoll = 0, gFl = 0;
      if (this._gust) {
        const tau = (this._now - this._gust.t0) / 1000, p = Math.min(1, tau / 0.9), env = Math.sin(Math.PI * Math.pow(p, 0.5));
        gx = this._gust.dir * 0.42 * env; gYaw = -this._gust.dir * 0.35 * env; gRoll = this._gust.dir * 0.35 * env;
        gFl = Math.sin(tau * 38) * 0.06 * env;
        if (p >= 1) this._gust = null;
      }
      P.position.addScaledVector(new V3(1, 0, 0).applyQuaternion(tg.q), gx);
      this._stretch = (this._stretch || 0) + ((this._stretchTo || 0) - (this._stretch || 0)) * Math.min(1, dt * 16);
      P.position.addScaledVector(up, -this._stretch);                    // pulled past the end: it gives a little, then springs back
      P.quaternion.copy(tg.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(sw * 0.03 + gFl, Math.sin(t * 0.9) * 0.04 * (1 - Math.abs(sv)), sv > 0 ? Math.sin(t * 1.4) * 0.05 * sv + gYaw : 0)));   // a plane dips its nose away from you
      if (sv > 0) P.quaternion.multiply(planeQ(sv, 0.55 * this._bank + gRoll));   // nose away, turned over, banking about its nose (steer right: left wing up)
      const Bt = this.bottle;
      P.scale.setScalar(sv >= 0 ? 1 - (1 - PLANE_SCALE) * sv : 1 - (1 - BOTTLE_SCALE) * Math.min(1, -sv / 0.72));   // the plane / the bottle fit comfortably on screen
      if (sv > 0) { this._shape('plane', sv); Bt.visible = false; }          // the finger moves straight through the 8 folds
      else if (sv < 0) {
        const roll = Math.min(1, -sv / 0.72), close = Math.max(0, (-sv - 0.72) / 0.28);   // roll up, then the bottle closes round it
        this._shape('bottle', roll);
        Bt.visible = close > 0;
        if (Bt.visible) { this._placeBottle(backOut(close)); this._glass().opacity = 0.38; }
      } else { this._bendCard(t); Bt.visible = false; }
    } else if (this.mode === 'fold') {
      // fold into a paper plane, or roll up into a scroll
      const k = Math.min(1, t / DUR.fold), up = new V3(0, 1, 0).applyQuaternion(this.camera.quaternion);
      this._shape(this.sendKind, k);
      P.position.copy(this._fromP).addScaledVector(up, (this.sendKind === 'plane' ? 0.25 : 0) * k);
      P.quaternion.copy(this._fromQ);
      if (this.sendKind === 'plane') { P.quaternion.multiply(planeQ(k)); P.scale.setScalar(1 - (1 - PLANE_SCALE) * k); }
      else P.scale.setScalar(1 - (1 - BOTTLE_SCALE) * k);
      if (t >= DUR.fold) {
        this._fromP = P.position.clone(); this._fromQ = P.quaternion.clone();
        if (this.sendKind === 'bottle') { this.bottle.visible = true; this._placeBottle(0.01); this._glass().opacity = 0.38; }
        this.setMode(this.sendKind, this.t0 + DUR.fold * 1000);
      }
    } else if (this.mode === 'plane') {
      // the paper plane flies up into the chosen contact's circle at the top of the screen
      const k = Math.min(1, t / DUR.plane), e = k * k * (3 - 2 * k);
      if (!this._planeEnd) {
        this._s0 = P.scale.x;                                              // shrink from the size it was folded at
        const tgt = this.planeTarget?.() || { x: this.dom.clientWidth / 2, y: 60 };
        this._planeEnd = this._screenToWorld(tgt.x, tgt.y, this._cardTarget().D * 0.6);
        const cu = new V3(0, 1, 0).applyQuaternion(this.camera.quaternion), cr = new V3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        this._planeMid = this._fromP.clone().lerp(this._planeEnd, 0.5).addScaledVector(cu, 0.6).addScaledVector(cr, 0.9);
      }
      const a = this._fromP, m = this._planeMid, z = this._planeEnd;
      const pos = new V3().copy(a).multiplyScalar((1 - e) * (1 - e)).addScaledVector(m, 2 * (1 - e) * e).addScaledVector(z, e * e);
      const fwd = new V3().copy(m).sub(a).multiplyScalar(2 * (1 - e)).addScaledVector(new V3().copy(z).sub(m), 2 * e).normalize();
      const toCam = new V3().subVectors(this.camera.position, pos).normalize();          // its top faces you, wings spread
      const right = new V3().crossVectors(fwd, toCam).normalize(), top = new V3().crossVectors(right, fwd);
      P.position.copy(pos);
      const qF = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, fwd, top))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -PLANE_TILT * 0.8))            // nose still dipped away from you
        .multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), Math.PI + Math.sin(k * Math.PI * 2) * 0.45));   // top up, banking as it swoops
      P.quaternion.slerpQuaternions(this._fromQ, qF, smoothstep(0, 0.3, k));                              // turns smoothly from how you held it
      P.scale.setScalar(this._s0 * (1 - 0.72 * e));
      if (k >= 1) { this._planeEnd = null; this.onSent?.('plane'); this._arrive(); }
    } else if (this.mode === 'bottle') {
      // a glass bottle closes round the scroll, drops into the sea, bobs and sinks away
      const k = Math.min(1, t / DUR.bottle), Bt = this.bottle, s = this.spot;
      const water = this.ocean.base;
      const side = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0.4, 0));   // lying on the water (the scroll runs along local x)
      let sc = 1;
      if (k < 0.15) {
        sc = backOut(k / 0.15);
        P.position.copy(this._fromP);
      } else if (k < 0.55) {
        const f = (k - 0.15) / 0.4, end = s.clone().setY(water + 0.15);
        P.position.lerpVectors(this._fromP, end, f).add(new V3(0, Math.sin(f * Math.PI) * 0.8, 0));
        P.quaternion.slerpQuaternions(this._fromQ, side, f);
        if (!this._splashed && f > 0.97) { this._splashed = true; this.ocean.addRipple(s.x, s.z, 1); this.onSplash?.(end); }
      } else {
        const f = (k - 0.55) / 0.45;
        P.position.copy(s).setY(water + 0.15 + Math.sin(f * 9) * 0.06 * (1 - f) - Math.max(0, f - 0.55) * 1.4);
        P.quaternion.copy(side).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(f * 7) * 0.15, 0, Math.sin(f * 5) * 0.1)));
        if (f > 0.55) this._glass().opacity = 0.38 * (1 - (f - 0.55) / 0.45);
      }
      this._placeBottle(sc);
      if (k >= 1) { this._splashed = false; Bt.visible = false; this.onSent?.('bottle'); this._arrive(); }
    } else if (this.mode === 'reform') {
      const k = Math.min(1, t / DUR.reform), b = backOut(k);
      B.sinkY = -2.2 * (1 - b);
      B.sinkRoll = 0.35 * (1 - b);
      B.sinkPitch = Math.sin(t * 4) * 0.06 * (1 - k);
      if (k < 0.6) this._ripples(k, 500, 0.8);
      if (k >= 1) {
        B.sinkY = B.sinkRoll = B.sinkPitch = 0;
        B.frozen = false;
        this.setMode('idle');
      }
    }
  }

  // drag-and-flick the paper once it is on screen
  _pick(e) {
    const r = this.dom.getBoundingClientRect();
    this._ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    return this.paper.visible && this._ray.intersectObject(this.paper).length > 0;
  }

  _planePoint() {
    const tg = this._cardTarget(), n = new V3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return this._ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, tg.p), new V3()) || tg.p;
  }

  _bindPointer() {
    const dom = this.dom;
    dom.addEventListener('pointerdown', e => {
      if (this.mode !== 'card' || !this._pick(e)) return;
      this._held = this._planePoint(); this._vel.set(0, 0, 0);
      this._heldId = e.pointerId;
      this._trail = [{ x: e.clientX, y: e.clientY, t: performance.now() }];   // finger samples for the flick
      dom.setPointerCapture?.(e.pointerId);
      dom.style.cursor = 'grabbing';
      this.setMode('held');
      e.stopImmediatePropagation(); e.preventDefault();
    }, { capture: true });
    window.addEventListener('pointermove', e => {
      if (this.mode === 'held' && e.pointerId === this._heldId) {
        this._pick(e); this._held = this._planePoint();
        this._trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (this._trail.length > 12) this._trail.shift();
        return;
      }
      if (this.mode === 'card' && e.target === dom) dom.style.cursor = this._pick(e) ? 'grab' : '';
    });
    const up = e => {
      if (this.mode !== 'held' || e.pointerId !== this._heldId) return;
      dom.style.cursor = '';
      // judge the flick from the finger itself (not the paper, which trails behind on slow devices)
      const now = performance.now(), tr = this._trail, first = tr[0], end = { x: e.clientX, y: e.clientY };
      const recent = tr.find(q => now - q.t < 120) || tr[tr.length - 1];
      const dtS = Math.max(0.016, (now - recent.t) / 1000);
      const vx = (end.x - recent.x) / dtS, vy = (end.y - recent.y) / dtS;          // px / s
      const size = Math.min(dom.clientWidth, dom.clientHeight) || 1;
      const dragged = Math.hypot(end.x - first.x, end.y - first.y);
      const fast = Math.hypot(vx, vy) > size * 1.2, far = dragged > size * 0.18;
      if (fast || far) {
        // screen direction → world, using the camera's right / up
        let sx = fast ? vx : end.x - first.x, sy = fast ? vy : end.y - first.y;
        const len = Math.hypot(sx, sy) || 1; sx /= len; sy /= len;
        this.send(sy < 0 ? 'plane' : 'bottle');                             // up: paper plane, down: bottle
      } else this.setMode('card');                                          // not flicked: settle back
    };
    window.addEventListener('pointerup', up, { capture: true });
    window.addEventListener('pointercancel', up, { capture: true });
  }
}
