import * as THREE from 'three';

// Life on the sea, all in one draw call (points lying on the water):
//   kind 0  fish shadows swimming in schools
//   kind 1  leaves floating with the current
//   kind 2  seagull shadows gliding across
// Everything lives in tiles that wrap around the camera, so there is always
// something nearby wherever you pan.

const VERT = /* glsl */ `
attribute vec4 aSeed; attribute float aKind; attribute float aRank;
uniform float uTime; uniform float uFlow; uniform vec2 uWind; uniform vec3 uCenter; uniform float uWater; uniform float uPxPerUnit;
varying float vKind; varying float vAng; varying float vSeed; varying float vAlpha; varying float vPx;
vec2 wrap2(vec2 p, float tile) { return p - tile*floor((p - uCenter.xz)/tile + 0.5); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
void main() {
  vKind = aKind; vSeed = aSeed.w;
  vec2 pos; float size, tile;
  if (aKind < 0.5) {               // fish: a leader wanders, the school follows in formation
    tile = 70.0;
    float t = uTime*0.06*(0.7 + aSeed.w) + aSeed.z*6.283;
    vec2 lead = aSeed.xy*tile + vec2(sin(t), sin(t*0.73 + 1.0))*10.0;
    vec2 vel = vec2(cos(t), 0.73*cos(t*0.73 + 1.0));
    vAng = atan(vel.y, vel.x);
    float r = aRank, row = floor((r + 1.0)*0.5);
    vec2 off = vec2(-row*0.95, (mod(r, 2.0)*2.0 - 1.0)*row*0.6*step(0.5, r));
    off += vec2(sin(uTime*1.3 + r*2.1), cos(uTime*1.1 + r*1.7))*0.12;
    pos = lead + rot(vAng)*off;
    size = 1.1; vAlpha = 0.3;
  } else if (aKind < 1.5) {        // leaf: carried by the current
    tile = 60.0;
    pos = aSeed.xy*tile + uWind*uFlow*0.95;
    vAng = aSeed.z*6.283 + uTime*0.25*(aSeed.w - 0.5);
    size = 0.8; vAlpha = 1.0;
  } else {                          // seagull shadow
    tile = 140.0;
    float a = aSeed.z*6.283; vec2 dir = vec2(cos(a), sin(a));
    pos = aSeed.xy*tile + dir*uTime*(5.0 + aSeed.w*2.0);
    vAng = a; size = 2.6; vAlpha = 0.2;
  }
  pos = wrap2(pos, tile);
  vec4 w = vec4(pos.x, uWater + 0.02, pos.y, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
  vPx = size*uPxPerUnit;
  gl_PointSize = vPx;
}`;

const FRAG = /* glsl */ `
uniform float uTime; uniform float uNight; uniform vec3 uShadow; uniform vec3 uInk;
varying float vKind; varying float vAng; varying float vSeed; varying float vAlpha; varying float vPx;
float aa(float d) { float f = max(fwidth(d), 1e-4); return 1.0 - smoothstep(-f, f, d); }  // inside when d < 0
void main() {
  vec2 lp = gl_PointCoord - 0.5;
  float c = cos(vAng), s = sin(vAng);
  vec2 l = vec2(c*lp.x + s*lp.y, -s*lp.x + c*lp.y);     // x = forward
  vec3 col; float a;
  if (vKind < 0.5) {
    vec2 tl = l - vec2(-0.27, sin(uTime*9.0 + vSeed*30.0)*0.05);
    float body = length((l - vec2(0.06, 0.0))*vec2(2.7, 6.0)) - 1.0;
    float tail = max(max(-tl.x - 0.17, tl.x), abs(tl.y) + tl.x*0.9);
    a = aa(min(body, tail*8.0)) * vAlpha * (1.0 - uNight*0.5);
    col = uShadow;
  } else if (vKind < 1.5) {
    float leaf = abs(l.y) - 0.2*(1.0 - pow(abs(l.x)/0.42, 2.0));
    float inside = aa(leaf) * step(abs(l.x), 0.42);
    float stem = aa(abs(l.y) - 0.015) * step(l.x, -0.38) * step(-0.48, l.x);
    float vein = aa(abs(l.y) - 0.01) * step(abs(l.x), 0.36);
    float outline = aa(abs(leaf) - 0.02) * step(abs(l.x), 0.43);
    vec3 green = mix(vec3(0.45, 0.8, 0.35), vec3(0.95, 0.7, 0.3), step(0.6, vSeed)) * mix(1.0, 0.45, uNight);
    col = mix(green, green*0.6, vein);
    col = mix(col, uInk, outline*0.8);
    a = max(inside, max(stem, outline));
    col = mix(col, uInk, stem);
  } else {
    float flap = 0.55 + 0.45*sin(uTime*5.0 + vSeed*20.0);
    float x = l.x + abs(l.y)*0.6*flap;
    float wing = abs(x) - 0.06*(1.0 - abs(l.y)/0.46);
    float g = max(wing, abs(l.y) - 0.46);
    float body = length(l*vec2(5.0, 9.0)) - 1.0;
    a = aa(min(g, body*0.1)) * vAlpha * (1.0 - uNight*0.6);
    col = uShadow;
  }
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

export class SeaLife {
  constructor({ schools = 4, perSchool = 7, leaves = 14, gulls = 3 } = {}) {
    const n = schools * perSchool + leaves + gulls;
    const seed = new Float32Array(n * 4), kind = new Float32Array(n), rank = new Float32Array(n);
    let i = 0;
    const r = () => Math.random();
    for (let sc = 0; sc < schools; sc++) {
      const s = [r() - 0.5, r() - 0.5, r(), r()];
      for (let f = 0; f < perSchool; f++, i++) { seed.set(s, i * 4); seed[i * 4 + 3] = s[3]; kind[i] = 0; rank[i] = f; }
    }
    for (let l = 0; l < leaves; l++, i++) { seed.set([r() - 0.5, r() - 0.5, r(), r()], i * 4); kind[i] = 1; }
    for (let g = 0; g < gulls; g++, i++) { seed.set([r() - 0.5, r() - 0.5, r(), r()], i * 4); kind[i] = 2; }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    geo.setAttribute('aRank', new THREE.BufferAttribute(rank, 1));
    this.uniforms = {
      uTime: { value: 0 }, uFlow: { value: 0 }, uWind: { value: new THREE.Vector2(1, 0) },
      uCenter: { value: new THREE.Vector3() }, uWater: { value: 1.2 }, uPxPerUnit: { value: 20 },
      uNight: { value: 0 }, uShadow: { value: new THREE.Color('#0a1840') }, uInk: { value: new THREE.Color('#1d3a2a') },
    };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  update(elapsed, { center, ocean, pxPerUnit }) {
    const U = this.uniforms;
    U.uTime.value = elapsed;
    U.uFlow.value = ocean.flow;
    U.uWind.value.copy(ocean.uniforms.uWind.value);
    U.uCenter.value.copy(center);
    U.uWater.value = ocean.base;
    U.uPxPerUnit.value = pxPerUnit;
    U.uNight.value = ocean.look.night;
  }
}
