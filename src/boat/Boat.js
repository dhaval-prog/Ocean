import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The tugboat: loaded from public/models/tugboat.glb, its 139 parts merged by
// colour into a handful of meshes, cel-shaded with a dark outline to match the
// cartoon sea. It bobs on the water and sails to wherever you tap.

const MODEL_SCALE = 0.36;    // model is ~14 units long → ~5 units on the sea
// chunky cartoon proportions: a little taller and much beamier than the model
const BULK = new THREE.Vector3(1.0, 1.1, 1.3);   // x = length, y = height, z = beam
const WATERLINE = 1.0;       // model-space height that sits at the water surface
const BOW_TO_STERN = 6.0;    // model-space distance from centre to the stern (for the wake)
const HULL_HALF_LENGTH = 2.1; // world units, bow / stern sample points for riding the waves
const HULL_HALF_BEAM = 0.85;
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
    // weather reactions
    this.windDir = [1, 0]; this.windStrength = 0;   // set by the app: headwind slows, tailwind surfs
    this.agitation = 0;                              // 0 … 1: rocks harder after a close lightning strike
    this._kick = 0; this._kickT = 9; this._kickSign = 1; this._strike = null; this._flicker = 0;
    this._lightLevel = 0;                            // window glow 0 … 1
    this._search = 0; this._searchWant = 0;          // searchlight 0 … 1
    this.spot = { x: 0, z: 0, r: 1, i: 0 };          // where the searchlight lands on the water
  }

  /** Wind from the weather: world direction [x, z] (unit) and strength 0 … 1. */
  setWind(dir, strength) { this.windDir = dir; this.windStrength = strength; }

  /** Searchlight wanted (0 … 1), e.g. in a storm or fog. */
  setSearchlight(v) { this._searchWant = v; }

  /** A lightning strike landed close at (x, z): the boat jolts, rocks hard and its lights flicker. */
  jolt(x, z, strength = 1) {
    this.agitation = Math.min(1, this.agitation + strength);
    this._kick = 0.28 * strength; this._kickT = 0;
    // heel away from the strike
    const ch = Math.cos(this.heading), sh = Math.sin(this.heading);
    const side = (x - this.position.x) * -sh + (z - this.position.y) * -ch;   // >0: strike to port
    this._kickSign = side > 0 ? -1 : 1;
    this._strike = { x, z };
    this._flicker = 1.6;
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

    model.scale.copy(BULK).multiplyScalar(MODEL_SCALE);
    model.position.y = -WATERLINE * MODEL_SCALE * BULK.y;
    this.body.add(model);
    // marker at the top of the funnel, so smoke follows bobbing and rolling
    this.funnel = new THREE.Object3D();
    this.funnel.position.copy(FUNNEL_TOP).multiply(BULK).multiplyScalar(MODEL_SCALE);
    this.funnel.position.y -= WATERLINE * MODEL_SCALE * BULK.y;
    this.body.add(this.funnel);
    // searchlight on the cabin roof: a soft cone of light (additive) that sweeps
    // side to side in storms and fog; where it meets the sea the ocean shader
    // draws a warm pool of light (see this.spot)
    const cone = new THREE.ConeGeometry(1.5, 9, 24, 1, true);
    cone.translate(0, -4.5, 0); cone.rotateZ(Math.PI / 2);          // apex at the lamp, pointing along +x
    this.searchBeam = new THREE.Mesh(cone, new THREE.ShaderMaterial({
      uniforms: { uI: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying float vRim; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vec3 n = normalize(normalMatrix*normal); vRim = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform float uI; varying vec2 vUv; varying float vRim; void main(){ float along = 1.0 - vUv.y; float a = pow(1.0 - along, 1.4)*vRim*vRim*0.32*uI; gl_FragColor = vec4(vec3(1.0, 0.94, 0.78)*a, a); }',
    }));
    this.searchBeam.renderOrder = 36;
    this.searchPivot = new THREE.Object3D();
    this.searchPivot.position.set(0.9, 1.35, 0);
    this.searchPivot.add(this.searchBeam);
    this.searchPivot.visible = false;
    this.body.add(this.searchPivot);
    this._o = new THREE.Vector3(); this._dir = new THREE.Vector3();
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
    // wind: a headwind holds the boat back, a tailwind lets it surf along
    // faster, and it drifts slowly downwind (more in a gale)
    const fx = Math.cos(this.heading), fz = -Math.sin(this.heading);
    const along = fx * this.windDir[0] + fz * this.windDir[1];          // +1 tailwind … −1 headwind
    const assist = this.speed > 0 ? 1 + along * this.windStrength * 0.35 : 1;
    this.position.x += fx * this.speed * assist * dt;
    this.position.y += fz * this.speed * assist * dt;
    if (!this.frozen) {
      const drift = this.windStrength * this.windStrength * 0.35;
      this.position.x += this.windDir[0] * drift * dt; this.position.y += this.windDir[1] * drift * dt;
    }

    // after a close strike: rocks hard, then settles; steering away from the
    // strike calms it much faster
    if (this.agitation > 0) {
      let calm = 0.22;
      if (this._strike && this.speed > 0.5) {
        const awayX = this.position.x - this._strike.x, awayZ = this.position.y - this._strike.z;
        if (fx * awayX + fz * awayZ > 0) calm = 0.75;
      }
      this.agitation = Math.max(0, this.agitation - calm * dt);
    }
    this._kickT += dt;
    this._flicker = Math.max(0, this._flicker - dt);

    // --- floating: ride the actual waves. Sample the water under the bow,
    // stern and both sides: the hull rises and falls with the surface, pitches
    // with the slope along its length and rolls with the slope across it.
    // The motion is exaggerated (more heave, pitch and roll than the surface
    // strictly gives) so the boat visibly rocks with every wave, more so in a
    // storm, plus a small shudder from the engine and the chop.
    const O = this.ocean, ch = Math.cos(this.heading), sh = Math.sin(this.heading);
    const L = HULL_HALF_LENGTH, Bm = HULL_HALF_BEAM, px = this.position.x, pz = this.position.y;
    const hBow = O.getHeightAt(px + ch * L, pz - sh * L), hStern = O.getHeightAt(px - ch * L, pz + sh * L);
    const hPort = O.getHeightAt(px - sh * Bm, pz - ch * Bm), hStar = O.getHeightAt(px + sh * Bm, pz + ch * Bm);
    const hMid = O.getHeightAt(px, pz);
    const waveY = (hBow + hStern + hPort + hStar + 2 * hMid) / 6;
    const storm = O.storm, ex = 2.8 + storm * 0.6;                 // exaggeration: more in rough water
    const C = THREE.MathUtils.clamp;
    const wavePitch = C(Math.atan2(hBow - hStern, 2 * L) * ex, -0.22, 0.22);   // never tips over
    const waveRoll = C(Math.atan2(hPort - hStar, 2 * Bm) * ex, -0.24, 0.24);
    const heave = O.base + (waveY - O.base) * (1.5 + storm * 0.5);
    const k = this._floatInit ? Math.min(1, dt * 6) : 1;
    this._floatInit = true;
    this._fy += (heave - this._fy) * k; this._fp += (wavePitch - this._fp) * k; this._fr += (waveRoll - this._fr) * k;
    const sp = Math.abs(this.speed) / this.maxSpeed;
    // its own swell rocking on top (always a little, a lot in a storm)
    const ag = this.agitation, rockA = (0.07 + storm * 0.07) * (1 + ag * 2.2), heaveA = (0.06 + storm * 0.1) * (1 + ag * 1.5);
    const kick = this._kick * Math.exp(-this._kickT * 2.2) * Math.cos(this._kickT * 6.5) * this._kickSign;   // the jolt: heel over, swing back
    // shudder: engine vibration when running + chop slapping the hull in a storm
    const shake = 0.006 * sp * Math.sin(t * 31) + storm * 0.012 * (Math.sin(t * 7.3) + Math.sin(t * 11.7 + 1.3)) * 0.5;
    this.group.position.set(px, this._fy + Math.sin(t * 1.6) * heaveA + shake * 0.5, pz);
    this.group.rotation.y = this.heading;
    this.body.rotation.x = this._fr + Math.sin(t * 1.1) * rockA + Math.sin(t * 2.3 + 0.7) * rockA * 0.35 + turn * 0.1 * sp + shake + kick;  // roll
    this.body.rotation.z = this._fp + Math.sin(t * 1.3 + 1.0) * rockA * 0.8 + 0.05 * (Math.max(0, this.speed) / this.maxSpeed) + shake * 0.7; // pitch
    // sinking / resurfacing (SinkSequence)
    this.group.position.y += this.sinkY;
    this.body.rotation.x += this.sinkRoll;
    this.body.rotation.z -= this.sinkPitch;

    // window lights (flicker after a strike) and the sweeping searchlight
    const flick = this._flicker > 0 ? (Math.random() < 0.35 ? 0.1 : 1) : 1;
    if (this._glass) this._glass.emissiveIntensity = this._lightLevel * 2.2 * flick;
    this._search += (this._searchWant - this._search) * Math.min(1, dt * 1.5);
    if (this.searchPivot) {
      const on = this._search * flick;
      this.searchPivot.visible = on > 0.02;
      this.searchPivot.rotation.set(0, Math.sin(t * 0.55) * 0.95, -0.2, 'YZX');   // sweeps side to side, angled down
      this.searchBeam.material.uniforms.uI.value = on;
      this.searchPivot.updateWorldMatrix(true, false);
      const o = this._o.setFromMatrixPosition(this.searchPivot.matrixWorld);
      const d = this._dir.set(1, 0, 0).transformDirection(this.searchPivot.matrixWorld);
      const k = THREE.MathUtils.clamp((o.y - this.ocean.base) / Math.max(-d.y, 0.05), 2, 10);
      this.spot.x = o.x + d.x * k; this.spot.z = o.z + d.z * k; this.spot.r = 1.4 + k * 0.22; this.spot.i = on;
    }

    // soft shadow under the hull; fades as it sinks, gone while hidden
    this.ocean.uniforms.uBoatShadow.value = this.group.visible ? THREE.MathUtils.clamp(1 + this.sinkY / 1.2, 0, 1) : 0;

    // --- wake: V of foam + bow splash drawn by the water shader, plus the odd bubble drop
    this.ocean.setBoat(this.position.x, this.position.y, this.heading, Math.max(0, this.speed) / this.maxSpeed, 6.4 * MODEL_SCALE * BULK.x, 2.4 * MODEL_SCALE * BULK.z);
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
  setNight(n) { this._lightLevel = n; }
}
