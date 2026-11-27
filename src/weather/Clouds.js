import * as THREE from 'three';

// Thick, puffy cartoon clouds drifting between the camera and the sea. Each
// cloud is a tight cluster of overlapping cel-shaded puffs (lumpy edge, lit
// side toward the sun, shaded side, soft highlight, ink rim, like the boat's
// smoke), drawn as camera-facing quads in one instanced draw call.
//   - cloudy: white clouds floating fairly low over the sea
//   - storm: dark slate clouds, lower and bigger; lightning comes out of them
//   - each casts a soft shadow straight down on the water (ocean shader)
//   - fog hides them; they turn see-through while over the boat

const MAX_CLOUDS = 9, PUFFS = 12, MAX = MAX_CLOUDS * PUFFS;

const VERT = /* glsl */ `
attribute vec3 aCenter; attribute float aSize; attribute float aSeed; attribute float aAlpha;
uniform vec2 uBoatNdc; uniform float uAspect;
varying vec2 vQ; varying float vSeed; varying float vAlpha; varying float vH;
void main() {
  vQ = position.xy; vSeed = aSeed; vH = position.y;
  vec4 mv = modelViewMatrix * vec4(aCenter, 1.0);
  mv.xy += position.xy * aSize;
  gl_Position = projectionMatrix * mv;
  vec4 c = projectionMatrix * modelViewMatrix * vec4(aCenter, 1.0);
  vec2 d = (c.xy / c.w - uBoatNdc) * vec2(uAspect, 1.0);
  vAlpha = aAlpha * mix(0.3, 1.0, smoothstep(0.05, 0.16, length(d)));    // see-through just where it covers the boat
}`;

const FRAG = /* glsl */ `
uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uInk;
varying vec2 vQ; varying float vSeed; varying float vAlpha; varying float vH;
void main() {
  vec2 q = vQ;                                   // -0.5 … 0.5
  float a = atan(q.y, q.x), d = length(q);
  float r = 0.43 + 0.03*sin(a*3.0 + vSeed*6.28) + 0.022*sin(a*5.0 - vSeed*11.0) + 0.012*sin(a*9.0 + vSeed*3.0);
  float f = max(fwidth(d), 1e-3);
  float body = 1.0 - smoothstep(r - f, r + f, d);
  if (body*vAlpha < 0.01) discard;
  float lit = step(0.0, q.x*-0.5 + q.y*0.86 + 0.06);              // lit from the upper left (toward the sun)
  vec3 col = mix(uShade, uLit, lit);
  col = mix(col, uLit*1.05, smoothstep(0.2, 0.0, length(q - vec2(-0.12, 0.15)))*0.5);   // soft highlight
  col *= 0.94 + 0.06*smoothstep(-0.5, 0.5, vH);                   // a touch darker underneath
  float rim = smoothstep(r - 0.045 - f, r - 0.045 + f, d);
  col = mix(col, uInk, rim*0.65);
  gl_FragColor = vec4(col, body*vAlpha);
}`;

const WHITE = new THREE.Color(1, 1, 1), SLATE = new THREE.Color('#5d6478'), BLUEGREY = new THREE.Color('#8592b2');

export class Clouds {
  constructor() {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index; geo.attributes.position = base.attributes.position;
    this.center = new Float32Array(MAX * 3); this.size = new Float32Array(MAX); this.alpha = new Float32Array(MAX);
    this.aCenter = new THREE.InstancedBufferAttribute(this.center, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.InstancedBufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aCenter', this.aCenter); geo.setAttribute('aSize', this.aSize); geo.setAttribute('aAlpha', this.aAlpha);
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from({ length: MAX }, Math.random), 1));
    geo.instanceCount = MAX;
    this.uniforms = {
      uLit: { value: new THREE.Color('#fbfbff') }, uShade: { value: new THREE.Color('#c3cadc') }, uInk: { value: new THREE.Color('#5a5f7e') },
      uBoatNdc: { value: new THREE.Vector2(9, 9) }, uAspect: { value: 1 },
    };
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 60;
    this.clouds = [];
    this._spawnIn = 0;
    this._v = new THREE.Vector3();
  }

  _make(x, z, y, storm) {
    const c = { x, z, y, age: 0, out: -1, storm, r: (storm ? 3.6 : 2.8) + Math.random() * 1.6, puffs: [] };
    // a tight cluster: a big middle puff, a ring of puffs round it, a few on top
    for (let i = 0; i < PUFFS; i++) {
      const ring = i === 0 ? 0 : i < 8 ? 1 : 0.45;
      const a = (i / PUFFS) * Math.PI * 2 * 1.7 + Math.random() * 0.5, rr = ring * (0.45 + Math.random() * 0.25) * c.r;
      c.puffs.push({
        dx: Math.cos(a) * rr * 1.15, dz: Math.sin(a) * rr * 0.7,
        dy: i >= 8 ? 0.5 + Math.random() * 0.6 : (Math.random() - 0.5) * 0.4,
        s: (i === 0 ? 1.15 : i >= 8 ? 0.85 : 0.7 + Math.random() * 0.3) * c.r * 1.05,
      });
    }
    c.puffs.sort((p, q) => (p.dy - q.dy) || (p.dz - q.dz));   // lower and farther puffs first
    this.clouds.push(c);
  }

  /** The height a cloud floats at (storm clouds hang lower). */
  static height(storm) { return storm ? 5 + Math.random() * 1.2 : 7 + Math.random() * 2; }

  update(dt, { center, halfW, cover, storm, fog, windDir, wind, light, sky, camera, pitch, boat }) {
    const want = cover < 0.3 || fog > 0.5 ? 0 : Math.round(2 + (cover - 0.3) * 6 + storm * 2);   // cloudy ~4, storm ~8; fog hides them
    const live = this.clouds.filter(c => c.out < 0);
    const vx = windDir[0] * (0.5 + wind * 2.2), vz = windDir[1] * (0.5 + wind * 2.2);
    const isStorm = storm > 0.4;
    if (live.length < want && (this._spawnIn -= dt) <= 0 && this.clouds.length < MAX_CLOUDS) {
      this._spawnIn = live.length < want / 2 ? 0.4 + Math.random() * 0.6 : 2 + Math.random() * 3;   // the first few arrive quickly
      // a cloud floats above the sea, so to appear in view it sits nearer the
      // camera than the spot of sea in the middle of the screen
      const y = Clouds.height(isStorm);
      const cz = camera.position.z - (camera.position.y - y) / Math.tan(THREE.MathUtils.degToRad(pitch));
      const viewHalfW = halfW * (camera.position.y - y) / Math.max(camera.position.y - 1.2, 1);
      const inView = live.length < Math.ceil(want / 2);           // the first few appear in view; the rest drift in from upwind
      const across = (Math.random() - 0.5) * 1.7 * viewHalfW;
      const back = inView ? (Math.random() - 0.5) * viewHalfW : -(viewHalfW + 7);
      this._make(center.x - windDir[1] * across + windDir[0] * back, cz + windDir[0] * across + windDir[1] * back + (Math.random() - 0.5) * 6, y, isStorm);
    }
    if (live.length > want) live[0].out = 0;                       // too many (weather cleared): one fades away
    // when the weather turns stormy, fair clouds give way to storm clouds
    if (isStorm) for (const c of live) if (!c.storm && c.out < 0) { c.out = 0; break; }

    let n = 0;
    this.clouds = this.clouds.filter(c => {
      c.age += dt; c.x += vx * dt; c.z += vz * dt;
      if (c.out >= 0) c.out += dt;
      const downwind = (c.x - center.x) * windDir[0] + (c.z - center.z) * windDir[1];
      c.fade = Math.min(1, c.age / 4) * (c.out >= 0 ? Math.max(0, 1 - c.out / 4) : 1);
      if (downwind > halfW + 25 || (c.out >= 0 && c.fade <= 0)) return false;
      for (const p of c.puffs) {
        if (n >= MAX) break;
        this.center.set([c.x + p.dx, c.y + p.dy, c.z + p.dz], n * 3);
        this.size[n] = p.s; this.alpha[n] = c.fade; n++;
      }
      return true;
    });
    for (let i = n; i < MAX; i++) this.alpha[i] = 0;
    this.aCenter.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
    this.mesh.visible = n > 0;

    // white and sunlit on fair days (tinted by the sky: gold at sunset), slate in a storm, dim at night
    const U = this.uniforms;
    U.uLit.value.copy(sky).lerp(WHITE, 0.6).lerp(SLATE, storm * 0.8).multiplyScalar(0.4 + 0.6 * light);
    U.uShade.value.copy(U.uLit.value).multiplyScalar(0.78).lerp(BLUEGREY, 0.22 * (1 - storm)).multiplyScalar(1 - storm * 0.15);
    U.uInk.value.copy(U.uShade.value).multiplyScalar(0.55);
    U.uAspect.value = camera.aspect;
    if (boat) { this._v.set(boat.x, boat.y, boat.z).project(camera); U.uBoatNdc.value.set(this._v.x, this._v.y); }
  }

  /** Shadows straight below the clouds, for the ocean shader: up to 8 × (x, z, radius, strength). */
  shadows(out) {
    out.forEach((v, i) => { const c = this.clouds[i]; if (c) v.set(c.x, c.z, c.r * 1.15, c.fade * (c.storm ? 0.85 : 0.6)); else v.w = 0; });
  }

  /** The base of the storm cloud nearest (x, z), for lightning to come out of; or null. */
  boltSource(x, z) {
    let best = null, bd = Infinity;
    for (const c of this.clouds) if (c.storm && c.fade > 0.5 && c.out < 0) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
    if (!best || bd > 30) return null;
    return new THREE.Vector3(best.x + (Math.random() - 0.5) * best.r * 0.6, best.y - 0.6, best.z + (Math.random() - 0.5) * best.r * 0.4);
  }
}
