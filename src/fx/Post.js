import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Cartoon finishing pass: soft bloom, then ink outlines (edge detection on
// brightness), colour grading (saturation, warm highlights, cool shadows)
// and a gentle vignette.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSat: { value: 1.2 },
    uInk: { value: 0.6 },
    tMask: { value: null },
    uMasked: { value: 0 },
    uTexel: { value: new THREE.Vector2(0.001, 0.001) },
    uWarm: { value: new THREE.Vector3(0.05, 0.02, -0.035) },
    uCool: { value: new THREE.Vector3(-0.025, 0.008, 0.03) },   // cool shadows, without pushing blues toward violet
    uVig: { value: 0.22 },
    uAspect: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uSat; uniform vec3 uWarm; uniform vec3 uCool; uniform float uVig; uniform float uAspect; uniform float uInk; uniform vec2 uTexel; uniform sampler2D tMask; uniform float uMasked;
    varying vec2 vUv;
    float L(vec2 o) { return dot(texture2D(tDiffuse, vUv + o*uTexel).rgb, vec3(0.299, 0.587, 0.114)); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // ink outlines: Sobel edges on brightness, drawn as a darker line
      float tl = L(vec2(-1, 1)), t = L(vec2(0, 1)), tr = L(vec2(1, 1));
      float l0 = L(vec2(-1, 0)), r0 = L(vec2(1, 0));
      float bl = L(vec2(-1, -1)), b = L(vec2(0, -1)), br = L(vec2(1, -1));
      float gx = (tr + 2.0*r0 + br) - (tl + 2.0*l0 + bl);
      float gy = (tl + 2.0*t + tr) - (bl + 2.0*b + br);
      float edge = smoothstep(0.25, 0.5, length(vec2(gx, gy)));
      // ink only on the darker side of an edge, so white foam keeps a clean
      // outline drawn in the water around it instead of a grey halo inside it
      float avg = (t + b + l0 + r0) * 0.25, self = dot(c, vec3(0.299, 0.587, 0.114));
      // no ink on (or right round) the letter paper: its diagonal fold edges would ink as a sawtooth
      float paper = uMasked > 0.5 ? smoothstep(0.02, 0.2, texture2D(tMask, vUv).r) : 0.0;
      c = mix(c, c*0.55, edge * step(self, avg + 0.01) * uInk * (1.0 - paper));
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, uSat);
      c += uWarm*smoothstep(0.45, 1.0, l) + uCool*(1.0 - smoothstep(0.0, 0.5, l));
      vec2 q = (vUv - 0.5)*vec2(uAspect, 1.0);
      c *= mix(1.0 - uVig, 1.0, smoothstep(0.95, 0.3, length(q)/max(uAspect, 1.0)*1.1));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

const MASK_LAYER = 7;

export class Post {
  constructor(renderer, scene, camera) {
    // 4x MSAA everywhere (phones too) so edges and ink outlines stay smooth
    const samples = renderer.capabilities.isWebGL2 ? Math.min(4, renderer.capabilities.maxSamples || 4) : 0;
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    // threshold 1.0: only HDR highlights bloom (sun, moon, glints, night glow), not the bright sky
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    // a low-res mask of the letter paper (linear filtering spreads it a little past the paper's edge)
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.maskRT = new THREE.WebGLRenderTarget(2, 2);
    this.maskMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.grade.uniforms.tMask.value = this.maskRT.texture;
  }

  /** Objects kept free of the ink outlines (the letter paper). */
  setUninked(obj) { this.uninked = obj; obj.layers.enable(MASK_LAYER); }

  setSize(w, h, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.maskRT.setSize(Math.max(2, Math.round(w * pixelRatio / 3)), Math.max(2, Math.round(h * pixelRatio / 3)));
    this.grade.uniforms.uAspect.value = w / h;
    this.grade.uniforms.uTexel.value.set(1.1 / w, 1.1 / h); // ~1 CSS pixel lines on any screen
  }

  /** Night gets a touch more bloom, storms a little less saturation. */
  update(night, storm) {
    this.bloom.strength = 0.4 + night * 0.4;
    this.grade.uniforms.uSat.value = 1.2 - storm * 0.15;
  }

  render(dt) {
    const o = this.uninked, on = !!(o && o.visible && o.parent);
    this.grade.uniforms.uMasked.value = on ? 1 : 0;
    if (on) {
      const r = this.renderer, sc = this.scene, cam = this.camera, bg = sc.background, ov = sc.overrideMaterial, fog = sc.fog;
      const mask = cam.layers.mask, cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
      cam.layers.set(MASK_LAYER); sc.background = null; sc.overrideMaterial = this.maskMat; sc.fog = null;
      r.setRenderTarget(this.maskRT); r.setClearColor(0x000000, 1); r.clear(); r.render(sc, cam);
      r.setRenderTarget(null); r.setClearColor(cc, ca);
      cam.layers.mask = mask; sc.background = bg; sc.overrideMaterial = ov; sc.fog = fog;
    }
    this.composer.render(dt);
  }
}
