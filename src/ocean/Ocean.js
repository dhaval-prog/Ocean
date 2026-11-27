import * as THREE from 'three';
import { TIMES, STYLES, stylePalette } from './palettes.js';
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
 * A large cartoon ocean surface, viewed from above.
 *
 *   const ocean = new Ocean();
 *   scene.add(ocean.mesh);
 *   ocean.update(dt, elapsed);           // every frame
 *   ocean.setTimeOfDay(2.5);             // 0 Dawn … 4 Night (wraps, blends)
 *   ocean.storm = 0.6;                   // 0 calm … 1 stormy
 *   ocean.foam = 0.35;                   // 0 none … 1 original amount
 *   ocean.setStyle('tropical');          // ocean colour: deep, tropical, nordic, pastel
 *   ocean.getHeightAt(x, z);             // water height for floating objects
 */
export class Ocean {
  constructor({ size = 300, segments = 300, base = 1.2, fade = size * 0.2 } = {}) {
    this.size = size;
    this.base = base;
    this.storm = 0.3;
    this.reef = false;
    this.foam = 0.35; // 0 … 1 (1 = original look)
    this.glitter = 0.3; // cartoon twinkles, 0 … 1
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
      uHalf: { value: size / 2 }, uFade: { value: fade }, uFarScale: { value: 18 }, uViewDir: { value: new THREE.Vector2(0, -1) },
      uPalA: { value: TIMES[1].pal.map(hex) }, uPalB: { value: TIMES[1].pal.map(hex) },
      uFxA: { value: new THREE.Vector4(...TIMES[1].fx) }, uFxB: { value: new THREE.Vector4(...TIMES[1].fx) },
      uMix: { value: 0 }, uStorm: { value: this.storm }, uReef: { value: 0 }, uFoam: { value: 0.35 }, uGlitter: { value: 0.3 },
      uRipples: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, -99, 0)) },
      uObjects: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 1, 0)) },
      uBoat: { value: new THREE.Vector4(0, 0, 0, 0) }, uBoatSize: { value: new THREE.Vector2(1.9, 0.7) },
      uBoatShadow: { value: 0 },   // 0 … 1, soft shadow under the boat (0 before it loads / while sunk)
      // sun (moon at night) low over the sea, north-north-east: its path of light
      // on the water runs from the viewer toward it, so it moves as the view turns
      uLightDir: { value: new THREE.Vector2(0.22, -1).normalize() },
      uLightCol: { value: new THREE.Color('#fff6e2') }, uRefl: { value: 0.55 },
      // weather (set by the app from Weather each frame)
      uClouds: { value: 0 }, uCloudT: { value: 0 }, uRain: { value: 0 }, uFog: { value: 0 }, uFogCol: { value: new THREE.Color('#dfe6ea') },
      uFlash: { value: 0 }, uRainbow: { value: 0 }, uThunder: { value: 0 }, uFlashPos: { value: new THREE.Vector2() },
      uFlashCol: { value: new THREE.Color('#e8f0ff') }, uRainCol: { value: new THREE.Color('#e4ecf4') },
      uRainbowPos: { value: new THREE.Vector2() }, uRainbowS: { value: 28 }, uBowMoon: { value: 0 },
      uBeams: { value: Array.from({ length: 3 }, () => new THREE.Vector4(0, 0, 1, 0)) },   // sunbeams through the clouds: x, z, radius, strength
      uSpot: { value: new THREE.Vector4(0, 0, 1, 0) },                                        // boat searchlight on the water: x, z, radius, strength
      uBoatGlow: { value: 0 },
      uCloudBlobs: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 1, 0)) },                                                                // gold glow round the boat in a sunbeam
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
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 6.4;');
    };

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = 'ocean';
    this.mesh.frustumCulled = false;

    // Current blended look, read by the app for sky + lights.
    this.skyColor = new THREE.Color(TIMES[1].pal[9]);
    this.skyTopColor = new THREE.Color();
    this.light = 1;
    this.timeName = 'Day';
    this.look = { petals: 0, specks: 0, glints: 0, night: 0 };
    this._ripple = 0;
    this._tmp = new THREE.Color();
    this.fogTint = new THREE.Color('#dfe6ea');
    this.style = 'deep';
    this.setTimeOfDay(1);
  }

  /** f in [0, 5): integer = preset, fractions blend to the next preset. */
  setTimeOfDay(f) {
    const n = TIMES.length; f = ((f % n) + n) % n;
    const i = Math.floor(f), j = (i + 1) % n, k = f - i, e = sm(k);
    const U = this.uniforms;
    const A = stylePalette(TIMES[i].pal, this.style, TIMES[i].light), B = stylePalette(TIMES[j].pal, this.style, TIMES[j].light);
    U.uPalA.value.forEach((c, m) => c.set(A[m]));
    U.uPalB.value.forEach((c, m) => c.set(B[m]));
    U.uFxA.value.set(...TIMES[i].fx); U.uFxB.value.set(...TIMES[j].fx);
    U.uMix.value = k; // the shader eases and sweeps far → near
    U.uLightCol.value.set(TIMES[i].sun[0]).lerp(this._tmp.set(TIMES[j].sun[0]), e);
    // weather tinted by the light: rain, lightning and fog colours for this time
    U.uRainCol.value.set(TIMES[i].wx.rain).lerp(this._tmp.set(TIMES[j].wx.rain), e);
    U.uFlashCol.value.set(TIMES[i].wx.bolt).lerp(this._tmp.set(TIMES[j].wx.bolt), e);
    this.fogTint.set(TIMES[i].wx.fog).lerp(this._tmp.set(TIMES[j].wx.fog), e);
    U.uRefl.value = TIMES[i].sun[1] + (TIMES[j].sun[1] - TIMES[i].sun[1]) * e;
    this.skyColor.set(A[9]).lerp(this._tmp.set(B[9]), e);
    this.skyTopColor.set(A[2]).lerp(this._tmp.set(B[2]), e).lerp(this.skyColor, 0.55);
    this.light = TIMES[i].light + (TIMES[j].light - TIMES[i].light) * e;
    const L = this.look, aA = TIMES[i].ambient, aB = TIMES[j].ambient, lerp = (a, b) => a + (b - a) * e;
    for (const key of ['petals', 'specks', 'glints']) L[key] = lerp(aA[key], aB[key]);
    L.night = lerp(TIMES[i].fx[2], TIMES[j].fx[2]);
    this.timeName = TIMES[Math.round(f) % n].name;
    this.timeOfDay = f;
  }

  /** Ocean colour style: 'deep' (default), 'tropical', 'nordic' or 'pastel'. */
  setStyle(id) {
    this.style = STYLES[id] ? id : 'deep';
    this.setTimeOfDay(this.timeOfDay);
  }

  /** Apply the current weather (see Weather.js): smoothed values, wind direction, flash, rainbow. */
  setWeather(wx, dt) {
    const U = this.uniforms, c = wx.cur;
    this.storm = c.storm; this.foam = c.foam;
    U.uClouds.value = c.clouds; U.uFog.value = c.fog; U.uThunder.value = c.thunder;
    U.uFlash.value = wx.flash;
    // rainbow needs sun and no rain or fog; on rare clear nights it is a pale moonbow
    const day = Math.max(0, (this.light - 0.5) / 0.5), night = THREE.MathUtils.clamp((0.5 - this.light) / 0.2, 0, 1);
    const moon = wx.moonbow ? night * (c.clouds < 0.55 ? 1 : 0) * 0.7 : 0;
    U.uRainbow.value = wx.rainbow * Math.max(day, moon) * (1 - c.rain) * (1 - c.fog);
    U.uBowMoon.value = day > moon ? 0 : 1;
    U.uRain.value = Math.max(c.rain, wx.hail * 0.9);          // hail pocks the water too
    U.uCloudT.value += dt * (1 + c.storm * 2 + c.thunder * 3);    // clouds race in a thunderstorm
    U.uWind.value.set(wx.windDir[0], wx.windDir[1]);
  }

  update(dt, elapsed) {
    const U = this.uniforms;
    U.uTime.value = elapsed;
    U.uStorm.value = this.storm;
    U.uFoam.value = this.foam;
    U.uGlitter.value = this.glitter;
    this.flow += dt * (0.55 + 1.6 * this.storm);
    U.uFlow.value = this.flow;
    U.uReef.value += ((this.reef ? 1 : 0) - U.uReef.value) * Math.min(1, dt * 3);
  }

  /** Something drops in the water at (x, z): splash + spreading rings (foam by day, glow by night). */
  addRipple(x, z, strength = 1) {
    const r = this.uniforms.uRipples.value[this._ripple++ % 12];
    r.set(x, z, this.uniforms.uTime.value, strength);
  }

  /**
   * Foam rings for floating objects (boats, players). Up to 4.
   * @param {{x:number, z:number, radius?:number}[]} list
   */
  /** Boat wake: position, heading (radians, 0 = +x, π/2 = up on screen), speed 0..1, bow distance, half beam. */
  setBoat(x, z, heading, speed01, bow = 1.9, halfBeam = 0.7) {
    this.uniforms.uBoat.value.set(x, z, heading, speed01);
    this.uniforms.uBoatSize.value.set(bow, halfBeam);
  }

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
