import * as THREE from 'three';

// Falling rain: thin, motion-blurred streaks of different lengths and
// brightness in a tile that wraps around the camera target, slanted by the
// wind and falling heaviest in broad sheets that sweep across (the same
// sheets darken and pit the water in the ocean shader). One draw call.
// (The rings the drops make on the water are drawn by the ocean shader.)

const VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform vec3 uCenter; uniform float uTile; uniform float uPx; uniform float uRain; uniform vec2 uWind; uniform float uWater;
varying float vAlpha; varying float vLen;
float rainSheet(vec2 p, vec2 w, float t){ vec2 wp = vec2(-w.y, w.x);
  return clamp(0.5 + 0.5*sin(dot(p, wp)*0.11 - t*0.35)*sin(dot(p, w)*0.07 - t*0.5 + 1.3) + 0.25*sin(dot(p, w)*0.031 + dot(p, wp)*0.023 - t*0.21), 0.0, 1.0); }
void main() {
  float H = 14.0, speed = 13.0 + aSeed.w*5.0;
  float fall = mod(aSeed.z*H + uTime*speed, H);
  vec3 p = vec3(aSeed.x*uTile, uWater + H - fall, aSeed.y*uTile);
  p.xz += uWind * fall * 0.35;                          // slanted by the wind
  p.xz -= uTile*floor((p.xz - uCenter.xz)/uTile + 0.5); // wrap around the view
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  vec2 wd = length(uWind) > 0.0 ? normalize(uWind) : vec2(1.0, 0.0);
  float density = uRain * (0.45 + 0.75*rainSheet(p.xz, wd, uTime));
  float on = step(aSeed.w, density);                     // more drops the heavier the rain, in sheets
  float bright = 0.5 + 0.45*fract(aSeed.z*13.7);        // every drop a little different
  vAlpha = on * bright * smoothstep(uTile*0.5, uTile*0.3, length(p.xz - uCenter.xz)) * smoothstep(1.0, 5.0, dist);
  vLen = 0.25 + 0.25*fract(aSeed.x*31.3);                // streak length (motion blur)
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vAlpha <= 0.001 ? 0.0 : (1.5 + 1.4*fract(aSeed.y*17.1))*uPx*300.0/dist;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uSlant;
varying float vAlpha; varying float vLen;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float x = q.x - q.y*uSlant;
  // thin, tapered at both ends, brighter at the leading (lower) end
  float along = abs(q.y) / vLen;
  float a = smoothstep(0.03, 0.008, abs(x)*(0.7 + 0.6*along)) * smoothstep(1.0, 0.4, along) * (0.65 + 0.35*clamp(q.y/vLen + 0.5, 0.0, 1.0)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`;

export class Rain {
  constructor(count = 1500, tile = 44) {
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

  update(elapsed, { center, rain, wind, windDir, pixelRatio, light, tint = null }) {
    const U = this.uniforms;
    U.uTime.value = elapsed; U.uCenter.value.copy(center); U.uPx.value = pixelRatio;
    U.uRain.value = rain;
    U.uWind.value.set(windDir[0], windDir[1]).multiplyScalar(0.4 + wind);
    U.uSlant.value = -windDir[0] * (0.15 + wind * 0.35);   // screen x follows world x (north-up view)
    if (tint) U.uColor.value.copy(tint).multiplyScalar(0.8 + 0.2 * light);                 // tinted by the time of day
    else U.uColor.value.setRGB(0.72 + 0.2 * light, 0.78 + 0.17 * light, 0.86 + 0.12 * light);
    this.points.visible = rain > 0.01;
  }
}
