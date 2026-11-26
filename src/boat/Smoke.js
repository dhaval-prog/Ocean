import * as THREE from 'three';

// Cartoon funnel smoke: round puffs that pop out of the funnel, rise, drift
// back behind the boat, swell and fade. More and bigger puffs the faster the
// boat goes; the odd lazy puff when it is idle. One draw call (points).

const MAX = 48;

const VERT = /* glsl */ `
attribute float aSize; attribute float aAlpha; attribute float aSeed;
uniform float uScale;
varying float vAlpha; varying float vSeed;
void main() {
  vAlpha = aAlpha; vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aAlpha <= 0.001 ? 0.0 : aSize * uScale / -mv.z;
}`;

const FRAG = /* glsl */ `
uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uInk;
varying float vAlpha; varying float vSeed;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float a = atan(q.y, q.x);
  // lumpy cloud edge: three bumps that differ per puff
  float r = 0.42 + 0.04*sin(a*3.0 + vSeed*6.28) + 0.025*sin(a*5.0 - vSeed*11.0);
  float d = length(q);
  float f = max(fwidth(d), 1e-3);
  float body = 1.0 - smoothstep(r - f, r + f, d);
  if (body * vAlpha < 0.01) discard;
  // cel shading: lit upper-left, shaded lower-right, thin ink rim
  float lit = step(0.0, -(q.x*0.6 + q.y*0.8) + 0.06);
  vec3 col = mix(uShade, uLit, lit);
  float rim = smoothstep(r - 0.06 - f, r - 0.06 + f, d);
  col = mix(col, uInk, rim*0.55);
  gl_FragColor = vec4(col, body * vAlpha);
}`;

export class Smoke {
  constructor() {
    this.pos = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.seed = Float32Array.from({ length: MAX }, Math.random);
    this.puffs = Array.from({ length: MAX }, () => ({ age: 1, life: 1, vel: new THREE.Vector3(), start: 0, end: 0, p: new THREE.Vector3() }));
    this.next = 0;
    this.timer = 0;

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aSize', this.sizeAttr);
    geo.setAttribute('aAlpha', this.alphaAttr);
    geo.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.uniforms = {
      uScale: { value: 600 },
      uLit: { value: new THREE.Color('#f6f4f2') }, uShade: { value: new THREE.Color('#c9c6d6') }, uInk: { value: new THREE.Color('#5a5f7e') },
    };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 30;
    this._day = [new THREE.Color('#f6f4f2'), new THREE.Color('#c9c6d6'), new THREE.Color('#5a5f7e')];
    this._night = [new THREE.Color('#6b7196'), new THREE.Color('#454a6e'), new THREE.Color('#1d2244')];
  }

  /** Pixel scale for point sizes: drawing-buffer height / (2·tan(fov/2)). */
  setScale(bufferHeight, fovDeg) { this.uniforms.uScale.value = bufferHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)); }

  /** light: 0 (night) … 1 (day) */
  setLight(light) {
    const k = THREE.MathUtils.clamp((light - 0.3) / 0.7, 0, 1);
    ['uLit', 'uShade', 'uInk'].forEach((u, i) => this.uniforms[u].value.copy(this._night[i]).lerp(this._day[i], k));
  }

  emit(at, back, speed01) {
    const p = this.puffs[this.next++ % MAX];
    p.age = 0;
    p.life = 0.9 + Math.random() * 0.4 + speed01 * 0.3;        // shorter trail
    p.p.copy(at);
    // up, plus blown back behind the boat as it moves, plus a little wobble
    p.vel.set(back.x * (0.3 + speed01 * 1.4) + (Math.random() - 0.5) * 0.7, 0.8 + Math.random() * 0.6, back.y * (0.3 + speed01 * 1.4) + (Math.random() - 0.5) * 0.7);
    const big = 0.7 + Math.random() * 0.6;                 // every puff a bit different
    p.start = (0.18 + speed01 * 0.12) * big;
    p.end = (0.8 + speed01 * 0.6 + Math.random() * 0.35) * big;
  }

  /** A quick burst of puffs (used with the horn). */
  burst(funnel, heading, n = 3) {
    if (!funnel) return;
    const back = new THREE.Vector2(-Math.cos(heading), Math.sin(heading));
    for (let i = 0; i < n; i++) this.emit(funnel, back, 0.4 + i * 0.2);
  }

  update(dt, { funnel, heading, speed01 }) {
    // emit: steady puffs while running, the odd lazy puff when idle
    const running = speed01 > 0.05, interval = THREE.MathUtils.lerp(0.65, 0.3, speed01) * (0.7 + Math.random() * 0.6);   // fewer puffs
    this.timer = Math.min(this.timer - dt, running ? interval : Infinity);   // start puffing as soon as it moves
    if (funnel && this.timer <= 0) {
      this.timer = running ? interval : 2.5 + Math.random() * 1.5;
      const back = new THREE.Vector2(-Math.cos(heading), Math.sin(heading));
      this.emit(funnel, back, speed01);
    }
    for (let i = 0; i < MAX; i++) {
      const p = this.puffs[i];
      if (p.age >= p.life) { this.alpha[i] = 0; continue; }
      p.age += dt;
      const k = Math.min(1, p.age / p.life);
      p.p.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.exp(-dt * 0.9));           // slow down as it spreads
      p.vel.y += dt * 0.15;
      this.pos.set([p.p.x, p.p.y, p.p.z], i * 3);
      const pop = Math.min(1, p.age / 0.12);                // quick pop-in
      this.size[i] = THREE.MathUtils.lerp(p.start, p.end, Math.sqrt(k)) * (0.6 + 0.4 * pop);
      this.alpha[i] = pop * (1 - k * k) * 0.5;               // lighter
    }
    this.posAttr.needsUpdate = this.sizeAttr.needsUpdate = this.alphaAttr.needsUpdate = true;
  }
}
