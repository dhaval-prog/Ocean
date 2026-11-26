import * as THREE from 'three';

// Anime-style sky: painted gradient, cel-shaded cumulus (towering banks on the
// horizon + drifting puffs overhead), sun / stylized moon, stars, Milky Way,
// shooting stars, god rays and a glowing horizon line.
//
// Perf: the sky is smooth, so it is rendered into a low-resolution target and
// drawn behind the scene as one full-screen quad.

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at the far plane
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uPalA[10]; uniform vec3 uPalB[10]; uniform float uMix;
uniform float uTime; uniform vec3 uSunDir; uniform float uMoon; uniform float uRays; uniform float uStars;
uniform float uStorm; uniform float uLight;

float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
  return mix(mix(h1(i), h1(i+vec2(1,0)), u.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*n2(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }

void main() {
  vec3 d = normalize(vDir);
  float m = uMix*uMix*(3.0 - 2.0*uMix);
  vec3 pal[10]; for (int i = 0; i < 10; i++) pal[i] = mix(uPalA[i], uPalB[i], m);
  vec3 horizon = pal[9];
  vec3 zenith = mix(mix(pal[2], pal[3], 0.35), pal[9], 0.15);
  vec3 farSea = mix(pal[9], pal[1], 0.22);   // same colour the water hazes into

  // Below the horizon: the far sea the water fades into.
  if (d.y < 0.0) {
    float streak = n2(vec2(atan(d.x, -d.z)*60.0, d.y*900.0 + uTime*0.3)) - 0.5;   // faint distant swell lines
    gl_FragColor = vec4(mix(farSea*(1.0 + streak*0.07), horizon, smoothstep(-0.02, 0.0, d.y)*0.6), 1.0); return;
  }

  float y = max(d.y, 0.0);
  vec3 col = mix(horizon, zenith, pow(clamp(y/0.45, 0.0, 1.0), 0.6));
  col = mix(col, zenith*0.8, smoothstep(0.35, 1.0, y)*0.35);

  // sun / moon frame
  vec3 S = normalize(uSunDir);
  float sd = dot(d, S);
  vec3 right = normalize(cross(S, vec3(0.0, 1.0, 0.0)));
  vec3 upv = cross(right, S);
  vec2 lc = vec2(dot(d, right), dot(d, upv));     // tangent-plane coords around the sun
  float front = step(0.0, sd);

  // sky glow around the sun
  col += pal[7] * (pow(max(sd, 0.0), 12.0)*0.12 + pow(max(sd, 0.0), 120.0)*0.25) * (1.0 - uMoon*0.6);

  // stars + Milky Way + shooting star
  float az = atan(d.x, -d.z), el = asin(clamp(d.y, 0.0, 1.0));
  vec2 suv = vec2(az, el);
  vec3 mwN = normalize(vec3(0.55, 0.45, -0.7));
  float band = exp(-pow(dot(d, mwN)*4.5, 2.0));
  float stars = 0.0;
  for (int L = 0; L < 2; L++) {
    float sc = L == 0 ? 55.0 : 120.0, th = L == 0 ? 0.93 : 0.955 - band*0.04;
    vec2 g = suv*sc, id = floor(g), f = fract(g) - 0.5;
    float hs = h1(id + float(L)*17.0);
    vec2 jit = (vec2(h1(id + 3.1), h1(id + 7.7)) - 0.5)*0.6;
    float tw = 0.55 + 0.45*sin(uTime*(1.0 + hs*3.0) + hs*40.0);
    stars += step(th, hs) * smoothstep(0.16, 0.0, length(f - jit)) * tw * (L == 0 ? 1.0 : 0.6);
  }
  float mw = band * fbm(suv*vec2(5.0, 9.0) + 3.0);
  float horizonFade = smoothstep(0.0, 0.12, y);
  col += (pal[8]*stars*1.3 + mix(pal[3], pal[8], 0.5)*mw*0.22) * uStars * horizonFade;

  float sp = 7.0, k = floor(uTime/sp), lt = uTime - k*sp;
  if (lt < 1.0 && uStars > 0.2) {
    vec2 a = vec2((h1(vec2(k, 1.0)) - 0.5)*1.3, 0.22 + h1(vec2(k, 2.0))*0.3);
    vec2 dv = normalize(vec2(h1(vec2(k, 3.0)) > 0.5 ? 1.0 : -1.0, -0.45));
    vec2 head = a + dv*lt*0.55, tail = head - dv*0.16;
    vec2 pa = suv - tail, ba = head - tail;
    float hh = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
    float line = smoothstep(0.006, 0.0, length(pa - ba*hh)) * hh * sin(lt*3.14159);
    col += pal[8]*line*2.5*uStars;
  }

  // sun disc (HDR so bloom picks it up) or stylized crescent moon
  float r = length(lc) * front;
  float horizonCut = smoothstep(-0.004, 0.006, d.y);
  float sunDisc = smoothstep(0.038, 0.032, r) * front * horizonCut;
  col = mix(col, mix(pal[7], vec3(1.0), 0.5)*1.6, sunDisc*(1.0 - uMoon));
  float moonR = 0.055;
  float moonDisc = smoothstep(moonR, moonR - 0.004, r) * front * horizonCut;
  float shadow = smoothstep(moonR*0.95, moonR*0.85, length(lc - vec2(0.026, 0.018)));
  float crater = (n2(lc*90.0) - 0.5)*0.18;
  vec3 moonCol = mix(pal[8], vec3(1.0), 0.4)*(1.15 + crater);
  col = mix(col, mix(moonCol, col*1.1, shadow*0.85), moonDisc*uMoon);
  col += pal[8]*exp(-r*14.0)*0.12*uMoon*front;

  // clouds: towering horizon banks
  float shift = uTime*0.004;
  float base = fbm(vec2(az*1.8 + shift*3.0, 1.3));
  float hp = smoothstep(0.32, 0.78, base) * (0.2 + uStorm*0.12) + uStorm*0.03;
  float lump = fbm(vec2(az*12.0 + shift*20.0, y*12.0));
  float edge = hp + (lump - 0.5)*0.07;
  float bank = smoothstep(edge + 0.007, edge - 0.007, y);
  float sunSide = dot(normalize(vec2(d.x, -d.z) + 1e-4), normalize(vec2(S.x, -S.z) + 1e-4));
  float bankLit = smoothstep(0.46, 0.54, y/max(edge, 1e-3)*0.55 + (fbm(vec2(az*7.0, y*7.0) + shift*10.0) - 0.5)*0.9 + sunSide*0.15 + 0.15);
  float bankRim = smoothstep(0.012, 0.0, edge - y) * bank;

  // clouds: drifting puffs overhead (projected onto a ceiling plane)
  vec2 cuv = d.xz/(d.y + 0.1)*0.9 + vec2(uTime*0.012, uTime*0.004);
  float dens = fbm(cuv*1.2);
  float cov = smoothstep(0.61 - uStorm*0.12, 0.64 - uStorm*0.12, dens) * smoothstep(0.05, 0.25, y);
  float dens2 = fbm(cuv*1.2 + normalize(S.xz + 1e-4)*0.06);
  float puffLit = smoothstep(-0.02, 0.01, dens - dens2);

  vec3 cloudLit = mix(pal[6], vec3(1.0), 0.55*uLight);
  vec3 cloudShade = mix(pal[6], mix(pal[2], pal[1], 0.4), 0.5);
  vec3 rimCol = mix(pal[7], vec3(1.0), 0.3);
  vec3 bankCol = mix(cloudShade, cloudLit, bankLit) + rimCol*bankRim*0.35*pow(max(sunSide, 0.0), 2.0);
  vec3 puffCol = mix(cloudShade, cloudLit, puffLit);
  puffCol += rimCol*0.25*pow(max(sd, 0.0), 8.0);
  bankCol *= 1.0 - uStorm*0.3; puffCol *= 1.0 - uStorm*0.25;

  float clouds = max(bank, cov);
  col = mix(col, puffCol, cov);
  col = mix(col, bankCol, bank);

  // god rays from the sun, visible through the gaps
  float ang = atan(lc.y, lc.x);
  float rays = pow(n2(vec2(ang*9.0, uTime*0.06)), 3.0) * smoothstep(0.9, 0.06, r) * smoothstep(0.03, 0.1, r) * front;
  col += pal[7]*rays*uRays*0.3*(1.0 - clouds*0.75);

  // glowing horizon line
  col += mix(pal[7], vec3(1.0), 0.5)*(exp(-y*140.0)*0.22 + exp(-y*14.0)*0.05)*(1.0 - bank*0.7)*(1.0 - uStars*0.5);

  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  /**
   * @param {object} shared uniforms from Ocean (palettes + mix) so sky and sea blend together
   */
  constructor(shared) {
    this.uniforms = {
      uPalA: shared.uPalA, uPalB: shared.uPalB, uMix: shared.uMix, uTime: shared.uTime,
      uSunDir: { value: new THREE.Vector3(0, 0.2, -1) },
      uMoon: { value: 0 }, uRays: { value: 0 }, uStars: { value: 0 },
      uStorm: { value: 0 }, uLight: { value: 1 },
    };
    this.scene = new THREE.Scene();
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(10, 48, 24),
      new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false }),
    );
    this.dome.frustumCulled = false;
    this.scene.add(this.dome);

    this.target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });

    // Full-screen quad that paints the low-res sky behind everything.
    this.backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { tSky: { value: this.target.texture } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
        fragmentShader: 'uniform sampler2D tSky; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tSky, vUv); }',
        depthWrite: false, depthTest: false,
      }),
    );
    this.backdrop.frustumCulled = false;
    this.backdrop.renderOrder = -1000;
    this.scale = 0.5;
  }

  setSize(w, h, scale = this.scale) {
    this.scale = scale;
    this.target.setSize(Math.max(2, Math.round(w*scale)), Math.max(2, Math.round(h*scale)));
  }

  render(renderer, camera) {
    this.dome.position.copy(camera.position);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, camera);
    renderer.setRenderTarget(prev);
  }
}
