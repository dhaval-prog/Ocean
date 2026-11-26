import * as THREE from 'three';

// Anime wind lines: thin white curves that sweep across the screen.
// Drawn in screen space as one batched mesh (each streak is a short ribbon).

const SEGS = 16;

const VERT = /* glsl */ `
attribute vec2 aCorner; attribute float aSeed;
uniform float uTime; uniform vec2 uRes; uniform float uStrength;
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
  float px = 2.0 / uRes.y;
  y += aCorner.y * px * (1.0 + 1.2*sin(aCorner.x*3.14159));
  vAlong = aCorner.x; vAcross = aCorner.y; vFade = sin(k*3.14159) * live * uStrength;
  gl_Position = vec4(x, y, 0.0, 1.0);
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
    this.uniforms = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uStrength: { value: 0.3 } };
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1000;
  }

  update(elapsed, storm, light) {
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uStrength.value = (0.22 + storm * 0.55) * (0.5 + 0.5 * light);
  }

  setSize(w, h) { this.uniforms.uRes.value.set(w, h); }
}
