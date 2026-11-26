import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The tugboat: loaded from public/models/tugboat.glb, its 139 parts merged by
// colour into a handful of meshes, cel-shaded with a dark outline to match the
// cartoon sea. It bobs on the water and sails to wherever you tap.

const MODEL_SCALE = 0.3;     // model is ~14 units long → ~4 units on the sea
const WATERLINE = 1.0;       // model-space height that sits at the water surface
const BOW_TO_STERN = 6.0;    // model-space distance from centre to the stern (for the wake)
const HULL_HALF_LENGTH = 1.7; // world units, bow / stern sample points for riding the waves
const HULL_HALF_BEAM = 0.6;
const FUNNEL_TOP = new THREE.Vector3(-1.49, 6.0, 0); // model-space top of the funnel (for smoke)

function toonGradient() {
  const tex = new THREE.DataTexture(new Uint8Array([85, 160, 215]), 3, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export class Boat {
  constructor(ocean) {
    this.ocean = ocean;
    this.group = new THREE.Group();       // position + heading on the sea
    this.body = new THREE.Group();        // bob / roll / pitch
    this.group.add(this.body);
    this.position = new THREE.Vector2(0, 0);
    this.heading = Math.PI / 2;           // radians; 0 = +x (east), π/2 = north (up on screen)
    this.speed = 0;
    this.maxSpeed = 3.5;
    this.target = null;
    this.input = { throttle: 0, turn: 0 };   // keyboard driving: throttle −1…1, turn −1 (right)…1 (left)
    this.frozen = false;                      // true while sinking / resurfacing: ignores steering
    this.sinkY = 0; this.sinkRoll = 0; this.sinkPitch = 0;   // extra offsets driven by SinkSequence
    this.ready = false;
    this._wake = 0;
    this._fy = 0; this._fp = 0; this._fr = 0; this._floatInit = false;   // smoothed wave height / pitch / roll
    this._glass = null;
  }

  async load(url = '/models/tugboat.glb') {
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.updateMatrixWorld(true);

    // merge every part that shares a material → one mesh per colour
    const byMat = new Map(), all = [];
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(o.matrixWorld);
      const name = o.material.name || 'default';
      if (!byMat.has(name)) byMat.set(name, { color: o.material.color.clone(), geos: [] });
      byMat.get(name).geos.push(g);
      all.push(g);
    });

    const gradientMap = toonGradient();
    const model = new THREE.Group();
    for (const [name, { color, geos }] of byMat) {
      const mat = new THREE.MeshToonMaterial({ color, gradientMap, name });
      if (name === 'window_glass') { mat.emissive = new THREE.Color('#ffc56b'); mat.emissiveIntensity = 0; this._glass = mat; }
      model.add(new THREE.Mesh(mergeGeometries(geos), mat));
    }

    // cartoon outline: the whole boat drawn again slightly inflated, back faces only
    const outlineMat = new THREE.MeshBasicMaterial({ color: '#141a3a', side: THREE.BackSide });
    outlineMat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.09;');
    };
    model.add(new THREE.Mesh(mergeGeometries(all), outlineMat));

    model.scale.setScalar(MODEL_SCALE);
    model.position.y = -WATERLINE * MODEL_SCALE;
    this.body.add(model);
    // marker at the top of the funnel, so smoke follows bobbing and rolling
    this.funnel = new THREE.Object3D();
    this.funnel.position.copy(FUNNEL_TOP).multiplyScalar(MODEL_SCALE);
    this.funnel.position.y -= WATERLINE * MODEL_SCALE;
    this.body.add(this.funnel);
    this.ready = true;
    return this;
  }

  /** Speed as 0 … 1 (forward or reverse), for sound and smoke. */
  get throttle01() { return Math.min(1, Math.abs(this.speed) / this.maxSpeed); }

  /** Where the boat is on screen (CSS pixels) and roughly how big it looks there. */
  screenInfo(camera, dom) {
    const r = dom.getBoundingClientRect(), v = new THREE.Vector3(this.position.x, this.ocean.base + 0.4, this.position.y).project(camera);
    const e = new THREE.Vector3(this.position.x + 2, this.ocean.base + 0.4, this.position.y).project(camera);
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, radius: Math.abs(e.x - v.x) / 2 * r.width };
  }

  /** Sail to a point on the sea. */
  sailTo(x, z) { this.target = new THREE.Vector2(x, z); }

  update(dt, t) {
    if (!this.ready) return;

    // --- steering: turn toward the target, speed up, slow down on arrival
    let turn = 0;
    const manual = !this.frozen && (this.input.throttle !== 0 || this.input.turn !== 0);
    if (this.frozen) {
      this.target = null;
      this.speed += (0 - this.speed) * Math.min(1, dt * 3);
    } else if (manual) {
      // keyboard: steer and throttle directly (turning works best with some way on)
      this.target = null;
      turn = this.input.turn;
      this.heading += turn * dt * (0.6 + 0.9 * Math.min(1, Math.abs(this.speed) / this.maxSpeed + 0.3));
      const goal = this.input.throttle >= 0 ? this.input.throttle * this.maxSpeed : this.input.throttle * this.maxSpeed * 0.35;
      this.speed += (goal - this.speed) * Math.min(1, dt * 1.2);
    } else if (this.target) {
      const dx = this.target.x - this.position.x, dz = this.target.y - this.position.y;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(-dz, dx);                       // screen-up is −z
      let diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
      turn = THREE.MathUtils.clamp(diff, -1, 1);
      this.heading += turn * Math.min(1, dt * 1.6);
      const facing = Math.max(0, Math.cos(diff));             // slow while turning hard
      const goal = dist < 0.4 ? 0 : this.maxSpeed * Math.min(1, dist / 4) * (0.3 + 0.7 * facing);
      this.speed += (goal - this.speed) * Math.min(1, dt * 1.5);
      if (dist < 0.4 && this.speed < 0.15) this.target = null;
    } else {
      this.speed += (0 - this.speed) * Math.min(1, dt * 1.2);
    }
    this.position.x += Math.cos(this.heading) * this.speed * dt;
    this.position.y -= Math.sin(this.heading) * this.speed * dt;

    // --- floating: ride the actual waves. Sample the water under the bow,
    // stern and both sides: the hull rises and falls with the surface, pitches
    // with the slope along its length and rolls with the slope across it.
    // Smoothed a little so it feels like a heavy hull, not a cork.
    const O = this.ocean, ch = Math.cos(this.heading), sh = Math.sin(this.heading);
    const L = HULL_HALF_LENGTH, Bm = HULL_HALF_BEAM, px = this.position.x, pz = this.position.y;
    const hBow = O.getHeightAt(px + ch * L, pz - sh * L), hStern = O.getHeightAt(px - ch * L, pz + sh * L);
    const hPort = O.getHeightAt(px - sh * Bm, pz - ch * Bm), hStar = O.getHeightAt(px + sh * Bm, pz + ch * Bm);
    const hMid = O.getHeightAt(px, pz);
    const waveY = (hBow + hStern + hPort + hStar + 2 * hMid) / 6;
    const wavePitch = Math.atan2(hBow - hStern, 2 * L) * 1.4;   // a touch exaggerated so it reads from above
    const waveRoll = Math.atan2(hPort - hStar, 2 * Bm) * 1.4;
    const k = this._floatInit ? Math.min(1, dt * 5) : 1;
    this._floatInit = true;
    this._fy += (waveY - this._fy) * k; this._fp += (wavePitch - this._fp) * k; this._fr += (waveRoll - this._fr) * k;
    const sp = Math.abs(this.speed) / this.maxSpeed;
    this.group.position.set(px, this._fy + Math.sin(t * 1.6) * 0.02, pz);
    this.group.rotation.y = this.heading;
    this.body.rotation.x = this._fr + Math.sin(t * 1.1) * 0.025 + turn * 0.08 * sp;                       // roll
    this.body.rotation.z = this._fp + Math.sin(t * 1.3 + 1.0) * 0.015 + 0.04 * (Math.max(0, this.speed) / this.maxSpeed); // pitch
    // sinking / resurfacing (SinkSequence)
    this.group.position.y += this.sinkY;
    this.body.rotation.x += this.sinkRoll;
    this.body.rotation.z -= this.sinkPitch;

    // --- wake: V of foam + bow splash drawn by the water shader, plus the odd bubble drop
    this.ocean.setBoat(this.position.x, this.position.y, this.heading, Math.max(0, this.speed) / this.maxSpeed, 6.4 * MODEL_SCALE, 2.4 * MODEL_SCALE);
    if (this.speed > 0.6 && (this._wake -= dt) <= 0) {
      this._wake = 0.45;
      const back = BOW_TO_STERN * MODEL_SCALE;
      const sx = this.position.x - Math.cos(this.heading) * back, sz = this.position.y + Math.sin(this.heading) * back;
      const side = (Math.random() - 0.5) * 0.6;
      this.ocean.addRipple(sx - Math.sin(this.heading) * side, sz - Math.cos(this.heading) * side, 0.3 + 0.3 * this.speed / this.maxSpeed);
    }
  }

  /** World position of the funnel top (for smoke), or null before the model loads. */
  funnelWorld(out = new THREE.Vector3()) {
    if (!this.funnel) return null;
    this.group.updateMatrixWorld(true);
    return this.funnel.getWorldPosition(out);
  }

  /** Warm window glow at night (0 … 1). */
  setNight(n) { if (this._glass) this._glass.emissiveIntensity = n * 2.2; }
}
