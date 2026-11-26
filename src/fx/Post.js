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
    uTexel: { value: new THREE.Vector2(0.001, 0.001) },
    uWarm: { value: new THREE.Vector3(0.05, 0.02, -0.035) },
    uCool: { value: new THREE.Vector3(-0.02, 0.0, 0.045) },
    uVig: { value: 0.22 },
    uAspect: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uSat; uniform vec3 uWarm; uniform vec3 uCool; uniform float uVig; uniform float uAspect; uniform float uInk; uniform vec2 uTexel;
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
      c = mix(c, c*0.55, edge * step(self, avg + 0.01) * uInk);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, uSat);
      c += uWarm*smoothstep(0.45, 1.0, l) + uCool*(1.0 - smoothstep(0.0, 0.5, l));
      vec2 q = (vUv - 0.5)*vec2(uAspect, 1.0);
      c *= mix(1.0 - uVig, 1.0, smoothstep(0.95, 0.3, length(q)/max(uAspect, 1.0)*1.1));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera, { mobile = false } = {}) {
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    // threshold 1.0: only HDR highlights bloom (sun, moon, glints, night glow), not the bright sky
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 1.0);
    if (mobile) {
      // bloom at half resolution on phones
      const set = this.bloom.setSize.bind(this.bloom);
      this.bloom.setSize = (w, h) => set(Math.max(1, w >> 1), Math.max(1, h >> 1));
    }
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  setSize(w, h, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.grade.uniforms.uAspect.value = w / h;
    this.grade.uniforms.uTexel.value.set(1.1 / w, 1.1 / h); // ~1 CSS pixel lines on any screen
  }

  /** Night gets a touch more bloom, storms a little less saturation. */
  update(night, storm) {
    this.bloom.strength = 0.4 + night * 0.4;
    this.grade.uniforms.uSat.value = 1.2 - storm * 0.15;
  }

  render(dt) { this.composer.render(dt); }
}
