import * as THREE from 'three';

// Sea spray thrown off the bow when the boat drives through rough water:
// little white droplets that fly out to the sides, arc and fall back.

const MAX = 90;

const VERT = /* glsl */ `
attribute float aSize; attribute float aAlpha;
uniform float uScale;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aAlpha <= 0.001 ? 0.0 : aSize * uScale / -mv.z;
}`;
const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.3, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`;

export class Spray {
  constructor() {
    this.pos = new Float32Array(MAX * 3); this.size = new Float32Array(MAX); this.alpha = new Float32Array(MAX);
    this.drops = Array.from({ length: MAX }, () => ({ age: 1, life: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0.1 }));
    this.next = 0; this.acc = 0;
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr); geo.setAttribute('aSize', this.sizeAttr); geo.setAttribute('aAlpha', this.alphaAttr);
    this.uniforms = { uScale: { value: 600 }, uColor: { value: new THREE.Color('#f4fbff') } };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 31;
  }

  setScale(bufferHeight, fovDeg) { this.uniforms.uScale.value = bufferHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)); }
  setLight(light) { this.uniforms.uColor.value.setRGB(0.55 + 0.45 * light, 0.62 + 0.38 * light, 0.75 + 0.25 * light); }

  /** A splash thrown up all around a point on the water (e.g. a lightning strike). */
  burst(x, z, water, n = 40, power = 1) {
    for (let k = 0; k < n; k++) {
      const d = this.drops[this.next++ % MAX], a = Math.random() * Math.PI * 2, out = (1 + Math.random() * 2.5) * power;
      d.age = 0; d.life = 0.6 + Math.random() * 0.6; d.s = 0.1 + Math.random() * 0.18;
      d.p.set(x + Math.cos(a) * 0.2, water + 0.1, z + Math.sin(a) * 0.2);
      d.v.set(Math.cos(a) * out, (3 + Math.random() * 4) * power, Math.sin(a) * out);
    }
  }

  /** bow: world point at the bow; heading radians; speed01 0…1; rough 0…1 (sea state) */
  update(dt, { bow, heading, speed01, rough, water }) {
    const rate = bow ? Math.max(0, speed01 - 0.3) * Math.max(0, rough - 0.3) * 260 : 0;
    this.acc += rate * dt;
    const fx = Math.cos(heading), fz = -Math.sin(heading);
    while (this.acc >= 1) {
      this.acc -= 1;
      const d = this.drops[this.next++ % MAX], side = Math.random() < 0.5 ? -1 : 1, out = 1.2 + Math.random() * 1.6;
      d.age = 0; d.life = 0.45 + Math.random() * 0.4; d.s = 0.08 + Math.random() * 0.12;
      d.p.set(bow.x - fz * side * 0.25, water + 0.15, bow.z + fx * side * 0.25);
      d.v.set(-fz * side * out + fx * speed01 * 1.5, 1.6 + Math.random() * 1.8, fx * side * out + fz * speed01 * 1.5);
    }
    for (let i = 0; i < MAX; i++) {
      const d = this.drops[i];
      if (d.age >= d.life) { this.alpha[i] = 0; continue; }
      d.age += dt; d.v.y -= 9 * dt; d.p.addScaledVector(d.v, dt);
      const k = d.age / d.life;
      this.pos.set([d.p.x, Math.max(d.p.y, water), d.p.z], i * 3);
      this.size[i] = d.s * (1 - k * 0.4); this.alpha[i] = (1 - k) * 0.85;
    }
    this.posAttr.needsUpdate = this.sizeAttr.needsUpdate = this.alphaAttr.needsUpdate = true;
  }
}
