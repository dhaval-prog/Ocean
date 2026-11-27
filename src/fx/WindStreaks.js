import * as THREE from 'three';

// Anime wind lines: thin white curves that sweep across the screen.
// Drawn in screen space as one batched mesh (each streak is a short ribbon).

const SEGS = 16;

const VERT = /* glsl */ `
attribute vec2 aCorner; attribute float aSeed;
uniform float uTime; uniform vec2 uRes; uniform float uStrength; uniform vec2 uDir;
varying float vAlong; varying float vAcross; varying float vFade;
void main() {
  float period = 6.0 + fract(aSeed*7.13)*5.0;
  float lt = mod(uTime + aSeed*23.0, period) / period;
  float live = step(lt, 0.4), k = lt / 0.4;
  float len = 0.35 + fract(aSeed*3.7)*0.3;
  float y0 = -0.15 + fract(aSeed*5.31)*0.95;
  float head = mix(-1.3, 1.3 + len, k);
  float x = head - len*(1.0 - aCorner.x);
  float y = y0 + sin(x*2.2 + aSeed*6.0)*0.05 + (x - head)*0.04;
  // the sweep is laid out in a square as wide as the screen's diagonal, then
  // turned to blow the way the wind blows, so it crosses the screen at any angle
  float asp = uRes.x / uRes.y, D = length(vec2(asp, 1.0));
  y = y*1.25 - 0.4;                                  // spread across the whole height
  float px = 2.0 / uRes.y / D;
  y += aCorner.y * px * (1.0 + 1.2*sin(aCorner.x*3.14159));
  vAlong = aCorner.x; vAcross = aCorner.y; vFade = sin(k*3.14159) * live * uStrength;
  vec2 v = vec2(x, y) * D;
  v = vec2(v.x*uDir.x - v.y*uDir.y, v.x*uDir.y + v.y*uDir.x);
  gl_Position = vec4(v.x/asp, v.y, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
varying float vAlong; varying float vAcross; varying float vFade;
void main() {
  float a = smoothstep(0.0, 0.6, vAlong) * smoothstep(1.0, 0.85, vAlong) * (1.0 - abs(vAcross)) * vFade;
  if (a < 0.005) discard;
  gl_FragColor = vec4(vec3(1.0), a);
}`;

export class WindStreaks {
  constructor(count = 7) {
    const perStreak = (SEGS + 1) * 2;
    const corner = new Float32Array(count * perStreak * 2), seed = new Float32Array(count * perStreak), index = [];
    for (let s = 0; s < count; s++) {
      const sd = Math.random();
      for (let i = 0; i <= SEGS; i++) for (let side = 0; side < 2; side++) {
        const v = s * perStreak + i * 2 + side;
        corner.set([i / SEGS, side ? 1 : -1], v * 2); seed[v] = sd;
      }
      for (let i = 0; i < SEGS; i++) {
        const a = s * perStreak + i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * perStreak * 3), 3));
    geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setIndex(index);
    this.uniforms = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uStrength: { value: 0.3 }, uDir: { value: new THREE.Vector2(1, 0) } };
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1000;
  }

  /** windDir: world [x, z] (north-up view: screen x = world x, screen up = world −z); wind 0 … 1 */
  /** fade 0 … 1: hides the stylised lines (e.g. in rain or fog) */
  update(elapsed, storm, light, windDir = [1, 0], wind = storm, fade = 1) {
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uStrength.value = (0.18 + Math.max(storm, wind) * 0.6) * (0.5 + 0.5 * light) * fade;
    const x = windDir[0], y = -windDir[1], l = Math.hypot(x, y) || 1;
    this.uniforms.uDir.value.set(x / l, y / l);
  }

  setSize(w, h) { this.uniforms.uRes.value.set(w, h); }
}
