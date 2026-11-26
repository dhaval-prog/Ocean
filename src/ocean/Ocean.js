import * as THREE from 'three';
import { TIMES } from './palettes.js';
import { GLSL_COMMON, GLSL_VERTEX, GLSL_FRAGMENT } from './shaders.js';

// CPU-side noise matching the static base shape of the surface.
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const sm = t => t * t * (3 - 2 * t);
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
const fbm = (x, y, o = 4) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { v += a * noise(x * f, y * f); f *= 2.03; a *= 0.5; } return v; };
const baseHeight = (x, z) => 0.08 * Math.sin(x * 0.9 + z * 0.35) + 0.05 * Math.sin(-x * 0.4 + z * 1.3) + 0.12 * (fbm(x * 0.35, z * 0.35, 3) - 0.5);
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * A large stylized ocean surface that fades into the sky at its edges.
 *
 *   const ocean = new Ocean();
 *   scene.add(ocean.mesh);
 *   ocean.update(dt, elapsed);           // every frame
 *   ocean.setTimeOfDay(2.5);             // 0 Dawn … 4 Night (wraps, blends)
 *   ocean.storm = 0.6;                   // 0 calm … 1 stormy
 *   ocean.foam = 0.35;                   // 0 none … 1 original amount
 *   ocean.getHeightAt(x, z);             // water height for floating objects
 */
export class Ocean {
  constructor({ size = 300, segments = 300, base = 1.2, fade = size * 0.2 } = {}) {
    this.size = size;
    this.base = base;
    this.storm = 0.3;
    this.reef = false;
    this.foam = 0.35; // 0 … 1 (1 = original look)
    this.flow = 0;

    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, base + baseHeight(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();

    const hex = s => new THREE.Color(s);
    this.uniforms = {
      uTime: { value: 0 }, uFlow: { value: 0 },
      uWind: { value: new THREE.Vector2(1, 0.35).normalize() },
      uHalf: { value: size / 2 }, uFade: { value: fade }, uFarScale: { value: 12 },
      uPalA: { value: TIMES[1].pal.map(hex) }, uPalB: { value: TIMES[1].pal.map(hex) },
      uFxA: { value: new THREE.Vector4(...TIMES[1].fx) }, uFxB: { value: new THREE.Vector4(...TIMES[1].fx) },
      uMix: { value: 0 }, uStorm: { value: this.storm }, uReef: { value: 0 }, uFoam: { value: 0.35 },
      uSun: { value: new THREE.Vector2(-3, -6.5) },
      uRipples: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -99, 0)) },
      uObjects: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 1, 0)) },
    };

    const mat = new THREE.MeshStandardMaterial({ name: 'water_surface', roughness: 0.85, metalness: 0, transparent: true, depthWrite: false });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec2 vLP;' + GLSL_COMMON)
        .replace('#include <begin_vertex>', GLSL_VERTEX)
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec2 vLP;' + GLSL_COMMON)
        .replace('#include <color_fragment>', GLSL_FRAGMENT)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 7.4;');
    };

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = 'ocean';
    this.mesh.frustumCulled = false;

    // Current blended look, read by the app for sky + lights.
    this.skyColor = new THREE.Color(TIMES[1].pal[9]);
    this.skyTopColor = new THREE.Color();
    this.light = 1;
    this.timeName = 'Day';
    this.look = { sunDir: new THREE.Vector3(), moon: 0, rays: 0, stars: 0, petals: 0, specks: 0, glints: 0, night: 0 };
    this._ripple = 0;
    // Where the default camera sits; the water's sun reflection is placed for this view.
    this.viewer = new THREE.Vector3(0, 7, 22);
    this._tmp = new THREE.Color();
    this.setTimeOfDay(1);
  }

  /** f in [0, 5): integer = preset, fractions blend to the next preset. */
  setTimeOfDay(f) {
    const n = TIMES.length; f = ((f % n) + n) % n;
    const i = Math.floor(f), j = (i + 1) % n, k = f - i, e = sm(k);
    const U = this.uniforms;
    U.uPalA.value.forEach((c, m) => c.set(TIMES[i].pal[m]));
    U.uPalB.value.forEach((c, m) => c.set(TIMES[j].pal[m]));
    U.uFxA.value.set(...TIMES[i].fx); U.uFxB.value.set(...TIMES[j].fx);
    U.uMix.value = k; // the shader eases and sweeps far → near
    this.skyColor.set(TIMES[i].pal[9]).lerp(this._tmp.set(TIMES[j].pal[9]), e);
    this.skyTopColor.set(TIMES[i].pal[2]).lerp(this._tmp.set(TIMES[j].pal[2]), e).lerp(this.skyColor, 0.55);
    this.light = TIMES[i].light + (TIMES[j].light - TIMES[i].light) * e;
    const L = this.look, A = TIMES[i].sky, B = TIMES[j].sky, lerp = (a, b) => a + (b - a) * e;
    for (const key of ['moon', 'rays', 'stars', 'petals', 'specks', 'glints']) L[key] = lerp(A[key], B[key]);
    L.night = lerp(TIMES[i].fx[2], TIMES[j].fx[2]);
    const el = lerp(A.el, B.el);
    L.sunDir.set(-0.09 * Math.cos(el), Math.sin(el), -Math.cos(el)).normalize();
    // Put the sun/moon reflection on the water where the default view would see it.
    const h = this.viewer.y - this.base, dist = Math.min(50, Math.max(8, h / Math.tan(Math.max(el, 0.02))));
    U.uSun.value.set(this.viewer.x - 0.09 * dist, this.viewer.z - dist);
    this.timeName = TIMES[Math.round(f) % n].name;
    this.timeOfDay = f;
  }

  update(dt, elapsed) {
    const U = this.uniforms;
    U.uTime.value = elapsed;
    U.uStorm.value = this.storm;
    U.uFoam.value = this.foam;
    this.flow += dt * (0.55 + 1.6 * this.storm);
    U.uFlow.value = this.flow;
    U.uReef.value += ((this.reef ? 1 : 0) - U.uReef.value) * Math.min(1, dt * 3);
  }

  /** Splash at (x, z): an expanding ring (foam by day, glow by night). */
  addRipple(x, z, strength = 1) {
    const r = this.uniforms.uRipples.value[this._ripple++ % 8];
    r.set(x, z, this.uniforms.uTime.value, strength);
  }

  /**
   * Foam rings for floating objects (boats, players). Up to 4.
   * @param {{x:number, z:number, radius?:number}[]} list
   */
  setObjects(list) {
    this.uniforms.uObjects.value.forEach((o, i) => {
      const it = list[i];
      if (it) o.set(it.x, it.z, it.radius ?? 1, 1); else o.w = 0;
    });
  }

  /** World-space water height at (x, z): matches the vertex shader. */
  getHeightAt(x, z) {
    const w = this.uniforms.uWind.value, s = this.storm, fl = this.flow, half = this.size / 2;
    const edge = smoothstep(half, half - 1.5, Math.max(Math.abs(x), Math.abs(z)));
    const amp = edge * (0.5 + 2.2 * s);
    const wave = 0.05 * Math.sin((x * w.x + z * w.y) * 1.4 - fl * 1.6)
               + 0.03 * Math.sin((-x * w.y + z * w.x) * 2.1 + fl * 1.1)
               + 0.04 * s * Math.sin((x * 0.3 + z) * 3.3 - fl * 2.7);
    return this.base + baseHeight(x, z) + amp * wave;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
