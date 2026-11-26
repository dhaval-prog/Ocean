import * as THREE from 'three';

// One draw call for every ambient particle:
//   kind 0  glints  – lights that drift up off the water (dusk / night)
//   kind 1  petals  – pink petals riding the wind (dawn / sunset)
//   kind 2  specks  – soft snow-like specks falling at night
// Particles live in a tile that wraps around the camera target, so they are
// always nearby wherever the camera looks.

const VERT = /* glsl */ `
attribute vec4 aSeed; attribute float aKind;
uniform float uTime; uniform vec3 uCenter; uniform float uTile; uniform float uPx; uniform vec3 uAmt; uniform float uWater; uniform float uStorm;
varying float vKind; varying float vAlpha; varying float vRot; varying float vTw;
vec3 wrap(vec3 p){ p.xz -= uTile*floor((p.xz - uCenter.xz)/uTile + 0.5); return p; }
void main() {
  vKind = aKind; float t = uTime; vec3 p; float size; float a;
  if (aKind < 0.5) {            // glint: rise from the surface, fade in and out
    float life = 5.0 + aSeed.w*4.0, lt = mod(t + aSeed.z*20.0, life) / life;
    p = vec3(aSeed.x*uTile, uWater + lt*3.5, aSeed.y*uTile);
    p.x += sin(t*0.7 + aSeed.z*20.0)*0.35; p.z += cos(t*0.5 + aSeed.w*20.0)*0.35;
    a = sin(lt*3.14159) * uAmt.x; size = 0.22;
  } else if (aKind < 1.5) {     // petal: carried by the wind, slowly sinking
    float sp = 1.4 + aSeed.w*1.2 + uStorm*2.0;
    p = vec3(aSeed.x*uTile + t*sp, uWater + 0.6 + mod(aSeed.z*4.0 - t*0.12*(0.5 + aSeed.w), 4.0), aSeed.y*uTile + sin(t*0.6 + aSeed.z*30.0)*1.5);
    p.y += sin(t*1.7 + aSeed.w*40.0)*0.25;
    a = uAmt.y * smoothstep(uWater + 0.6, uWater + 1.2, p.y); size = 0.45;
  } else {                      // speck: slow falling snow
    p = vec3(aSeed.x*uTile + t*0.3, uWater + mod(aSeed.z*12.0 - t*(0.35 + aSeed.w*0.3), 12.0), aSeed.y*uTile);
    p.x += sin(t*0.9 + aSeed.w*30.0)*0.4;
    a = uAmt.z * smoothstep(uWater, uWater + 1.0, p.y); size = 0.13;
  }
  p = wrap(p);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  a *= smoothstep(uTile*0.5, uTile*0.3, length(p.xz - uCenter.xz)) * smoothstep(0.5, 2.0, dist);
  vAlpha = a; vRot = t*(1.0 + aSeed.w*2.0) + aSeed.z*6.28; vTw = 0.6 + 0.4*sin(t*3.0 + aSeed.x*50.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = a <= 0.001 ? 0.0 : size*uPx*300.0/dist;
}`;

const FRAG = /* glsl */ `
uniform vec3 uGlint; uniform vec3 uPetal; uniform vec3 uSpeck;
varying float vKind; varying float vAlpha; varying float vRot; varying float vTw;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  vec3 col; float a;
  if (vKind < 0.5) {
    float r = length(q);
    a = (smoothstep(0.5, 0.0, r)*0.6 + smoothstep(0.12, 0.0, r)) * vTw;
    col = uGlint * 1.8;
  } else if (vKind < 1.5) {
    float c = cos(vRot), s = sin(vRot);
    q = mat2(c, -s, s, c) * q;
    q.x *= 1.0 + 0.6*abs(sin(vRot*0.7));                     // tumbling
    float shape = length(q*vec2(1.0, 1.9)) + 0.25*abs(q.x)*0.0;
    a = smoothstep(0.32, 0.26, shape);
    col = mix(uPetal, vec3(1.0), smoothstep(0.1, -0.2, q.y)*0.35);
  } else {
    float r = length(q);
    a = smoothstep(0.5, 0.1, r) * 0.8;
    col = uSpeck * 1.2;
  }
  a *= vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

export class Particles {
  constructor({ glints = 120, petals = 90, specks = 160, tile = 60 } = {}) {
    const n = glints + petals + specks;
    const seed = new Float32Array(n * 4), kind = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      seed.set([Math.random() - 0.5, Math.random() - 0.5, Math.random(), Math.random()], i * 4);
      kind[i] = i < glints ? 0 : i < glints + petals ? 1 : 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    this.uniforms = {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uTile: { value: tile }, uPx: { value: 1 },
      uAmt: { value: new THREE.Vector3() }, uWater: { value: 1.2 }, uStorm: { value: 0 },
      uGlint: { value: new THREE.Color('#b0fff6') }, uPetal: { value: new THREE.Color('#ffb7cf') }, uSpeck: { value: new THREE.Color('#e8f4ff') },
    };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  update(elapsed, { center, look, storm, pixelRatio, glintColor }) {
    const U = this.uniforms;
    U.uTime.value = elapsed;
    U.uCenter.value.copy(center);
    U.uAmt.value.set(look.glints, look.petals, look.specks);
    U.uStorm.value = storm;
    U.uPx.value = pixelRatio;
    if (glintColor) U.uGlint.value.copy(glintColor);
  }
}
