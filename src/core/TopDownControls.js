import * as THREE from 'three';

const { clamp, degToRad } = THREE.MathUtils;

/**
 * Straight-down camera.
 *  - drag to pan (flicks glide to a stop)
 *  - pinch / scroll to zoom toward the fingers or cursor, eased
 *  - double-tap / double-click to zoom in on that spot (again when fully in: zoom back out)
 *  - soft edges: past `bound` the view resists and springs back instead of hitting a wall
 */
export class TopDownControls {
  constructor(camera, dom, { height = 32, minHeight = 12, maxHeight = 55, bound = 150, ground = 1.2 } = {}) {
    Object.assign(this, { camera, dom, minHeight, maxHeight, bound, ground });
    this.height = height;           // current (eased)
    this.targetHeight = height;     // where the zoom is heading
    this.center = new THREE.Vector3();
    this.velocity = new THREE.Vector2();
    this.anchor = null;             // world point to keep under the cursor while zooming
    this.dragging = false;
    this.onStart = null; this.onEnd = null;
    camera.up.set(0, 0, -1);        // north is up on screen

    const pts = new Map();
    let last = null, moved = 0, lastTap = { t: 0, x: 0, y: 0 };
    const gesture = () => {
      const p = [...pts.values()];
      const x = p.reduce((s, q) => s + q.x, 0) / p.length, y = p.reduce((s, q) => s + q.y, 0) / p.length;
      const dist = p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
      return { x, y, dist, n: p.length };
    };

    dom.addEventListener('pointerdown', e => {
      dom.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      last = gesture(); moved = 0;
      if (!this.dragging) { this.dragging = true; this.velocity.set(0, 0); this.onStart?.(); }
    });
    dom.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture();
      if (last && g.n === last.n) {
        const k = this.worldPerPixel();
        let dx = -(g.x - last.x) * k, dz = -(g.y - last.y) * k;
        moved += Math.hypot(g.x - last.x, g.y - last.y);
        // resistance past the soft edge
        if (Math.abs(this.center.x) > bound && Math.sign(dx) === Math.sign(this.center.x)) dx *= 0.35;
        if (Math.abs(this.center.z) > bound && Math.sign(dz) === Math.sign(this.center.z)) dz *= 0.35;
        this.center.x += dx; this.center.z += dz;
        this.velocity.set(dx, dz).multiplyScalar(60);
        if (g.n > 1 && last.dist > 0 && g.dist > 0) {
          this.anchor = this.screenToWorld(g.x, g.y);
          this.targetHeight = clamp(this.targetHeight * (last.dist / g.dist), this.minHeight, this.maxHeight);
          this.height = this.targetHeight; // pinch follows the fingers directly
        }
      }
      last = g;
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      last = pts.size ? gesture() : null;
      if (!pts.size) {
        // double tap / double click → zoom toward that spot
        const now = performance.now();
        if (moved < 10) {
          if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
            this.zoomTo(this.targetHeight <= this.minHeight * 1.15 ? this.maxHeight * 0.6 : this.targetHeight * 0.55, e.clientX, e.clientY);
            lastTap.t = 0;
          } else lastTap = { t: now, x: e.clientX, y: e.clientY };
        }
        if (this.dragging) { this.dragging = false; this.onEnd?.(); }
      }
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    dom.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoomTo(this.targetHeight * Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY);
      this.onStart?.(); this.onEnd?.();
    }, { passive: false });
  }

  worldPerPixel(h = this.height) {
    return (2 * h * Math.tan(degToRad(this.camera.fov) / 2)) / (this.dom.clientHeight || 1);
  }

  /** World point (on the sea) under a screen position. */
  screenToWorld(sx, sy) {
    const r = this.dom.getBoundingClientRect(), k = this.worldPerPixel();
    return new THREE.Vector2(this.center.x + (sx - r.left - r.width / 2) * k, this.center.z + (sy - r.top - r.height / 2) * k);
  }

  /** Eased zoom; keeps the world point under (sx, sy) in place. */
  zoomTo(h, sx, sy) {
    this.targetHeight = clamp(h, this.minHeight, this.maxHeight);
    this.anchor = sx === undefined ? null : this.screenToWorld(sx, sy);
  }

  /** Width × height of the visible sea, in world units. */
  viewSize() {
    const vh = 2 * this.height * Math.tan(degToRad(this.camera.fov) / 2);
    return { w: vh * this.camera.aspect, h: vh };
  }

  update(dt) {
    // eased zoom toward the anchor point
    const prev = this.height;
    this.height += (this.targetHeight - this.height) * Math.min(1, dt * 8);
    if (this.anchor && Math.abs(this.height - prev) > 1e-5) {
      const f = 1 - this.height / prev;
      this.center.x += (this.anchor.x - this.center.x) * f;
      this.center.z += (this.anchor.y - this.center.z) * f;
    }
    if (Math.abs(this.targetHeight - this.height) < 1e-3) this.anchor = null;

    if (!this.dragging) {
      // glide
      this.center.x += this.velocity.x * dt; this.center.z += this.velocity.y * dt;
      this.velocity.multiplyScalar(Math.exp(-dt * 4));
      // spring back inside the soft edge
      for (const a of ['x', 'z']) {
        const over = this.center[a] - clamp(this.center[a], -this.bound, this.bound);
        if (over) { this.center[a] -= over * Math.min(1, dt * 6); if (a === 'x') this.velocity.x *= 0.8; else this.velocity.y *= 0.8; }
      }
    }
    this.camera.position.set(this.center.x, this.ground + this.height, this.center.z);
    this.camera.lookAt(this.center.x, this.ground, this.center.z);
  }
}
