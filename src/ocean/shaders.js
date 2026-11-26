// Top-down cartoon water. One flat quad that follows the camera; every
// pattern comes from a pre-baked noise texture (see noise.js).
//
// Edges and ink lines are anti-aliased with screen-space derivatives, so they
// stay crisp, never shimmer while panning, and keep the same thickness at any zoom.

export const WATER_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const WATER_FRAG = /* glsl */ `
uniform sampler2D uNoise;
uniform vec3 uPalA[10]; uniform vec3 uPalB[10]; uniform vec4 uFxA; uniform vec4 uFxB; uniform float uMix;
uniform float uTime; uniform float uFlow; uniform vec2 uWind;
uniform float uStorm; uniform float uFoam; uniform float uGlitter; uniform float uReef; uniform float uLight;
uniform vec4 uRipples[8]; uniform vec4 uObjects[4]; uniform vec4 uIsland;
varying vec2 vP;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tex(vec2 uv, int ch) { vec4 t = texture2D(uNoise, uv); return ch == 0 ? t.r : ch == 1 ? t.g : ch == 2 ? t.b : t.a; }

// anti-aliased step: hard cartoon edge, smoothed over ~1 pixel
float aastep(float th, float v) { float w = max(fwidth(v), 1e-5) * 0.7; return smoothstep(th - w, th + w, v); }
// ink line on the contour v = th, constant thickness in pixels
float inkLine(float v, float th, float px) { float d = abs(v - th) / max(fwidth(v), 1e-5); return 1.0 - smoothstep(px - 0.7, px + 0.7, d); }
// stroke of half-width w (world units) along a distance field d
float stroke(float d, float w) { float f = max(fwidth(d), 1e-5); return 1.0 - smoothstep(w - f, w + f, d); }
float backOut(float x) { float c = 1.7; x -= 1.0; return 1.0 + (c + 1.0)*x*x*x + c*x*x; }

void main() {
  float m = uMix*uMix*(3.0 - 2.0*uMix);
  vec3 pal[10]; for (int i = 0; i < 10; i++) pal[i] = mix(uPalA[i], uPalB[i], m);
  vec4 fx = mix(uFxA, uFxB, m);
  float night = fx.z;

  vec2 p = vP, W = uWind, Wp = vec2(-W.y, W.x);
  vec2 q = vec2(dot(p, W), dot(p, Wp));           // current-aligned coordinates
  float fl = uFlow;

  // --- water shapes: the pattern slides with the current; a second, slower
  // layer makes the shapes evolve gently instead of "boiling"
  vec2 warp = (texture2D(uNoise, (q - vec2(fl*0.55, 0.0))*0.011 + 0.37).ga - 0.5) * 0.22;
  float n = tex((q - vec2(fl, 0.0))*vec2(0.02, 0.032) + warp, 0)*0.8
          + tex((q - vec2(fl*0.8, 0.0))*vec2(0.045, 0.07) + 0.5, 1)*0.2;

  // 3 bold tones
  vec3 deep = pal[1], mid = mix(pal[2], pal[3], 0.35), light = mix(pal[3], pal[4], 0.55);
  float b1 = aastep(0.42, n), b2 = aastep(0.62, n);
  vec3 c = mix(mix(deep, mid, b1), light, b2);

  // flat cloud shadows drifting by (daytime)
  float cs = aastep(0.74, tex(p*0.006 + uTime*vec2(0.0016, 0.0007), 0));
  c = mix(c, c*vec3(0.8, 0.86, 0.98), cs*0.45*(1.0 - night));

  // reef shallows
  float rv = length((p - vec2(-10.0, 6.0))*vec2(1.0, 1.3)) + (tex(p*0.02 + 0.3, 1) - 0.5)*4.0;
  float reef = (1.0 - aastep(5.0, rv)) * uReef, sandbar = (1.0 - aastep(2.6, rv)) * uReef;
  c = mix(c, mix(pal[3], pal[4], 0.8)*vec3(0.92, 1.08, 1.02), reef);
  c = mix(c, mix(pal[4], pal[6], 0.5)*vec3(1.15, 1.05, 0.82), sandbar*0.85);

  // --- rounded foam blobs (Wind-Waker style) with a hollow swirl inside
  float foamAmt = clamp(uFoam + uStorm*0.5, 0.0, 1.0);
  float fv = tex((q - vec2(fl*1.15, 0.0))*vec2(0.11, 0.17) + warp*0.6 + 0.21, 2)*0.85 + n*0.15;
  float fth = mix(0.94, 0.8, foamAmt);
  float foam = aastep(fth, fv) * (1.0 - aastep(fth + 0.05, fv)*0.9);

  // --- cartoon wave marks: little "‿‿" strokes that pop in, slide, fade
  float marks = 0.0;
  {
    float C = 3.4;
    vec2 mq = (q - vec2(fl*1.25, 0.0)) / C;
    vec2 id = floor(mq), f = (fract(mq) - 0.5)*C;
    float h = hash(id);
    if (h < mix(0.22, 0.45, uStorm)) {
      float ph = fract(uTime*0.22 + h*7.0);
      float grow = backOut(clamp(ph/0.22, 0.0, 1.0)), fade = 1.0 - smoothstep(0.62, 1.0, ph);
      vec2 lp = f - (vec2(hash(id + 1.3), hash(id + 2.7)) - 0.5)*1.2;
      float halfLen = 0.42*grow, R = 0.34;
      for (int k = 0; k < 2; k++) {
        vec2 a = lp - vec2(float(k)*0.78 - 0.39, 0.0);
        float d = abs(length(a - vec2(0.0, R)) - R);
        float taper = smoothstep(halfLen, halfLen*0.5, abs(a.x)) * step(a.y, R*0.5);
        marks = max(marks, stroke(d, 0.055) * taper * fade);
      }
    }
  }

  // --- pop-in twinkles (little 4-point stars)
  float spark = 0.0;
  {
    vec2 sp = p*0.9, cell = floor(sp), f = fract(sp) - 0.5;
    float T = uTime*0.55 + hash(cell)*13.0, ph = fract(T);
    float on = step(mix(0.985, 0.95, uGlitter), hash(cell + floor(T)*1.7));
    float s = backOut(clamp(ph/0.3, 0.0, 1.0)) * (1.0 - smoothstep(0.5, 1.0, ph));
    f -= (vec2(hash(cell + 4.1), hash(cell + 9.2)) - 0.5)*0.4;
    float g = sqrt(abs(f.x)) + sqrt(abs(f.y));
    spark = on * (1.0 - aastep(0.3*s + 1e-3, g)) * b1 * fx.x;
  }

  // --- ripples: overshooting rings + splash droplets (foam by day, glow by night)
  float rip = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 R = uRipples[i]; float age = uTime - R.z;
    if (R.w <= 0.0 || age < 0.0 || age > 2.6) continue;
    float k = clamp(age/1.5, 0.0, 1.0), rad = mix(0.25, 3.0*sqrt(R.w), backOut(k));
    float fade = 1.0 - smoothstep(1.3, 2.6, age), r = length(p - R.xy);
    float ring = stroke(abs(r - rad), 0.1*(1.0 - k*0.5)) + 0.7*stroke(abs(r - rad*0.62), 0.06);
    float drops = 0.0;
    if (age < 0.75) {
      for (int j = 0; j < 6; j++) {
        float an = float(j)*1.047 + hash(R.xy + float(j))*0.6;
        vec2 dp = R.xy + vec2(cos(an), sin(an))*(0.35 + age*3.4*sqrt(R.w));
        drops += 1.0 - aastep(0.15*(1.0 - age/0.75) + 1e-3, length(p - dp));
      }
    }
    rip += (ring*fade + drops)*R.w;
  }
  for (int i = 0; i < 4; i++) {                      // foam rings around floating objects
    vec4 O = uObjects[i]; if (O.w <= 0.0) continue;
    vec2 dv = p - O.xy; float a = atan(dv.y, dv.x);
    float wob = 0.12*sin(a*5.0 + uTime*2.0) + 0.08*sin(a*3.0 - uTime*1.3);
    rip += stroke(abs(length(dv) - O.z - 0.25 - wob), 0.1) * O.w;
  }
  rip = clamp(rip, 0.0, 1.0);

  // --- compose: foam + marks + ripples in white (glowing at night), ink outlines
  // day: white foam, dark ink.  night: dim teal foam with glowing outlines
  vec3 white = mix(pal[5], mix(pal[4], pal[5], 0.35), night);
  vec3 ink = mix(deep*0.45, pal[5]*1.15, night*0.85);
  vec3 glow = pal[5] * (1.0 + night*0.3);
  float px = 1.0;
  c = mix(c, white, foam);
  c = mix(c, ink, inkLine(n, 0.42, px)*(1.0 - foam)*0.85);
  c = mix(c, ink, inkLine(fv, fth, px)*0.9);
  c = mix(c, glow, max(marks*0.92, rip));
  c = mix(c, pal[8]*(1.0 + night*0.6), min(spark*1.2, 1.0));

  // --- a small cartoon island: grass, palms, sand, shallow halo, surf
  if (uIsland.w > 0.0) {
    vec2 ip = p - uIsland.xy;
    float d = length(ip) - uIsland.z + (tex(ip*0.025 + 0.7, 2) - 0.5)*uIsland.z*0.55;
    float lit = mix(0.4, 1.0, uLight);
    vec3 shallow = mix(pal[3], pal[4], 0.75)*vec3(0.95, 1.08, 1.0);
    c = mix(c, shallow, 1.0 - aastep(1.9, d));
    float surf = stroke(abs(d - (0.6 + 0.3*sin(uTime*1.4))), 0.12) + 0.6*stroke(abs(d - (1.35 + 0.3*sin(uTime*1.4 - 1.2))), 0.07);
    c = mix(c, glow, clamp(surf, 0.0, 1.0)*0.9);
    vec3 sand = vec3(0.98, 0.86, 0.6)*lit, grass = vec3(0.42, 0.78, 0.4)*lit, bush = vec3(0.26, 0.6, 0.32)*lit;
    c = mix(c, sand, 1.0 - aastep(0.0, d));
    c = mix(c, grass, 1.0 - aastep(-1.1, d));
    c = mix(c, bush, (1.0 - aastep(-1.4, d)) * aastep(0.62, tex(ip*0.09 + 0.2, 2)));
    for (int k = 0; k < 3; k++) {                    // palm crowns
      vec2 pc = ip - uIsland.z*0.42*vec2(cos(float(k)*2.3 + 0.4), sin(float(k)*2.3 + 0.4));
      float a = atan(pc.y, pc.x) + uTime*0.05;
      float pr = length(pc) - 0.95*(0.72 + 0.28*cos(a*6.0));
      c = mix(c, vec3(0.2, 0.52, 0.28)*lit, 1.0 - aastep(0.0, pr));
      c = mix(c, deep*0.45, inkLine(pr, 0.0, px)*0.9);
    }
    c = mix(c, deep*0.45, (inkLine(d, 0.0, px) + inkLine(d, -1.1, px)*0.7)*0.9);
  }

  c *= 1.0 - uStorm*0.12;
  gl_FragColor = vec4(c, 1.0);
}`;
