import * as THREE from 'three';

/**
 * Sea camera, tilted (`pitch`: 90 = straight down, 60 = the default, looking
 * down at 60° from the horizon) and turned by `yaw` (0 = looking north, −z).
 * Drag to pan, pinch or scroll to zoom. Panning keeps the water under your
 * finger, glides to a stop, and the view stays inside `bound` so the edge of
 * the ocean is never visible.
 *
 * Turning the view all the way round (360°):
 *   - phones: twist two fingers
 *   - desktop: right-drag (or Shift + drag), Q / E keys
 *   - `orbit = true` (the 360° button): a one-finger drag turns and tilts
 *     the view instead of panning it
 */
export class TopDownControls {
  constructor(camera, dom, { height = 32, minHeight = 14, maxHeight = 55, bound = 50, ground = 1.2, pitch = 60, minPitch = 35, maxPitch = 88 } = {}) {
    // `height` is the camera's distance from the point it looks at
    Object.assign(this, { camera, dom, height, minHeight, maxHeight, bound, ground, pitch, minPitch, maxPitch });
    this.defaultPitch = pitch;
    this.yaw = 0;            // radians, 0 = north up
    this.yawVelocity = 0;    // for a gentle glide after a spin
    this.orbit = false;      // one-finger drag turns the view (360° mode)
    this.onRotate = null;    // called once per gesture when the view is turned
    this._reset = null;      // { yaw, pitch } while easing back to the default view
    this.center = new THREE.Vector3(0, 0, 0);   // point on the sea under the camera
    this.velocity = new THREE.Vector2();
    this.dragging = false;
    this.onStart = null; this.onEnd = null;
    this.onPan = null;   // called once per gesture when the view is actually dragged
    this.enabled = true; // set false to let another gesture (e.g. steering the boat) own the pointer
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ground);

    const pts = new Map();
    let last = null; // { x, y, dist } of the previous gesture frame
    let moved = 0, panned = false, rotated = false, spin = false;
    const gesture = () => {
      const p = [...pts.values()];
      const x = p.reduce((s, q) => s + q.x, 0) / p.length, y = p.reduce((s, q) => s + q.y, 0) / p.length;
      const dist = p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
      const ang = p.length > 1 ? Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x) : 0;
      return { x, y, dist, ang, n: p.length };
    };
    const turned = () => { if (!rotated) { rotated = true; this.onRotate?.(); } this._reset = null; };
    dom.addEventListener('contextmenu', e => e.preventDefault()); // right-drag rotates

    dom.addEventListener('pointerdown', e => {
      if (!this.enabled) return;
      dom.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      last = gesture();
      if (!this.dragging) {
        this.dragging = true; this.velocity.set(0, 0); this.yawVelocity = 0; moved = 0; panned = false; rotated = false;
        spin = e.pointerType === 'mouse' && (e.button === 2 || e.shiftKey);
        this.onStart?.();
      }
    });
    dom.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture();
      if (last && g.n === last.n && g.n === 1 && (this.orbit || spin)) {
        // turn (sideways drag) and tilt (up/down drag) instead of panning
        const dx = g.x - last.x, dy = g.y - last.y;
        moved += Math.hypot(dx, dy);
        if (moved > 4) {
          turned();
          const dyaw = -dx / (this.dom.clientWidth || 1) * Math.PI * 1.6;
          this.yaw += dyaw; this.yawVelocity = dyaw * 60;
          this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.2, this.minPitch, this.maxPitch);
        }
      } else if (last && g.n === last.n) {
        if (g.n === 1) moved += Math.hypot(g.x - last.x, g.y - last.y);   // pinching is not panning
        if (!panned && moved > 8) { panned = true; this.onPan?.(); }
        // move so the water point under the finger stays under the finger
        const a = this.screenToWater(last.x, last.y), b = this.screenToWater(g.x, g.y);
        const k = this.worldPerPixel();
        let dx, dz;
        if (a && b) { dx = a.x - b.x; dz = a.z - b.z; }
        else { // screen drag → world, turned by the view's yaw
          const sx = -(g.x - last.x) * k, sy = -(g.y - last.y) * k, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
          dx = sx * c + sy * s; dz = -sx * s + sy * c;
        }
        this.center.x += dx; this.center.z += dz;
        this.velocity.set(dx, dz).multiplyScalar(60); // units / second for the glide
        if (g.n > 1 && last.dist > 0) this.zoomBy(last.dist / g.dist);
        if (g.n > 1) { // two-finger twist turns the view
          const da = Math.atan2(Math.sin(g.ang - last.ang), Math.cos(g.ang - last.ang));
          if (Math.abs(da) > 1e-4) { turned(); this.yaw += da; }
        }
      }
      last = g;
    });
    const up = e => {
      pts.delete(e.pointerId);
      last = pts.size ? gesture() : null;
      if (!pts.size && this.dragging) { this.dragging = false; this.onEnd?.(); }
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    dom.addEventListener('wheel', e => { e.preventDefault(); this.zoomBy(Math.exp(e.deltaY * 0.0012)); this.onStart?.(); this.onEnd?.(); }, { passive: false });
  }

  worldPerPixel() {
    const vh = 2 * this.height * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    return vh / (this.dom.clientHeight || 1);
  }

  /** Point on the water under a screen position (or null if it misses). */
  screenToWater(sx, sy) {
    const r = this.dom.getBoundingClientRect();
    this.camera.updateMatrixWorld();
    this._ray.setFromCamera(new THREE.Vector2(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1), this.camera);
    return this._ray.ray.intersectPlane(this._plane, new THREE.Vector3());
  }

  /** Turn the view by `a` radians (keyboard). */
  rotateBy(a) { this._reset = null; this.yaw += a; }

  /** Ease back to north-up and the default tilt. */
  resetView() { this._reset = true; this.yawVelocity = 0; }

  /** True when the view is turned or tilted away from the default. */
  get turned() {
    const y = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
    return Math.abs(y) > 0.02 || Math.abs(this.pitch - this.defaultPitch) > 0.5;
  }

  zoomBy(f) { this.height = THREE.MathUtils.clamp(this.height * f, this.minHeight, this.maxHeight); }

  update(dt) {
    if (!this.dragging && this.velocity.lengthSq() > 1e-4) {
      this.center.x += this.velocity.x * dt; this.center.z += this.velocity.y * dt;
      this.velocity.multiplyScalar(Math.exp(-dt * 4));
    }
    if (!this.dragging && Math.abs(this.yawVelocity) > 1e-3) {
      this.yaw += this.yawVelocity * dt;
      this.yawVelocity *= Math.exp(-dt * 5);
    }
    if (this._reset) {
      const k = Math.min(1, dt * 4);
      this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw)) * (1 - k);
      this.pitch += (this.defaultPitch - this.pitch) * k;
      if (!this.turned) { this.yaw = 0; this.pitch = this.defaultPitch; this._reset = null; }
    }
    // never tilt so low that the top of the view reaches the edge of the ocean
    this.pitch = THREE.MathUtils.clamp(this.pitch, Math.max(this.minPitch, this.camera.fov / 2 + 14), this.maxPitch);
    this.center.x = THREE.MathUtils.clamp(this.center.x, -this.bound, this.bound);
    this.center.z = THREE.MathUtils.clamp(this.center.z, -this.bound, this.bound);
    const p = THREE.MathUtils.degToRad(this.pitch), r = this.height * Math.cos(p);
    this.camera.position.set(this.center.x + r * Math.sin(this.yaw), this.ground + this.height * Math.sin(p), this.center.z + r * Math.cos(this.yaw));
    this.camera.lookAt(this.center.x, this.ground, this.center.z);
  }
}
