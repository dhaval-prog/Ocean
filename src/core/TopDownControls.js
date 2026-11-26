import * as THREE from 'three';

/**
 * Sea camera, tilted at a fixed angle (`pitch`: 90 = straight down, 60 = the
 * default, looking down at 60° from the horizon). Drag to pan, pinch or scroll
 * to zoom. No rotation. Panning keeps the water under your finger, glides to a
 * stop, and the view stays inside `bound` so the edge of the ocean is never visible.
 */
export class TopDownControls {
  constructor(camera, dom, { height = 32, minHeight = 14, maxHeight = 55, bound = 50, ground = 1.2, pitch = 60 } = {}) {
    // `height` is the camera's distance from the point it looks at
    Object.assign(this, { camera, dom, height, minHeight, maxHeight, bound, ground, pitch });
    this.center = new THREE.Vector3(0, 0, 0);   // point on the sea under the camera
    this.velocity = new THREE.Vector2();
    this.dragging = false;
    this.onStart = null; this.onEnd = null;
    this.onPan = null;   // called once per gesture when the view is actually dragged
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ground);

    const pts = new Map();
    let last = null; // { x, y, dist } of the previous gesture frame
    let moved = 0, panned = false;
    const gesture = () => {
      const p = [...pts.values()];
      const x = p.reduce((s, q) => s + q.x, 0) / p.length, y = p.reduce((s, q) => s + q.y, 0) / p.length;
      const dist = p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
      return { x, y, dist, n: p.length };
    };

    dom.addEventListener('pointerdown', e => {
      dom.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      last = gesture();
      if (!this.dragging) { this.dragging = true; this.velocity.set(0, 0); moved = 0; panned = false; this.onStart?.(); }
    });
    dom.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture();
      if (last && g.n === last.n) {
        if (g.n === 1) moved += Math.hypot(g.x - last.x, g.y - last.y);   // pinching is not panning
        if (!panned && moved > 8) { panned = true; this.onPan?.(); }
        // move so the water point under the finger stays under the finger
        const a = this.screenToWater(last.x, last.y), b = this.screenToWater(g.x, g.y);
        const k = this.worldPerPixel();
        const dx = a && b ? a.x - b.x : -(g.x - last.x) * k, dz = a && b ? a.z - b.z : -(g.y - last.y) * k;
        this.center.x += dx; this.center.z += dz;
        this.velocity.set(dx, dz).multiplyScalar(60); // units / second for the glide
        if (g.n > 1 && last.dist > 0) this.zoomBy(last.dist / g.dist);
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

  zoomBy(f) { this.height = THREE.MathUtils.clamp(this.height * f, this.minHeight, this.maxHeight); }

  update(dt) {
    if (!this.dragging && this.velocity.lengthSq() > 1e-4) {
      this.center.x += this.velocity.x * dt; this.center.z += this.velocity.y * dt;
      this.velocity.multiplyScalar(Math.exp(-dt * 4));
    }
    this.center.x = THREE.MathUtils.clamp(this.center.x, -this.bound, this.bound);
    this.center.z = THREE.MathUtils.clamp(this.center.z, -this.bound, this.bound);
    const p = THREE.MathUtils.degToRad(this.pitch);
    this.camera.position.set(this.center.x, this.ground + this.height * Math.sin(p), this.center.z + this.height * Math.cos(p));
    this.camera.lookAt(this.center.x, this.ground, this.center.z);
  }
}
