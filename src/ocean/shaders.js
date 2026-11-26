// GLSL chunks injected into MeshStandardMaterial via onBeforeCompile.
// Ported from the original "Stylized Ocean" scene.

export const GLSL_COMMON = /* glsl */ `
uniform vec3 uPalA[10]; uniform vec3 uPalB[10]; uniform vec4 uFxA; uniform vec4 uFxB; uniform float uMix;
uniform float uTime; uniform float uFlow; uniform vec2 uWind; uniform float uHalf; uniform float uFade; uniform float uFarScale;
uniform float uStorm; uniform float uReef; uniform float uFoam; uniform float uGlitter;
uniform vec4 uRipples[12]; uniform vec4 uObjects[4];
uniform vec4 uBoat; uniform vec2 uBoatSize;   // boat: x, z, heading, speed 0..1 | bow distance, half beam
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
    float far = clamp(-(vWPos.z - cameraPosition.z)/uFarScale*0.5 + 0.5, 0.0, 1.0); // 1 = top of the screen
    // time-of-day sweep: far side changes first, light rolls toward the viewer
    float m = clamp(uMix*1.6 - (1.0 - far)*0.6, 0.0, 1.0); m = m*m*(3.0 - 2.0*m);
    vec3 pal[10]; for (int i = 0; i < 10; i++) pal[i] = mix(uPalA[i], uPalB[i], m);
    vec4 fx = mix(uFxA, uFxB, m);

    // drop ripples: damped concentric waves spreading from where something hit
    // the water. They also bend the water pattern, like real refraction.
    vec2 rDisp = vec2(0.0); float rH = 0.0, rCrest = 0.0, rSplash = 0.0;
    for (int i = 0; i < 12; i++) {
      vec4 R = uRipples[i]; float age = t - R.z;
      if (R.w <= 0.0 || age < 0.0 || age > 2.0) continue;
      vec2 dv = p - R.xy; float r = length(dv);
      float front = age*0.8, width = 0.14 + age*0.14;          // slow, narrow packet: 2-3 rings, ~2 units across
      float env = exp(-pow((r - front*0.75)/width, 2.0)) * exp(-age*1.2) * R.w;                                    // fades within ~2 s
      float wave = sin((r - front)*16.0) * env * smoothstep(front + 0.12, front, r);  // nothing ahead of the front
      rH += wave;
      rDisp += (dv/max(r, 1e-3)) * wave * 0.06;                                   // only a slight bend
      rCrest += smoothstep(0.55, 0.85, wave/max(env, 1e-3)) * min(env*1.6, 1.0);                 // thin bright crest lines
      if (age < 0.35) {                                                              // splash on impact
        float k = age/0.35, a = atan(dv.y, dv.x);
        float drops = smoothstep(0.55, 0.9, cos(a*9.0 + R.x*3.0)) * smoothstep(0.06, 0.02, abs(r - (0.1 + k*0.45)));
        float dimple = smoothstep(0.12*(1.0 - k) + 0.01, 0.0, r)*0.6;
        rSplash += (drops + dimple) * (1.0 - k) * R.w * 0.6;
      }
    }
    p += rDisp;

    vec2 q = vec2(dot(p, uWind), dot(p, vec2(-uWind.y, uWind.x)));
    vec2 s = vec2(q.x*0.42, q.y*1.25) - vec2(fl*0.22, 0.0);
    vec2 warp = vec2(oc_fbm(s*0.3 + vec2(fl*0.03, 0.0)), oc_fbm(s*0.3 + 5.2));
    float n  = oc_fbm(s*0.17 + warp*1.3);
    float n2 = oc_fbm(s*0.65 + warp*0.9 + 3.0);
    float v = n + (n2 - 0.5)*0.1;   // low detail term = big, simple cartoon shapes

    float e = 0.008;
    vec3 c = pal[1];
    c = mix(c, pal[0], smoothstep(0.38+e, 0.38-e, v) * smoothstep(0.5, 0.62, oc_fbm(s*vec2(0.5,1.6) + 11.0)));
    c = mix(c, pal[2], smoothstep(0.445-e, 0.445+e, v));
    c = mix(c, pal[3], smoothstep(0.53-e, 0.53+e, v));
    c = mix(c, pal[4], smoothstep(0.62-e, 0.62+e, v));
    // cartoon ink: dark outline where deep meets mid water, crisp white rim on the brightest shapes
    c = mix(c, pal[0]*0.85, smoothstep(0.007, 0.0, abs(v - 0.445)) * 0.45);
    c = mix(c, pal[5], smoothstep(0.007, 0.0, abs(v - 0.62)) * 0.6);

    // reef shallows
    float rd = length((p - vec2(5.0, 3.0))*vec2(1.0, 1.35)) + (oc_fbm(p*0.35 + 50.0) - 0.5)*3.0;
    float rm = smoothstep(4.6, 2.6, rd)*uReef, core = smoothstep(2.6, 0.6, rd)*uReef;
    vec3 turq = mix(pal[3], pal[4], 0.6)*vec3(0.88, 1.1, 1.02);
    vec3 sand = mix(pal[4], pal[6], 0.5)*vec3(1.15, 1.05, 0.82);
    c = mix(c, turq, rm);
    c = mix(c, sand, core*0.8);
    c = mix(c, pal[5], smoothstep(0.2, 0.0, abs(rd - 2.75))*uReef*0.55);

    // foam lines (+ storm, + night bioluminescent pulse & trails)
    vec2 fs = q*vec2(0.6, 1.9) + vec2(-fl*0.4, 0.0) + warp*1.6;
    float r1 = oc_ridge(fs), r2 = oc_ridge(fs*1.9 + 7.3 + vec2(-fl*0.3, 0.0));
    // uFoam: 0 = almost none, 1 = original amount. Storms always add some back.
    float foam = clamp(uFoam + uStorm*0.5, 0.0, 1.0);
    float mask = smoothstep(0.42 + (1.0 - foam)*0.12 - uStorm*0.25, 0.6 + (1.0 - foam)*0.1 - uStorm*0.22, oc_fbm(s*0.4 + vec2(fl*0.04, 0.0) + 20.0))
               * (0.35 + 0.65*smoothstep(0.48, 0.6, v));
    float lines = max(smoothstep(0.9 + (1.0 - foam)*0.04 - uStorm*0.06, 0.915 + (1.0 - foam)*0.04 - uStorm*0.06, r1),
                      0.8*foam*smoothstep(0.95 - uStorm*0.05, 0.965 - uStorm*0.05, r2)) * smoothstep(0.25, 0.35, mask) * mix(0.5, 1.0, foam);
    float trail = 0.0;
    for (int k = 1; k <= 4; k++) trail += smoothstep(0.88, 0.96, oc_ridge(fs + vec2(float(k)*0.13, 0.0))) * (1.0 - float(k)/5.0);
    trail *= mask * foam;
    float pulse = 0.55 + 0.45*sin(t*2.2 + oc_noise(p*0.45)*6.283);
    c = mix(c, pal[4], smoothstep(0.8, 0.82, r1)*smoothstep(0.25, 0.35, mask)*0.3*foam);
    c = mix(c, pal[5], lines*0.95);
    c += pal[5]*(trail*0.08 + lines*pulse*0.12)*fx.z;   // night: soft moonlit foam, no strong glow


    // drop ripples: crests catch the light, troughs darken; foam by day, glow by night
    // kept faint so the rings sit quietly on the surface
    c *= 1.0 + rH*0.1;
    c = mix(c, pal[5], clamp(rCrest*0.65 + rSplash, 0.0, 1.0)*(1.0 - fx.z*0.4));
    c += mix(pal[4], pal[5], 0.5)*(rCrest*0.6 + rSplash)*fx.z*0.35;

    // boat wake: a V of foam spreading back from the bow, churned water behind
    // the stern and a white splash at the bow, all growing with speed
    if (uBoat.w > 0.01) {
      vec2 fwd = vec2(cos(uBoat.z), -sin(uBoat.z)), side = vec2(-fwd.y, fwd.x);
      vec2 d = p - uBoat.xy;
      float lx = dot(d, fwd), ly = abs(dot(d, side));
      float sp = uBoat.w, bow = uBoatSize.x, beam = uBoatSize.y;
      float behind = bow - lx;                                   // distance back from the bow
      float reach = 3.0 + 8.0*sp;
      float arm = 0.0;
      if (behind > 0.0 && behind < reach) {
        // soft, wobbly foam lines (not dashes): width and position wander a little
        float nz = oc_noise(vec2(behind*1.3 - t*1.6, 3.0));
        float spread = beam*0.6 + behind*0.36 + (nz - 0.5)*0.18;  // ~20° Kelvin-style wedge
        float w = (0.07 + behind*0.025) * (0.6 + 0.8*oc_noise(vec2(behind*2.1 + t, 9.0)));
        arm = smoothstep(w, w*0.3, abs(ly - spread)) * (0.65 + 0.35*nz);
        float spread2 = spread*0.7 + (oc_noise(vec2(behind*1.7 + t*1.2, 5.0)) - 0.5)*0.12;
        arm += 0.45*smoothstep(w*0.7, w*0.2, abs(ly - spread2)) * smoothstep(0.35, 0.6, oc_noise(vec2(behind*0.9 - t*0.8, 7.0)));
        arm *= smoothstep(reach, reach*0.35, behind) * sp;
      }
      float stern = behind - bow*2.0;                              // past the stern: propeller wash
      float wash = 0.0;
      if (stern > -0.3) {
        float wid = 0.25 + max(stern, 0.0)*0.08;
        wash = smoothstep(wid, wid*0.3, ly) * smoothstep(3.0 + 8.0*sp, 0.0, stern)
             * smoothstep(0.3, 0.7, oc_noise(vec2(stern*3.0 - t*4.0, ly*6.0))) * sp;
      }
      float bd = length(vec2(max(lx - bow*0.85, 0.0), ly*0.8));   // bow splash: white crescent at the tip
      float splash = smoothstep(0.45 + 0.35*sp, 0.15, bd) * step(bow*0.55, lx) * smoothstep(0.15, 0.5, sp)
                   * (0.6 + 0.4*oc_noise(vec2(atan(ly, lx - bow)*6.0, t*5.0)));
      float wake = clamp(arm + wash*0.8 + splash, 0.0, 1.0);
      c = mix(c, pal[5], wake*0.85*(1.0 - fx.z*0.4));
      c += mix(pal[4], pal[5], 0.5)*wake*fx.z*0.2;
    }

    // foam rings around floating objects (boats, players)
    float rg = 0.0, rf = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 O = uObjects[i]; if (O.w <= 0.0) continue;
      vec2 dv = p - O.xy; float r = length(dv), a = atan(dv.y, dv.x);
      float wob = 0.12*sin(a*5.0 + t*2.0) + 0.08*sin(a*3.0 - t*1.3);
      float ring = smoothstep(0.28, 0.0, abs(r - O.z - 0.2 - wob)) * smoothstep(0.3, 0.6, oc_noise(vec2(a*3.0, t*0.8) + O.xy));
      float wake = smoothstep(O.z*2.5, O.z, r) * 0.3;
      rf += (ring + wake*0.5)*O.w; rg += (ring + wake)*O.w*0.6;
    }
    c = mix(c, pal[5], clamp(rf, 0.0, 1.0)*0.75*(1.0 - fx.z*0.5));
    c += mix(pal[4], pal[5], 0.5)*rg*fx.z*0.4;

    // cartoon twinkles: little 4-point stars that pop in and out
    vec2 sc = p*1.6, cell = floor(sc), f = fract(sc) - 0.5;
    float st = t*1.2, ph = fract(st);
    float on = step(mix(0.999, 0.994, uGlitter), oc_hash(cell + floor(st)));
    float starShape = smoothstep(0.34, 0.3, sqrt(abs(f.x)) + sqrt(abs(f.y))) * sin(ph*3.14159);
    float sp = on * starShape * smoothstep(0.5, 0.55, v) * fx.x;
    c = mix(c, pal[8], min(sp*1.4, 1.0));
    c += pal[8]*sp*fx.z*0.15;

    // flat cartoon cloud shadows drifting across the sea (daytime)
    float cs = smoothstep(0.56, 0.575, oc_fbm(p*0.035 + vec2(t*0.012, t*0.006) + 40.0));
    c = mix(c, c*vec3(0.74, 0.8, 0.95), cs*0.55*(1.0 - fx.z));

    // sky reflection on the far side, deeper up close; storm darkens
    c = mix(c, pal[9], far*far*0.38);
    c *= mix(0.84, 1.0, far) * (1.0 - uStorm*0.12);

    // haze into the sky colour toward the horizon, then fade out at the edge
    float dist = max(abs(vLP.x), abs(vLP.y));
    c = mix(c, mix(pal[9], pal[1], 0.22), smoothstep(uHalf*0.6, uHalf - uFade*0.3, dist) * 0.9);

    diffuseColor.rgb = c * 0.12;
    diffuseColor.a = smoothstep(uHalf, uHalf - uFade, dist);
  }`;
