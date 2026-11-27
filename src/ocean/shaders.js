// GLSL chunks injected into MeshStandardMaterial via onBeforeCompile.
// Ported from the original "Stylized Ocean" scene.

export const GLSL_COMMON = /* glsl */ `
uniform vec3 uPalA[10]; uniform vec3 uPalB[10]; uniform vec4 uFxA; uniform vec4 uFxB; uniform float uMix;
uniform float uTime; uniform float uFlow; uniform vec2 uWind; uniform float uHalf; uniform float uFade; uniform float uFarScale; uniform vec2 uViewDir;
uniform float uStorm; uniform float uReef; uniform float uFoam; uniform float uGlitter;
uniform vec4 uRipples[12]; uniform vec4 uObjects[4];
uniform vec4 uBoat; uniform vec2 uBoatSize;   // boat: x, z, heading, speed 0..1 | bow distance, half beam
uniform float uBoatShadow; uniform vec2 uLightDir; uniform vec3 uLightCol; uniform float uRefl;
uniform float uClouds; uniform float uCloudT; uniform float uRain; uniform float uFog; uniform vec3 uFogCol;
uniform float uFlash; uniform float uRainbow; uniform float uThunder; uniform vec2 uFlashPos;
uniform vec3 uFlashCol; uniform vec3 uRainCol; uniform vec2 uRainbowPos; uniform float uRainbowS; uniform float uBowMoon;
uniform vec4 uBeams[3]; uniform vec4 uSpot; uniform float uBoatGlow;
uniform vec4 uCloudBlobs[8];   // the puffy clouds overhead: x, z, radius, shadow strength
// where rain falls heaviest: broad sheets sweeping downwind (same formula as Rain.js)
float rainSheet(vec2 p, vec2 w, float t){ vec2 wp = vec2(-w.y, w.x);
  return clamp(0.5 + 0.5*sin(dot(p, wp)*0.11 - t*0.35)*sin(dot(p, w)*0.07 - t*0.5 + 1.3) + 0.25*sin(dot(p, w)*0.031 + dot(p, wp)*0.023 - t*0.21), 0.0, 1.0); }
const vec3 GLOW = vec3(0.3, 0.95, 1.0);   // night bioluminescence: cyan-blue
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
    // 0 around the middle of the view … 1 toward the top of the screen, measured in
    // camera heights so it holds at any zoom (it used to be ~1 everywhere, which
    // washed the whole sea with sky colour)
    float far = smoothstep(0.75, 2.2, dot(vWPos.xz - cameraPosition.xz, uViewDir) / max(cameraPosition.y - 1.2, 1.0));
    // time-of-day sweep: far side changes first, light rolls toward the viewer
    float m = clamp(uMix*1.6 - (1.0 - far)*0.6, 0.0, 1.0); m = m*m*(3.0 - 2.0*m);
    vec3 pal[10]; for (int i = 0; i < 10; i++) pal[i] = mix(uPalA[i], uPalB[i], m);
    vec4 fx = mix(uFxA, uFxB, m);
    float flare = 1.0 + uFlash*3.5*fx.z;   // a night lightning flash makes everything that glows flare up

    // drop ripples: damped concentric waves spreading from where something hit
    // the water. They also bend the water pattern, like real refraction.
    vec2 rDisp = vec2(0.0); float rH = 0.0, rCrest = 0.0, rSplash = 0.0;
    for (int i = 0; i < 12; i++) {
      vec4 R = uRipples[i]; float age = t - R.z;
      if (R.w <= 0.0 || age < 0.0 || age > 2.0) continue;
      vec2 dv = p - R.xy; float r = length(dv);
      float front = age*0.8, width = 0.14 + age*0.14;          // slow, narrow packet: 2-3 rings, ~2 units across
      float ew = (r - front*0.75)/width; float env = exp(-ew*ew) * exp(-age*1.2) * R.w;                                    // fades within ~2 s
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

    // --- foam -------------------------------------------------------------------
    // uFoam: 0 = almost none, 1 = lots. Storms always whip some up.
    float foam = clamp(uFoam + uStorm*0.5, 0.0, 1.0);
    vec2 wperp = vec2(-uWind.y, uWind.x);

    // 1. big cartoon patches: each area forms, holds, drifts downwind, then
    //    dissolves into lace (holes open until only the outline is left), and
    //    forms again a while later somewhere else
    vec2 fd = p - uWind*(t*0.25 + fl*0.5);                         // drift with the wind
    vec2 fq = vec2(dot(fd, uWind), dot(fd, wperp));
    vec2 fc = fq*vec2(0.085, 0.13) + warp*0.3;
    float life = fract(t*0.022 + oc_noise(fc*0.4 + 17.0)*2.5);
    float grow = smoothstep(0.0, 0.22, life), fade = smoothstep(0.5, 0.95, life);
    float shape = oc_fbm(fc + 31.0);
    float thr = mix(0.7, 0.57, foam) + (1.0 - grow)*0.12;
    float aa = max(fwidth(shape)*1.2, 0.004);
    float body = smoothstep(thr, thr + aa, shape);
    float rim = body * (1.0 - smoothstep(thr + 0.022, thr + 0.022 + aa, shape));   // clean outline band
    float holes = oc_noise(fq*0.8 + warp*1.1 + 50.0);
    float ht = mix(0.86, 0.34, fade);                                               // lace opens as it fades
    float hole = smoothstep(ht - 0.015, ht, holes);
    float fpatch = max(body*(1.0 - hole), rim*(1.0 - fade*0.35)) * (1.0 - smoothstep(0.85, 1.0, life));

    // 2. crest foam: white caps that sit on the crests of the main swell (the
    //    same waves the boat rides) and slide off the back as each crest passes
    float wph = dot(p, uWind)*1.4 - fl*1.6;                          // matches the vertex wave
    float wAcross = dot(p, wperp);
    float wob = 0.35*sin(wAcross*0.7 + floor(wph/6.2832)*2.1);
    float crestS = sin(wph + wob);
    float tailS = sin(wph + wob + 0.55);                             // just behind the crest
    float capId = floor((wph + wob)/6.2832 + 0.25);
    float brk = oc_noise(vec2(wAcross*0.45, capId*3.7));             // each crest breaks in its own places
    float capAmt = foam*(0.2 + uStorm*0.75);
    // cap size swells and shrinks smoothly along the crest, so every cap is a
    // tapered lens shape (no square ends)
    float sCap = smoothstep(0.78 - capAmt*0.4, 0.98, brk + (oc_noise(vec2(wAcross*1.6, capId*5.1)) - 0.5)*0.12);
    float w1 = 0.1*sCap, aaC = max(fwidth(crestS)*1.2, 0.004);
    float cap = smoothstep(1.0 - w1, 1.0 - w1 + aaC, crestS) * step(0.01, sCap);
    cap = max(cap, 0.75*smoothstep(1.0 - w1*0.55, 1.0 - w1*0.55 + aaC, tailS) * step(0.3, sCap));   // slides off the back

    float foamAll = clamp(fpatch*0.95 + cap, 0.0, 1.0);
    c = mix(c, pal[4], body*(1.0 - fpatch)*0.18*foam);               // faint tint inside the lace
    c = mix(c, pal[5], foamAll*(1.0 - fx.z*0.35));                  // night: foam stays quieter
    c += pal[5]*cap*0.1*fx.z;                                        // moonlit caps

    // drop ripples: crests catch the light, troughs darken; foam by day, glow by night
    // kept faint so the rings sit quietly on the surface
    c *= 1.0 + rH*0.1;
    c = mix(c, pal[5], clamp(rCrest*0.65 + rSplash, 0.0, 1.0)*(1.0 - fx.z*0.4));
    c += GLOW*(rCrest*0.9 + rSplash)*fx.z*0.75*flare;                          // glow cyan-blue at night

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
      c += GLOW*wake*fx.z*0.6*flare;                                     // glowing wake at night
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
    c += GLOW*rg*fx.z*0.45*flare;

    // cartoon twinkles: little 4-point stars that pop in and out
    vec2 sc = p*1.6, cell = floor(sc), f = fract(sc) - 0.5;
    float st = t*1.2, ph = fract(st);
    float on = step(mix(0.999, 0.994, uGlitter), oc_hash(cell + floor(st)));
    float starShape = smoothstep(0.34, 0.3, sqrt(abs(f.x)) + sqrt(abs(f.y))) * sin(ph*3.14159);
    float sp = on * starShape * smoothstep(0.5, 0.55, v) * fx.x * (1.0 - uClouds*0.75);
    c = mix(c, pal[8], min(sp*1.4, 1.0));
    c += pal[8]*sp*fx.z*0.15;

    // cloud shadows drifting across the sea (daytime): soft-edged like real
    // ones, a big faint layer under a smaller denser one; more cover as the
    // clouds build, faster and darker in a thunderstorm
    float cth = 0.6 - uClouds*0.22;
    vec2 cp = p*0.035 + uWind*uCloudT*0.012 + vec2(0.0, uCloudT*0.004) + 40.0;
    float cs = smoothstep(cth - 0.03, cth + 0.07, oc_fbm(cp));
    float cs2 = smoothstep(0.45, 0.7, oc_fbm(cp*0.45 + uWind*uCloudT*0.003 + 7.0)) * (0.3 + uClouds*0.5);
    float cShade = clamp(cs*(0.45 + uThunder*0.25) + cs2*0.3, 0.0, 0.85);
    c = mix(c, c*vec3(0.74, 0.84, 0.92)*(1.0 - uThunder*0.25), cShade*(1.0 - fx.z*0.8));
    // shadows straight below the puffy clouds overhead
    for (int i = 0; i < 8; i++) {
      vec4 Cb = uCloudBlobs[i]; if (Cb.w <= 0.001) continue;
      float cd = length((p - Cb.xy)*vec2(1.0, 1.3))/Cb.z + (oc_noise(p*0.3 + float(i)*3.1) - 0.5)*0.3;
      c *= 1.0 - smoothstep(1.0, 0.5, cd)*Cb.w*0.35*(1.0 - fx.z*0.7);
    }

    // camera-relative frame, measured in camera heights so it holds at any zoom
    vec2 rel = vWPos.xz - cameraPosition.xz;
    float camH = max(cameraPosition.y - 1.2, 1.0);

    // depth: the water deepens toward the far side of the view
    float fwd = dot(rel, uViewDir) / camH;
    float deepK = smoothstep(0.25, 1.5, fwd) * 0.3 * (1.0 - fx.z*0.5);
    c = mix(c, mix(pal[0], pal[1], 0.35), deepK);

    // soft shadow under the boat, nudged away from the sun
    if (uBoatShadow > 0.0) {
      vec2 bfwd = vec2(cos(uBoat.z), -sin(uBoat.z)), bside = vec2(-bfwd.y, bfwd.x);
      vec2 bd = p - uBoat.xy + uLightDir*0.35;
      float be = length(vec2(dot(bd, bfwd)/(uBoatSize.x*1.08), dot(bd, bside)/(uBoatSize.y*1.55)));
      c *= 1.0 - smoothstep(1.0, 0.35, be)*0.38*uBoatShadow*(1.0 - fx.z*0.4);
    }

    // sun (moon at night) path: a soft band of light from the viewer toward it,
    // broken into glints by the waves. Moves as the view turns; storms dim it.
    {
      float along = dot(rel, uLightDir) / camH;
      float across = dot(rel, vec2(-uLightDir.y, uLightDir.x)) / camH;
      float bw = across / (0.1 + max(along, 0.0)*0.22); float band = exp(-bw*bw) * smoothstep(0.15, 0.9, along);
      // glints: short crisp dashes lying across the path (cartoon sun glitter),
      // staggered and jittered so they never read as a grid, each popping on and off
      vec2 lw = vec2(dot(p, vec2(-uLightDir.y, uLightDir.x)), dot(p, uLightDir)) + warp*0.8;
      vec2 gp = vec2(lw.x*0.5, lw.y*1.5 - fl*0.35);
      gp.x += oc_hash(vec2(floor(gp.y), 3.7))*1.7;                       // stagger rows
      vec2 gc = floor(gp), gf = fract(gp) - 0.5;
      float gh = oc_hash(gc), ph = fract(t*0.8 + gh);
      gf -= (vec2(oc_hash(gc + 1.3), oc_hash(gc + 2.9)) - 0.5)*vec2(0.5, 0.4); // jitter inside the cell
      float len = 0.16 + 0.22*oc_hash(gc + 5.1);
      float dash = smoothstep(len, len*0.55, abs(gf.x)) * smoothstep(0.16, 0.08, abs(gf.y));   // thick enough to stay bright under the ink pass
      float gl = dash * step(0.8 - band*0.35*uRefl, oc_hash(gc + floor(t*0.8 + gh)*7.1)) * sin(ph*3.14159);
      float refl = band * uRefl * (1.0 - uStorm*0.65) * (1.0 - cs*0.6) * (1.0 - uClouds*0.9) * (1.0 - uFog*0.7);
      c += uLightCol * refl * (0.09 + gl*2.0);
      // in fog the sun is a soft diffuse glow instead of glitter: a big pale
      // disc reflected ahead, and at night the moon wears a halo
      float fogSun = uFog * (1.0 - uClouds*0.5) * (1.0 - uStorm*0.6);
      float dd = length(vec2(across, along - 1.35));
      float disc = smoothstep(0.42, 0.26, dd), halo = smoothstep(0.07, 0.0, abs(dd - 0.62))*fx.z;
      c += uLightCol * (band*uRefl*0.22 + disc*0.32 + halo*0.3 + smoothstep(1.3, 0.0, dd)*0.12) * fogSun;
    }

    // sky reflection on the far side, deeper up close
    c = mix(c, pal[9], far*far*0.3);
    c *= mix(0.94, 1.0, far);

    // storms: the sea turns grey-green and darker (foam is already whipped up above)
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(lum)*vec3(0.82, 0.98, 0.94), uStorm*uStorm*0.7);
    c *= 1.0 - uStorm*0.2;

    // gale: foam blown into long streaks lying along the wind (spindrift)
    float gale = smoothstep(0.55, 0.95, uStorm);
    if (gale > 0.0) {
      vec2 sq = vec2(dot(p, uWind)*0.1 - fl*0.3, dot(p, wperp)*2.4) + warp*0.4;
      float gst = smoothstep(0.64, 0.76, oc_noise(sq)) * smoothstep(0.3, 0.6, oc_noise(sq*vec2(0.6, 0.12) + 13.0))
                * smoothstep(0.35, 0.65, oc_noise(sq*vec2(3.2, 0.4) + 29.0));        // broken into shorter streaks
      c = mix(c, mix(pal[5], vec3(lum), 0.45), gst*gale*0.55*(1.0 - fx.z*0.4));
    }

    // overcast: flatter, greyer, a little darker
    float lum2 = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(lum2)*vec3(0.93, 0.99, 1.04), uClouds*0.55);   // diffuse light: colours go dull and grey
    c *= 1.0 - uClouds*0.17;

    // sunbeams breaking through gaps in the clouds: bright, warm patches with
    // soft ragged edges, coloured by the light (gold at sunset)
    for (int i = 0; i < 3; i++) {
      vec4 B = uBeams[i]; if (B.w <= 0.001) continue;
      vec2 bv = p - B.xy;
      float bdist = length(bv)/B.z + (oc_noise(p*0.12 + float(i)*7.0 + uCloudT*0.01) - 0.5)*0.45;
      float pb = smoothstep(1.0, 0.45, bdist) * B.w;
      vec3 sunC = mix(uLightCol, vec3(1.0, 0.85, 0.55), 0.35);
      c = mix(c, c*1.45 + sunC*0.12, pb*(1.0 - fx.z));
    }
    // the water glows gold round the boat while it sits in a sunbeam
    c += vec3(1.0, 0.82, 0.4)*uBoatGlow*smoothstep(4.5, 0.5, length(p - uBoat.xy))*0.3*(1.0 - fx.z);

    // rain on the water: a dimpled, darker surface where it is falling, with
    // small rings of different sizes popping everywhere; heaviest under the
    // sheets of rain sweeping across (they match the falling drops)
    float rainHere = 0.0;
    if (uRain > 0.01) {
      float sheet = rainSheet(p, uWind, t);
      rainHere = uRain * (0.45 + 0.75*sheet);
      float dimp = oc_noise(p*7.0 + vec2(t*13.0, -t*11.0)) - 0.5;            // pitted by countless drops
      c *= 1.0 - rainHere*0.1 + dimp*0.08*rainHere;
      float rings = 0.0, splash = 0.0;
      for (int L = 0; L < 2; L++) {
        float sc = L == 0 ? 1.1 : 2.3;
        vec2 rp = p*sc + float(L)*17.3, rc = floor(rp), rf = fract(rp);
        float h = oc_hash(rc), per = 0.5 + h*0.6, rt = t/per + h*9.0, ri = floor(rt), rk = fract(rt);
        vec2 ctr = vec2(oc_hash(rc + ri*1.7), oc_hash(rc + ri*2.3 + 4.0))*0.6 + 0.2;
        float on2 = step(oc_hash(rc + ri*3.1 + 9.0), rainHere*0.9);
        float rr = length(rf - ctr), rad = sqrt(rk)*(0.16 + 0.12*oc_hash(rc + ri*5.3));
        rings += smoothstep(0.022, 0.006, abs(rr - rad)) * (1.0 - rk)*(1.0 - rk) * on2;
        splash += smoothstep(0.035, 0.0, rr) * smoothstep(0.18, 0.0, rk) * on2;
      }
      vec3 lit = mix(c*1.35 + 0.04, uRainCol*0.95, 0.45);                     // rings catch the light: tinted by the time of day
      c = mix(c, lit, clamp(rings*0.5 + splash*0.8, 0.0, 1.0)*(1.0 - fx.z*0.4));
      c += GLOW*(rings*0.65 + splash*0.8)*fx.z*flare;                          // a rainy night sparkles cyan like plankton
    }

    // rainbow after rain (daytime): a smooth spectrum, violet inside to red
    // outside, a fainter secondary bow outside it with the colours reversed,
    // and the slightly darker band of sky between them
    if (uRainbow > 0.01) {
      // anchored in the world where it appeared, so the boat can sail under it
      vec2 rbv = p - uRainbowPos;
      float al = dot(rbv, uViewDir)/uRainbowS, ac = dot(rbv, vec2(-uViewDir.y, uViewDir.x))/uRainbowS;
      float rr2 = length(vec2(ac, al));
      float ends = smoothstep(-0.1, 0.45, al) * uRainbow * (1.0 - fx.z*(1.0 - uBowMoon));
      float k1 = (rr2 - 0.95)/0.13, k2 = (rr2 - 1.22)/0.2;
      vec3 bow = vec3(0.0);
      if (k1 > 0.0 && k1 < 1.0) { vec3 h = clamp(abs(fract(0.78*(1.0 - k1) + vec3(0.0, 2.0/3.0, 1.0/3.0))*6.0 - 3.0) - 1.0, 0.0, 1.0); bow += h*sin(k1*3.14159)*0.28; }
      if (k2 > 0.0 && k2 < 1.0) { vec3 h = clamp(abs(fract(0.78*k2 + vec3(0.0, 2.0/3.0, 1.0/3.0))*6.0 - 3.0) - 1.0, 0.0, 1.0); bow += h*sin(k2*3.14159)*0.1; }
      c *= 1.0 - smoothstep(1.06, 1.12, rr2)*smoothstep(1.24, 1.18, rr2)*0.07*ends;  // darker band between the bows
      c *= 1.0 + smoothstep(0.95, 0.6, rr2)*0.04*ends;                           // a little brighter inside
      bow = mix(bow, vec3(dot(bow, vec3(0.333)))*1.4 + 0.02, uBowMoon*0.85);   // moonbow: pale, almost white
      c += bow*ends;
    }

    // lightning: blue-white light, brightest under the strike, the rest of the sea lit by the clouds
    vec2 fdv = (p - uFlashPos)/camH;
    c += uFlashCol*0.8*uFlash*(0.1 + 0.3*fx.z + 0.75*exp(-dot(fdv, fdv)*3.0));   // coloured by the time of day; lights the whole sea at night

    // fog: the water fades into soft grey-white with distance
    // fog: the water fades into soft grey-white with distance, in uneven
    // banks drifting with the wind. Rain (and more so a storm) brings mist too.
    float fdist = length(rel)/camH;
    float mist = max(uFog, rainHere*0.28 + uStorm*uRain*0.22);
    float bank = 0.45 + 0.9*oc_fbm(p*0.028 - uWind*t*0.35 + 61.0);
    float fogK = mist*(1.0 - exp(-pow(max(fdist - 0.3, 0.0)*1.1, 1.6)*(0.6 + mist*2.2)*bank));
    c = mix(c, uFogCol, clamp(fogK + mist*0.1*bank, 0.0, 0.97));

    // the boat's searchlight: a warm pool of light sweeping over the water (cuts through the fog)
    if (uSpot.w > 0.001) {
      float sd = length(p - uSpot.xy)/uSpot.z;
      c += vec3(1.0, 0.9, 0.7)*smoothstep(1.0, 0.0, sd)*smoothstep(1.0, 0.0, sd)*uSpot.w*0.5;
    }

    // haze into the sky colour toward the horizon, then fade out at the edge
    float dist = max(abs(vLP.x), abs(vLP.y));
    c = mix(c, mix(pal[9], pal[1], 0.22), smoothstep(uHalf*0.6, uHalf - uFade*0.3, dist) * 0.9);

    // never let an invalid value (NaN) out: one bad pixel would be spread over the
    // whole screen by the bloom pass (iPhone GPUs turn that white)
    diffuseColor.rgb = clamp(c, 0.0, 4.0) * 0.12;   // lit + emissive below ≈ the palette colour, not brighter
    diffuseColor.a = smoothstep(uHalf, uHalf - uFade, dist);
  }`;
