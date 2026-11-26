import * as THREE from 'three';

// Destination marker: a little cartoon flag on a buoy with a pulsing ring on
// the water. Pops in where you tap, bobs while the boat is on its way, and
// shrinks away when the boat arrives.

export class Marker {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scale = 0;          // animated 0 … 1
    this.show = false;
    this.popT = 0;

    const toon = color => new THREE.MeshToonMaterial({ color });
    const ink = new THREE.MeshBasicMaterial({ color: '#141a3a', side: THREE.BackSide });

    const figure = new THREE.Group();
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon('#ffffff'));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.1, 20), toon('#ff5a4e'));
    band.position.y = 0.06;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), toon('#3a3f63'));
    pole.position.y = 0.75;
    const flagShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.7, -0.22), new THREE.Vector2(0, -0.44)]);
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), new THREE.MeshToonMaterial({ color: '#ffcf3a', side: THREE.DoubleSide }));
    flag.position.set(0.02, 1.48, 0);
    this.flag = flag;
    for (const m of [buoy, band, pole]) {
      const o = new THREE.Mesh(m.geometry, ink);
      o.scale.setScalar(1.12); o.position.copy(m.position);
      figure.add(o, m);
    }
    figure.add(flag);
    this.figure = figure;

    // pulsing ring on the water
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 48).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.renderOrder = 20;
    this.ring2 = new THREE.Mesh(this.ring.geometry, this.ringMat.clone());
    this.ring2.renderOrder = 20;

    this.group.add(figure, this.ring, this.ring2);
  }

  place(x, z, waterY) {
    this.group.position.set(x, waterY + 0.03, z);
    this.show = true;
    this.popT = 0;
    this.scale = 0.001;
    this.group.visible = true;
  }

  hide() { this.show = false; }

  update(dt, t) {
    this.popT += dt;
    // pop in with a little overshoot; shrink away when hidden
    const goal = this.show ? 1 : 0;
    if (this.show) {
      const k = Math.min(1, this.popT / 0.45), c = 2.2;
      this.scale = 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
    } else {
      this.scale += (goal - this.scale) * Math.min(1, dt * 10);
    }
    this.group.visible = this.scale > 0.02;
    if (!this.group.visible) return;

    this.figure.scale.setScalar(Math.max(this.scale, 0.001));
    this.figure.position.y = Math.sin(t * 2.4) * 0.06;
    this.figure.rotation.z = Math.sin(t * 1.7) * 0.08;
    this.flag.rotation.y = Math.sin(t * 6.0) * 0.35;           // flapping

    const s = Math.max(this.scale, 0.001);
    const a = (t * 0.8) % 1, b = (t * 0.8 + 0.5) % 1;          // two rings expanding out of phase
    this.ring.scale.setScalar(s * (0.6 + a * 1.4));
    this.ringMat.opacity = (1 - a) * 0.85 * Math.min(1, s);
    this.ring2.scale.setScalar(s * (0.6 + b * 1.4));
    this.ring2.material.opacity = (1 - b) * 0.85 * Math.min(1, s);
  }
}
