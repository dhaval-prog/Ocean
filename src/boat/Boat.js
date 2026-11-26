import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The tugboat: loaded from public/models/tugboat.glb, its 139 parts merged by
// colour into a handful of meshes, cel-shaded with a dark outline to match the
// cartoon sea. It bobs on the water and sails to wherever you tap.

const MODEL_SCALE = 0.3;     // model is ~14 units long → ~4 units on the sea
const WATERLINE = 1.0;       // model-space height that sits at the water surface
const BOW_TO_STERN = 6.0;    // model-space distance from centre to the stern (for the wake)

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
    this.ready = false;
    this._wake = 0;
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
    this.ready = true;
    return this;
  }

  /** Sail to a point on the sea. */
  sailTo(x, z) { this.target = new THREE.Vector2(x, z); }

  update(dt, t) {
    if (!this.ready) return;

    // --- steering: turn toward the target, speed up, slow down on arrival
    let turn = 0;
    if (this.target) {
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

    // --- floating: bob, roll into turns, lift the bow when moving
    const base = this.ocean.base;
    this.group.position.set(this.position.x, base + Math.sin(t * 1.6) * 0.04, this.position.y);
    this.group.rotation.y = this.heading;
    this.body.rotation.x = Math.sin(t * 1.1) * 0.05 + turn * 0.08 * (this.speed / this.maxSpeed);   // roll
    this.body.rotation.z = Math.sin(t * 1.3 + 1.0) * 0.03 + 0.04 * (this.speed / this.maxSpeed);     // pitch

    // --- wake: small drops at the stern while moving
    if (this.speed > 0.4 && (this._wake -= dt) <= 0) {
      this._wake = 0.16;
      const back = BOW_TO_STERN * MODEL_SCALE;
      const sx = this.position.x - Math.cos(this.heading) * back, sz = this.position.y + Math.sin(this.heading) * back;
      const side = (Math.random() - 0.5) * 0.6;
      this.ocean.addRipple(sx - Math.sin(this.heading) * side, sz - Math.cos(this.heading) * side, 0.4 + 0.6 * this.speed / this.maxSpeed);
    }
  }

  /** Warm window glow at night (0 … 1). */
  setNight(n) { if (this._glass) this._glass.emissiveIntensity = n * 2.2; }
}
