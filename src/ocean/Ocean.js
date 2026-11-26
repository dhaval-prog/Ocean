import * as THREE from 'three';
import { TIMES } from './palettes.js';
import { makeNoiseTexture } from './noise.js';
import { WATER_VERT, WATER_FRAG } from './shaders.js';

const sm = t => t * t * (3 - 2 * t);

/**
 * Endless top-down cartoon ocean: one flat quad that follows the camera.
 *
 *   const ocean = new Ocean();
 *   scene.add(ocean.mesh);
 *   ocean.follow(x, z, size);            // every frame: centre + size of the visible area
 *   ocean.update(dt, elapsed);           // every frame
 *   ocean.setTimeOfDay(2.5);             // 0 Dawn … 4 Night (wraps, blends)
 *   ocean.storm = 0.6;                   // 0 calm … 1 stormy
 *   ocean.foam = 0.35;                   // 0 … 1
 *   ocean.glitter = 0.3;                 // twinkles, 0 … 1
 *   ocean.addRipple(x, z);               // splash
 *   ocean.setObjects([{ x, z, radius }]) // foam rings around floating things
 *   ocean.setIsland(x, z, radius)        // the cartoon island (radius 0 hides it)
 */
export class Ocean {
  constructor({ base = 1.2 } = {}) {
    this.base = base;
    this.storm = 0.3;
    this.reef = false;
    this.foam = 0.35;
    this.glitter = 0.3;
    this.flow = 0;
    this.flowSpeed = 0;

    const hex = s => new THREE.Color(s);
    this.uniforms = {
      uNoise: { value: makeNoiseTexture() },
      uTime: { value: 0 }, uFlow: { value: 0 },
      uWind: { value: new THREE.Vector2(1, 0.35).normalize() },
      uPalA: { value: TIMES[1].pal.map(hex) }, uPalB: { value: TIMES[1].pal.map(hex) },
      uFxA: { value: new THREE.Vector4(...TIMES[1].fx) }, uFxB: { value: new THREE.Vector4(...TIMES[1].fx) },
      uMix: { value: 0 }, uStorm: { value: this.storm }, uReef: { value: 0 }, uFoam: { value: this.foam },
      uGlitter: { value: this.glitter }, uLight: { value: 1 },
      uRipples: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -99, 0)) },
      uObjects: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 1, 0)) },
      uIsland: { value: new THREE.Vector4(15, -7, 4, 1) },
    };

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, uniforms: this.uniforms }),
    );
    this.mesh.name = 'ocean';
    this.mesh.frustumCulled = false;
    this.mesh.position.y = base;

    this.skyColor = new THREE.Color(TIMES[1].pal[9]);
    this.skyTopColor = new THREE.Color();
    this.light = 1;
    this.timeName = 'Day';
    this.look = { petals: 0, specks: 0, glints: 0, night: 0 };
    this._ripple = 0;
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
    U.uMix.value = k;
    this.skyColor.set(TIMES[i].pal[9]).lerp(this._tmp.set(TIMES[j].pal[9]), e);
    this.skyTopColor.set(TIMES[i].pal[2]).lerp(this._tmp.set(TIMES[j].pal[2]), e).lerp(this.skyColor, 0.55);
    this.light = TIMES[i].light + (TIMES[j].light - TIMES[i].light) * e;
    U.uLight.value = this.light;
    const L = this.look, A = TIMES[i].ambient, B = TIMES[j].ambient, lerp = (a, b) => a + (b - a) * e;
    for (const key of ['petals', 'specks', 'glints']) L[key] = lerp(A[key], B[key]);
    L.night = lerp(TIMES[i].fx[2], TIMES[j].fx[2]);
    this.timeName = TIMES[Math.round(f) % n].name;
    this.timeOfDay = f;
  }

  /** Keep the water under the camera. size = width of the visible square area. */
  follow(x, z, size) {
    this.mesh.position.set(x, this.base, z);
    this.mesh.scale.set(size, 1, size);
  }

  update(dt, elapsed) {
    const U = this.uniforms;
    U.uTime.value = elapsed;
    U.uStorm.value = this.storm;
    U.uFoam.value = this.foam;
    U.uGlitter.value = this.glitter;
    this.flowSpeed = 0.9 + 2.2 * this.storm;     // world units / second along the wind
    this.flow += dt * this.flowSpeed;
    U.uFlow.value = this.flow;
    U.uReef.value += ((this.reef ? 1 : 0) - U.uReef.value) * Math.min(1, dt * 3);
  }

  addRipple(x, z, strength = 1) {
    const r = this.uniforms.uRipples.value[this._ripple++ % 8];
    r.set(x, z, this.uniforms.uTime.value, strength);
  }

  /** @param {{x:number, z:number, radius?:number}[]} list up to 4 */
  setObjects(list) {
    this.uniforms.uObjects.value.forEach((o, i) => {
      const it = list[i];
      if (it) o.set(it.x, it.z, it.radius ?? 1, 1); else o.w = 0;
    });
  }

  setIsland(x, z, radius) { this.uniforms.uIsland.value.set(x, z, radius, radius > 0 ? 1 : 0); }

  /** Water height for floating objects: the surface is flat from above, plus a gentle bob. */
  getHeightAt(x, z) {
    return this.base + 0.04 * Math.sin(x * 0.7 + this.flow * 1.3) * Math.cos(z * 0.6 - this.flow);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.uniforms.uNoise.value.dispose();
  }
}
