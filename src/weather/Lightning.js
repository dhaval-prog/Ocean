import * as THREE from 'three';

// Lightning bolts that strike the sea: a jagged main channel from high in the
// sky down to the water, with a few forked branches that die out in the air.
// Drawn as camera-facing ribbons (a thin white-hot core inside a blue glow),
// additive and bright enough to bloom. The bolt keeps its channel for every
// return stroke of a strike and simply follows the flash brightness.

const MAX_PTS = 900;
const WHITE = new THREE.Color(1, 1, 1);   // ribbon vertices budget (2 per point, 2 layers)

const VERT = /* glsl */ `
attribute float aEdge; attribute float aFade;
varying float vEdge; varying float vFade;
void main() { vEdge = aEdge; vFade = aFade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uI;
varying float vEdge; varying float vFade;
void main() {
  float a = (1.0 - abs(vEdge)); a = a*a*vFade*uI;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor*a, a);
}`;

function jag(a, b, levels, spread, out) {
  // midpoint displacement: each level splits every segment and nudges the middle sideways
  let pts = [a.clone(), b.clone()];
  let s = spread;
  for (let l = 0; l < levels; l++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const m = p.clone().lerp(q, 0.4 + Math.random() * 0.2);
      m.x += (Math.random() - 0.5) * s; m.z += (Math.random() - 0.5) * s; m.y += (Math.random() - 0.5) * s * 0.3;
      next.push(m, q);
    }
    pts = next; s *= 0.55;
  }
  out.push(...pts);
  return pts;
}

export class Lightning {
  constructor() {
    this.group = new THREE.Group();
    this.group.renderOrder = 40;
    const mk = (color) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PTS * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(MAX_PTS), 1));
      geo.setAttribute('aFade', new THREE.BufferAttribute(new Float32Array(MAX_PTS), 1).setUsage(THREE.DynamicDrawUsage));
      geo.setIndex(new THREE.BufferAttribute(new Uint16Array(MAX_PTS * 3), 1).setUsage(THREE.DynamicDrawUsage));
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: color }, uI: { value: 0 } },
      });
      const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 40;
      this.group.add(m); return m;
    };
    this.glow = mk(new THREE.Color(0.55, 0.65, 1.6));   // HDR so the bloom pass picks it up
    this.core = mk(new THREE.Color(3.2, 3.3, 3.6));
    this.paths = [];                                   // [{ pts: Vector3[], width, fade }]
    this.group.visible = false;
    this._v = new THREE.Vector3(); this._d = new THREE.Vector3(); this._s = new THREE.Vector3();
  }

  /** A new strike hitting the water at (x, waterY, z). near: a big bright bolt; far: thinner. */
  strike(x, waterY, z, near = true, from = null) {
    // out of the storm cloud above when there is one; else from high up, leaning back into the storm
    const top = from ? from.clone() : new THREE.Vector3(x + (Math.random() - 0.5) * 8, waterY + 40 + Math.random() * 10, z - 8 - Math.random() * 12);
    const hit = new THREE.Vector3(x, waterY, z);
    const main = [];
    jag(top, hit, from ? 5 : 6, Math.min(9, top.distanceTo(hit) * 0.3), main);
    this.paths = [{ pts: main, width: near ? 0.5 : 0.3, fade: 1 }];
    // forks: branch off the upper part of the channel, angle down and away, fade out in the air
    const forks = 2 + Math.floor(Math.random() * (near ? 4 : 2));
    for (let f = 0; f < forks; f++) {
      const i = Math.floor(main.length * (0.1 + Math.random() * 0.55));
      const from = main[i], len = 6 + Math.random() * 12;
      const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * len, -len * (0.6 + Math.random() * 0.4), (Math.random() - 0.5) * len));
      to.y = Math.max(to.y, waterY + 3);
      const pts = []; jag(from, to, 4, len * 0.35, pts);
      this.paths.push({ pts, width: (near ? 0.5 : 0.3) * 0.45, fade: 0.55 });
    }
    this.hit = hit;
  }

  /** Bolt colour for the time of day (dark blue at dawn, dark red at sunset, warm yellow at dusk …):
   *  a hot, bright core tinted by it inside a glow of the full colour. */
  setColor(c) {
    this.core.material.uniforms.uColor.value.copy(c).lerp(WHITE, 0.3).multiplyScalar(3.0);
    this.glow.material.uniforms.uColor.value.copy(c).multiplyScalar(2.4);
  }

  /** Every frame: rebuild the camera-facing ribbons; intensity follows the flash (0 … 1). */
  update(camera, intensity) {
    const on = intensity > 0.02 && this.paths.length;
    this.group.visible = !!on;
    if (!on) return;
    for (const [mesh, wMul] of [[this.glow, 7], [this.core, 1]]) {
      const pos = mesh.geometry.attributes.position.array, edge = mesh.geometry.attributes.aEdge.array, fade = mesh.geometry.attributes.aFade.array;
      const idx = mesh.geometry.index.array;
      let v = 0, n = 0;
      for (const path of this.paths) {
        const P = path.pts, start = v;
        for (let i = 0; i < P.length && v < MAX_PTS - 2; i++) {
          const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
          this._d.subVectors(b, a).normalize();
          this._v.subVectors(camera.position, P[i]).normalize();
          this._s.crossVectors(this._d, this._v).normalize();
          const taper = path.fade < 1 ? 1 - i / P.length : 1;                // forks thin out toward their tips
          const w = path.width * wMul * (0.35 + 0.65 * taper) * 0.5;
          for (const side of [-1, 1]) {
            pos[v * 3] = P[i].x + this._s.x * w * side; pos[v * 3 + 1] = P[i].y + this._s.y * w * side; pos[v * 3 + 2] = P[i].z + this._s.z * w * side;
            edge[v] = side; fade[v] = path.fade * (0.4 + 0.6 * taper); v++;
          }
          if (i > 0) { const q = v - 4; idx.set([q, q + 1, q + 2, q + 1, q + 3, q + 2], n); n += 6; }
        }
        if (v === start) break;
      }
      mesh.geometry.setDrawRange(0, n);
      mesh.geometry.attributes.position.needsUpdate = mesh.geometry.attributes.aEdge.needsUpdate = mesh.geometry.attributes.aFade.needsUpdate = true;
      mesh.geometry.index.needsUpdate = true;
      mesh.material.uniforms.uI.value = Math.min(1, intensity * 1.3) * (mesh === this.glow ? 0.55 : 1);
    }
  }
}
