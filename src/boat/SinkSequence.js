import * as THREE from 'three';

// Click the boat → it sinks → a wet sheet of paper flutters up out of the
// water like a leaf on the wind (dripping, drying as it rises), hovers in front
// of you with a little bounce and settles onto the screen. Drag and flick the paper (or press Esc)
// and it sails back into the sea, and the boat bobs back up.
// Adapted from the "sink → paper → catch → throw → re-form" sequence in the
// Tugboat.html prototype.

const V3 = THREE.Vector3;
export const PW = 1.6, PH = 2.0;                            // paper size (world units)
const DUR = { sink: 2.6, fly: 2.8, toScreen: 0.9, hover: 1.4, thrown: 1.3, reform: 2.2 };

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const backOut = k => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const tumbleQ = t => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + t * 3.4, t * 1.9 + Math.sin(t * 2.6) * 0.9, Math.sin(t * 2.1) * 1.3));

export class SinkSequence {
  /**
   * @param {{ scene, camera, dom, boat, ocean, onChange?: (mode: string) => void,
   *          getWind?: () => { dir: number[], strength: number }, onDrip?: (pos: THREE.Vector3) => void }} o
   */
  constructor({ scene, camera, dom, boat, ocean, onChange, getWind = null, onDrip = null }) {
    Object.assign(this, { scene, camera, dom, boat, ocean, onChange, getWind, onDrip });
    this._dripAt = 0;
    this.mode = 'idle';
    this.t0 = 0;

    this.geo = new THREE.PlaneGeometry(PW, PH, 18, 24);
    this.base = this.geo.attributes.position.array.slice();
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640; this.canvas.height = Math.round(640 * PH / PW);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, side: THREE.DoubleSide });
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

    this._ray = new THREE.Raycaster();
    this._vel = new V3();
    this._held = null;
    this._lastRip = 0;
    this._bindPointer();
  }

  get active() { return this.mode !== 'idle'; }

  /** Redraw the paper: grain, plus optional handwriting (so the words fly away with it). */
  paint(text = '', font = 'Caveat') {
    const cv = this.canvas, g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.fillStyle = '#fbf9f3'; g.fillRect(0, 0, w, h);
    if (!this._grain) {                                  // faint speckled paper fibres, made once
      const gc = document.createElement('canvas'); gc.width = w; gc.height = h;
      const gg = gc.getContext('2d'), img = gg.createImageData(w, h);
      let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < img.data.length; i += 4) { const v = 236 + rnd() * 18; img.data[i] = v; img.data[i + 1] = v - 1; img.data[i + 2] = v - 5; img.data[i + 3] = 40; }
      gg.putImageData(img, 0, 0);
      this._grain = gc;
    }
    g.drawImage(this._grain, 0, 0);
    if (text) {
      const size = w * 0.066;
      g.fillStyle = '#3d4aa3'; g.textAlign = 'center'; g.textBaseline = 'top';
      g.font = `500 ${size}px "${font}", "Comic Sans MS", cursive`;
      const maxW = w * 0.82, lines = [];
      for (const para of text.split('\n')) {
        let line = '';
        for (const word of para.split(' ')) {
          const test = line ? line + ' ' + word : word;
          if (g.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
        }
        lines.push(line);
      }
      lines.slice(0, 12).forEach((l, i) => g.fillText(l, w / 2, h * 0.12 + i * size * 1.25));
    }
    this.tex.needsUpdate = true;
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

  setMode(m) { this.mode = m; this.t0 = this._now; this.onChange?.(m); }

  /** Start the sequence (only from idle). */
  start() {
    if (this.mode !== 'idle' || !this.boat.ready) return;
    this.boat.frozen = true;
    this.spot = new V3(this.boat.position.x, this.ocean.base, this.boat.position.y);
    this._lastRip = -1;
    this.setMode('sink');
  }

  /** Throw the paper back (button), with a default toss away from the camera. */
  throwBack() {
    if (this.mode !== 'card' && this.mode !== 'held') return;
    const fwd = new V3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this._startThrow(fwd.multiplyScalar(7).add(new V3(0, 2, 0)));
  }

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

  _startThrow(v) {
    const p0 = this.paper.position.clone(), end = this.spot.clone().setY(this.ocean.base - 0.2);
    this._curve = new THREE.QuadraticBezierCurve3(p0, p0.clone().addScaledVector(v, 0.45).add(new V3(0, 1.6, 0)), end);
    this._fromQ = this.paper.quaternion.clone();
    this.dom.style.cursor = '';
    this.setMode('thrown');
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
        this.setMode('fly');
      }
    } else if (this.mode === 'fly') {
      // like a leaf on the wind: rising in pulses along the flight path, it swings
      // side to side, tilts into each swing, dips at the end of it, flips over
      // once on the way up and drifts with the wind
      const k = Math.min(1, t / DUR.fly);
      const along = 1 - Math.pow(1 - k, 1.5);
      const base = this._flight.getPoint(along);
      const right = new V3(1, 0, 0).applyQuaternion(this.camera.quaternion).setY(0).normalize();
      const ph = t * 2.7, swing = Math.sin(ph), amp = 0.25 + 0.75 * Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5);   // swings grow once clear of the water
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
      if (k >= 1) { this._fromP = P.position.clone(); this._fromQ = P.quaternion.clone(); this.setMode('toScreen'); }
    } else if (this.mode === 'toScreen') {
      const k = ease(Math.min(1, t / DUR.toScreen)), tg = this._cardTarget();
      P.position.lerpVectors(this._fromP, tg.p, k);
      P.quaternion.slerpQuaternions(this._fromQ, tg.q, k);
      this._bend(t, 0.6 * (1 - k));
      this.wet.value = 0.45 - 0.2 * k;
      this._drip(dt, P, 0.2);
      if (k >= 1) this.setMode('hover');
    } else if (this.mode === 'hover') {
      // a short pause in front of you: a little springy bounce and a gentle sway, then it settles
      const k = Math.min(1, t / DUR.hover), tg = this._cardTarget();
      const up = new V3(0, 1, 0).applyQuaternion(tg.q), rt = new V3(1, 0, 0).applyQuaternion(tg.q);
      const bounce = 0.16 * Math.exp(-t * 3.2) * Math.cos(t * 9.5);
      const sway = Math.sin(t * 3.1) * Math.exp(-t * 1.8);
      P.position.copy(tg.p).addScaledVector(up, bounce).addScaledVector(rt, sway * 0.07);
      P.quaternion.copy(tg.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(bounce * 0.8, sway * 0.1, -sway * 0.12)));
      this._bend(t, 0.25 * Math.exp(-t * 2.5) + 0.02);
      this.wet.value = 0.25 * (1 - k);                                  // the last damp edges dry off
      if (k >= 1) { this.wet.value = 0; this.setMode('card'); }
    } else if (this.mode === 'card') {
      const tg = this._cardTarget();
      P.position.copy(tg.p).add(new V3(0, Math.sin(t * 1.6) * 0.03, 0).applyQuaternion(tg.q));
      P.quaternion.copy(tg.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(t * 1.3) * 0.03, Math.sin(t * 0.9) * 0.04, 0)));
      this._bend(t, 0.02);
    } else if (this.mode === 'held') {
      const tg = this._cardTarget(), before = P.position.clone();
      P.position.lerp(this._held, 1 - Math.exp(-18 * dt));
      if (dt > 0) this._vel.lerp(P.position.clone().sub(before).divideScalar(dt), 0.35);
      const local = this._vel.clone().applyQuaternion(tg.q.clone().invert());
      P.quaternion.copy(tg.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-local.y * 0.05, local.x * 0.05, -local.x * 0.03)));
      this._bend(t, Math.min(0.5, this._vel.length() * 0.04));
    } else if (this.mode === 'thrown') {
      const k = Math.min(1, t / DUR.thrown);
      P.position.copy(this._curve.getPoint(k * k * (1.2 - 0.2 * k)));
      P.quaternion.slerpQuaternions(this._fromQ, tumbleQ(t * 1.6), Math.min(1, k * 3));
      this._bend(t, 0.9);
      if (k >= 1) {
        P.visible = false;
        this.ocean.addRipple(this.spot.x, this.spot.z, 1);
        B.group.visible = true;
        this._lastRip = -1;
        this.setMode('reform');
      }
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
        const right = new V3(1, 0, 0).applyQuaternion(this.camera.quaternion), up = new V3(0, 1, 0).applyQuaternion(this.camera.quaternion);
        const speed = THREE.MathUtils.clamp(Math.hypot(vx, vy) / size * 4, 5, 14);
        this._startThrow(right.multiplyScalar(sx * speed).addScaledVector(up, -sy * speed));
      } else this.setMode('card');                                          // not flicked: settle back
    };
    window.addEventListener('pointerup', up, { capture: true });
    window.addEventListener('pointercancel', up, { capture: true });
  }
}
