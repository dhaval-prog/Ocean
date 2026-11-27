import * as THREE from 'three';

// A hail burst: little white pellets that drop fast, hit the water and bounce
// once before vanishing. One draw call; the GPU animates every pellet.

const VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform vec3 uCenter; uniform float uTile; uniform float uPx; uniform float uHail; uniform vec2 uWind; uniform float uWater;
varying float vAlpha;
void main() {
  float H = 16.0, per = 0.9 + aSeed.w*0.5;
  float ph = fract(uTime/per + aSeed.z*7.0);
  vec3 p = vec3(aSeed.x*uTile, 0.0, aSeed.y*uTile);
  float a = 1.0;
  if (ph < 0.78) {                                    // falling
    float k = ph/0.78;
    p.y = uWater + H*(1.0 - k);
    p.xz += uWind*(1.0 - k)*2.0;
  } else {                                            // one little bounce off the water
    float k = (ph - 0.78)/0.22;
    p.y = uWater + 4.0*k*(1.0 - k)*(0.35 + 0.4*fract(aSeed.x*19.3));
    p.xz += vec2(fract(aSeed.y*7.7) - 0.5, fract(aSeed.z*5.3) - 0.5)*k*0.8;
    a = 1.0 - k*k;
  }
  p.xz -= uTile*floor((p.xz - uCenter.xz)/uTile + 0.5);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  vAlpha = a * step(aSeed.w, uHail) * smoothstep(uTile*0.5, uTile*0.3, length(p.xz - uCenter.xz)) * smoothstep(1.0, 4.0, dist);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vAlpha <= 0.001 ? 0.0 : (0.3 + 0.15*fract(aSeed.z*11.1))*uPx*300.0/dist;
}`;
const FRAG = /* glsl */ `
uniform vec3 uColor; varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord - 0.5; float d = length(q);
  if (d > 0.5) discard;
  vec3 col = mix(uColor, uColor*0.6, smoothstep(0.0, 0.5, q.x + q.y));   // shaded ice pellet
  col = mix(col, vec3(0.3, 0.35, 0.45), smoothstep(0.36, 0.48, d));       // thin ink rim
  gl_FragColor = vec4(col, vAlpha);
}`;

export class Hail {
  constructor(count = 700, tile = 40) {
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) seed.set([Math.random() - 0.5, Math.random() - 0.5, Math.random(), Math.random()], i * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.uniforms = {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uTile: { value: tile }, uPx: { value: 1 },
      uHail: { value: 0 }, uWind: { value: new THREE.Vector2() }, uWater: { value: 1.2 }, uColor: { value: new THREE.Color('#f4f8ff') },
    };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 13;
  }

  update(elapsed, { center, hail, windDir, wind, pixelRatio, light }) {
    const U = this.uniforms;
    U.uTime.value = elapsed; U.uCenter.value.copy(center); U.uPx.value = pixelRatio; U.uHail.value = hail;
    U.uWind.value.set(windDir[0], windDir[1]).multiplyScalar(0.5 + wind);
    U.uColor.value.setScalar(0.55 + 0.45 * light);
    this.points.visible = hail > 0.01;
  }
}
