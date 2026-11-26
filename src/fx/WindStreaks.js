import * as THREE from 'three';

// Cartoon wind: thin white lines that sweep across the screen and curl into a
// little loop. Drawn in screen space as one batched mesh of ribbons.

const SEGS = 96;

const VERT = /* glsl */ `
attribute vec2 aCorner; attribute float aSeed;
uniform float uTime; uniform vec2 uRes; uniform float uStrength;
varying float vAlong; varying float vAcross; varying float vFade;

// path of a curl: a gentle wave with one loop near the front (s: 0 tail … 1 head)
vec2 path(float s, float L, float R, float seed) {
  float th = 6.2832 * clamp((s - 0.55) / 0.3, 0.0, 1.0);
  float x = s*L + R*1.6*sin(th);
  float y = R*1.6*(1.0 - cos(th)) + sin(s*6.0 + seed*6.0)*0.012;
  return vec2(x, y);
}
void main() {
  float period = 7.0 + fract(aSeed*7.13)*6.0;
  float lt = mod(uTime + aSeed*23.0, period) / period;
  float live = step(lt, 0.45), k = lt / 0.45;
  float L = 0.32 + fract(aSeed*3.7)*0.18, R = 0.035 + fract(aSeed*9.1)*0.02;
  float aspect = uRes.x / uRes.y;
  vec2 origin = vec2(mix(-1.3, 1.05, k) - L*0.5, -0.7 + fract(aSeed*5.31)*1.4);

  float s = aCorner.x;
  vec2 pa = path(s, L, R, aSeed), pb = path(s + 0.01, L, R, aSeed);
  vec2 t = normalize((pb - pa) * vec2(1.0, aspect) + 1e-5);
  vec2 nrm = vec2(-t.y, t.x) / vec2(1.0, aspect);
  float px = 2.0 / uRes.y;
  vec2 p = origin + pa + nrm * aCorner.y * px * 1.2 * (0.6 + 0.8*sin(s*3.14159));
  vAlong = s; vAcross = aCorner.y; vFade = sin(k*3.14159) * live * uStrength;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
varying float vAlong; varying float vAcross; varying float vFade;
void main() {
  float a = smoothstep(0.0, 0.35, vAlong) * smoothstep(1.0, 0.9, vAlong) * (1.0 - abs(vAcross)) * vFade;
  if (a < 0.005) discard;
  gl_FragColor = vec4(vec3(1.0), a);
}`;

export class WindStreaks {
  constructor(count = 6) {
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
    this.uniforms.uStrength.value = (0.4 + storm * 0.5) * (0.55 + 0.45 * light);
  }

  setSize(w, h) { this.uniforms.uRes.value.set(w, h); }
}
