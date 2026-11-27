import * as THREE from 'three';

// Falling rain: short pale streaks in a tile that wraps around the camera
// target, slanted by the wind. One draw call; the GPU moves every drop.
// (The rings the drops make on the water are drawn by the ocean shader.)

const VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform vec3 uCenter; uniform float uTile; uniform float uPx; uniform float uRain; uniform vec2 uWind; uniform float uWater;
varying float vAlpha;
void main() {
  float H = 14.0, speed = 13.0 + aSeed.w*5.0;
  float fall = mod(aSeed.z*H + uTime*speed, H);
  vec3 p = vec3(aSeed.x*uTile, uWater + H - fall, aSeed.y*uTile);
  p.xz += uWind * fall * 0.35;                          // slanted by the wind
  p.xz -= uTile*floor((p.xz - uCenter.xz)/uTile + 0.5); // wrap around the view
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  float on = step(aSeed.w, uRain);                       // more drops the heavier the rain
  vAlpha = on * smoothstep(uTile*0.5, uTile*0.3, length(p.xz - uCenter.xz)) * smoothstep(1.0, 4.0, dist) * (0.55 + 0.3*uRain);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vAlpha <= 0.001 ? 0.0 : 2.0*uPx*300.0/dist;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uSlant;
varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float x = q.x - q.y*uSlant;
  float a = smoothstep(0.03, 0.008, abs(x)) * smoothstep(0.5, 0.25, abs(q.y)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`;

export class Rain {
  constructor(count = 900, tile = 44) {
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) seed.set([Math.random() - 0.5, Math.random() - 0.5, Math.random(), Math.random()], i * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.uniforms = {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uTile: { value: tile }, uPx: { value: 1 },
      uRain: { value: 0 }, uWind: { value: new THREE.Vector2(1, 0) }, uWater: { value: 1.2 },
      uColor: { value: new THREE.Color('#e6f2ff') }, uSlant: { value: 0 },
    };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 12;
  }

  update(elapsed, { center, rain, wind, windDir, pixelRatio, light }) {
    const U = this.uniforms;
    U.uTime.value = elapsed; U.uCenter.value.copy(center); U.uPx.value = pixelRatio;
    U.uRain.value = rain;
    U.uWind.value.set(windDir[0], windDir[1]).multiplyScalar(0.4 + wind);
    U.uSlant.value = -windDir[0] * (0.15 + wind * 0.35);   // screen x follows world x (north-up view)
    U.uColor.value.setRGB(0.8 + 0.1 * light, 0.86 + 0.08 * light, 1.0);
    this.points.visible = rain > 0.01;
  }
}
