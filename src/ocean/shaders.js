// GLSL chunks injected into MeshStandardMaterial via onBeforeCompile.
// Ported from the original "Stylized Ocean" scene.

export const GLSL_COMMON = /* glsl */ `
uniform vec3 uPalA[10]; uniform vec3 uPalB[10]; uniform vec4 uFxA; uniform vec4 uFxB; uniform float uMix;
uniform float uTime; uniform float uFlow; uniform vec2 uWind; uniform float uHalf; uniform float uFade; uniform float uFarScale;
uniform float uStorm; uniform float uReef; uniform float uFoam; uniform float uGlitter; uniform vec2 uSun;
uniform vec4 uRipples[8]; uniform vec4 uObjects[4];
varying float vWave;
float oc_hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float oc_noise(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
  return mix(mix(oc_hash(i), oc_hash(i+vec2(1,0)), u.x), mix(oc_hash(i+vec2(0,1)), oc_hash(i+vec2(1,1)), u.x), u.y); }
float oc_fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*oc_noise(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
float oc_ridge(vec2 p){ return 1.0 - abs(2.0*oc_noise(p) - 1.0); }
`;

// Vertex displacement. Mirrored on the CPU in Ocean.getHeightAt().
export const GLSL_VERTEX = /* glsl */ `#include <begin_vertex>
  vec2 pp = position.xz; vLP = pp;
  float edge = smoothstep(uHalf, uHalf - 1.5, max(abs(pp.x), abs(pp.y)));
  float amp = edge * (0.5 + 2.2*uStorm);
  float wsum = (0.05*sin(dot(pp, uWind)*1.4 - uFlow*1.6) + 0.03*sin(dot(pp, vec2(-uWind.y, uWind.x))*2.1 + uFlow*1.1)
                        + 0.04*uStorm*sin(dot(pp, vec2(0.3, 1.0))*3.3 - uFlow*2.7));
  vWave = wsum / (0.08 + 0.04*uStorm);   // roughly -1 (trough) … 1 (crest)
  transformed.y += amp * wsum;`;

export const GLSL_FRAGMENT = /* glsl */ `#include <color_fragment>
  {
    vec2 p = vWPos.xz; float t = uTime, fl = uFlow;
    float far = clamp(-vLP.y/uFarScale*0.5 + 0.5, 0.0, 1.0);          // 1 = far side
    // time-of-day sweep: far side changes first, light rolls toward the viewer
    float m = clamp(uMix*1.6 - (1.0 - far)*0.6, 0.0, 1.0); m = m*m*(3.0 - 2.0*m);
    vec3 pal[10]; for (int i = 0; i < 10; i++) pal[i] = mix(uPalA[i], uPalB[i], m);
    vec4 fx = mix(uFxA, uFxB, m);

    vec2 q = vec2(dot(p, uWind), dot(p, vec2(-uWind.y, uWind.x)));
    vec2 s = vec2(q.x*0.42, q.y*1.25) - vec2(fl*0.22, 0.0);
    vec2 warp = vec2(oc_fbm(s*0.3 + vec2(fl*0.03, 0.0)), oc_fbm(s*0.3 + 5.2));
    float n  = oc_fbm(s*0.17 + warp*1.3);
    float n2 = oc_fbm(s*0.65 + warp*0.9 + 3.0);
    float v = n + (n2 - 0.5)*0.22;

    float e = 0.008;
    vec3 c = pal[1];
    c = mix(c, pal[0], smoothstep(0.38+e, 0.38-e, v) * smoothstep(0.5, 0.62, oc_fbm(s*vec2(0.5,1.6) + 11.0)));
    c = mix(c, pal[2], smoothstep(0.445-e, 0.445+e, v));
    c = mix(c, pal[3], smoothstep(0.53-e, 0.53+e, v));
    c = mix(c, pal[4], smoothstep(0.62-e, 0.62+e, v));
    c = mix(c, pal[5], smoothstep(0.012, 0.0, abs(v - 0.62)) * 0.25);

    // reef shallows
    float rd = length((p - vec2(5.0, 3.0))*vec2(1.0, 1.35)) + (oc_fbm(p*0.35 + 50.0) - 0.5)*3.0;
    float rm = smoothstep(4.6, 2.6, rd)*uReef, core = smoothstep(2.6, 0.6, rd)*uReef;
    vec3 turq = mix(pal[3], pal[4], 0.6)*vec3(0.88, 1.1, 1.02);
    vec3 sand = mix(pal[4], pal[6], 0.5)*vec3(1.15, 1.05, 0.82);
    c = mix(c, turq, rm);
    c = mix(c, sand, core*0.8);
    c = mix(c, pal[5], smoothstep(0.2, 0.0, abs(rd - 2.75))*uReef*0.55);

    // light shafts (day / sunset)
    vec2 ld = vec2(0.8, 0.6), lp = vec2(-0.6, 0.8);
    float ray = pow(0.5 + 0.5*sin(dot(p, ld)*0.9 + oc_noise(vec2(dot(p, lp)*0.15, t*0.08))*4.0 + t*0.12), 6.0)
              * oc_fbm(vec2(dot(p, lp)*0.18 - t*0.04, dot(p, ld)*0.8));
    c += pal[7]*ray*fx.y*0.22;

    // foam lines (+ storm, + night bioluminescent pulse & trails)
    vec2 fs = q*vec2(0.85, 2.8) + vec2(-fl*0.55, 0.0) + warp*2.2;
    float r1 = oc_ridge(fs), r2 = oc_ridge(fs*1.9 + 7.3 + vec2(-fl*0.3, 0.0));
    // uFoam: 0 = almost none, 1 = original amount. Storms always add some back.
    float foam = clamp(uFoam + uStorm*0.5, 0.0, 1.0);
    float mask = smoothstep(0.42 + (1.0 - foam)*0.12 - uStorm*0.25, 0.6 + (1.0 - foam)*0.1 - uStorm*0.22, oc_fbm(s*0.4 + vec2(fl*0.04, 0.0) + 20.0))
               * (0.35 + 0.65*smoothstep(0.48, 0.6, v));
    float lines = max(smoothstep(0.87 + (1.0 - foam)*0.05 - uStorm*0.06, 0.95 + (1.0 - foam)*0.03, r1),
                      0.7*foam*smoothstep(0.93 - uStorm*0.05, 0.98, r2)) * mask * mix(0.35, 1.0, foam);
    float trail = 0.0;
    for (int k = 1; k <= 4; k++) trail += smoothstep(0.88, 0.96, oc_ridge(fs + vec2(float(k)*0.13, 0.0))) * (1.0 - float(k)/5.0);
    trail *= mask * foam;
    float pulse = 0.55 + 0.45*sin(t*2.2 + oc_noise(p*0.45)*6.283);
    c = mix(c, pal[4], smoothstep(0.75, 0.9, r1)*mask*0.35*foam);
    c = mix(c, pal[5], lines*0.95);
    c += pal[5]*(trail*0.22 + lines*pulse*0.7)*fx.z;

    // cel-shaded crest bands: hard-edged highlight on wave tops, broken up by noise
    float crest = smoothstep(0.55, 0.6, vWave) * smoothstep(0.4, 0.62, oc_noise(p*0.3 + vec2(fl*0.08, 0.0)));
    c = mix(c, mix(pal[4], pal[5], 0.45), crest*0.22);

    // ripples (taps, boats) + foam rings around floating objects.
    // Daytime: white foam. Night: bioluminescent glow.
    float rg = 0.0, rf = 0.0;
    for (int i = 0; i < 8; i++) {
      vec4 R = uRipples[i]; float age = t - R.z;
      if (R.w <= 0.0 || age < 0.0 || age > 4.5) continue;
      float r = length(p - R.xy), wob = 0.6 + 0.4*oc_noise(p*2.5 + t);
      float ring = exp(-pow((r - age*2.2)*2.6, 2.0)) * exp(-age*0.9);
      float core = exp(-r*r*0.5) * exp(-age*1.3);
      rg += (ring + core*0.9)*R.w*wob; rf += ring*R.w*wob;
    }
    for (int i = 0; i < 4; i++) {
      vec4 O = uObjects[i]; if (O.w <= 0.0) continue;
      vec2 dv = p - O.xy; float r = length(dv), a = atan(dv.y, dv.x);
      float wob = 0.12*sin(a*5.0 + t*2.0) + 0.08*sin(a*3.0 - t*1.3);
      float ring = smoothstep(0.28, 0.0, abs(r - O.z - 0.2 - wob)) * smoothstep(0.3, 0.6, oc_noise(vec2(a*3.0, t*0.8) + O.xy));
      float wake = smoothstep(O.z*2.5, O.z, r) * 0.3;
      rf += (ring + wake*0.5)*O.w; rg += (ring + wake)*O.w*0.6;
    }
    c = mix(c, pal[5], clamp(rf, 0.0, 1.0)*0.75*(1.0 - fx.z*0.5));
    c += mix(pal[4], pal[5], 0.5)*rg*fx.z*1.5;

    // sun / moon disc + glitter path toward the viewer
    vec2 dp = p - uSun + (vec2(oc_noise(p*1.5 + t*0.6), oc_noise(p*1.5 - t*0.6 + 3.0)) - 0.5)*0.45;
    float dd = length(dp*vec2(1.0, 0.72));
    float halo = smoothstep(4.5, 0.4, dd);
    c += pal[7]*halo*halo*fx.w*0.3*mix(0.4, 1.0, uGlitter);
    c = mix(c, pal[8], smoothstep(1.35, 1.1, dd)*fx.w*0.5);
    float path = smoothstep(2.8, 0.0, abs(p.x - uSun.x)) * smoothstep(uSun.y - 0.5, uSun.y + 2.5, p.y);
    float gl = smoothstep(0.80, 0.97, oc_ridge(vec2(p.x*4.5, p.y*1.5 - t*0.9))) * path;
    c = mix(c, pal[7], gl*mix(0.35, 0.75, foam)*max(fx.w, 0.4)*uGlitter);

    // sparkles with fading trails
    vec2 cell = floor(p*7.0); float st = t*1.5, sp = 0.0;
    float spTh = mix(0.998, 0.992, uGlitter);
    for (int k = 0; k < 3; k++) sp += step(spTh, oc_hash(cell + floor(st) - float(k))) * (k == 0 ? 1.0 : (1.0 - fract(st))*0.5/float(k));
    // fewer, fainter sparkles; none in the distance where they turn into shimmering dots
    sp *= smoothstep(0.55, 0.6, v) * fx.x * mix(0.5, 1.0, uGlitter) * smoothstep(45.0, 15.0, length(vWPos - cameraPosition));
    c = mix(c, pal[8], min(sp, 1.0));
    c += pal[8]*sp*fx.z*0.6;

    // painterly grain
    float hv = oc_fbm(p*0.09 + vec2(t*0.01, 70.0)) - 0.5;
    c *= 1.0 + vec3(hv*0.22, hv*0.04, -hv*0.16);
    c *= 1.0 + (oc_noise(vec2(q.x*0.6, q.y*9.0) + warp*3.0) - 0.5)*0.07*(1.0 - lines);

    // sky reflection on the far side, deeper up close; storm darkens
    c = mix(c, pal[9], far*far*0.38);
    c *= mix(0.84, 1.0, far) * (1.0 - uStorm*0.12);

    // haze into the sky colour toward the horizon, then fade out at the edge
    float dist = max(abs(vLP.x), abs(vLP.y));
    c = mix(c, mix(pal[9], pal[1], 0.22), smoothstep(uHalf*0.3, uHalf - uFade*0.3, dist) * 0.9);

    diffuseColor.rgb = c * 0.12;
    diffuseColor.a = smoothstep(uHalf, uHalf - uFade, dist);
  }`;
