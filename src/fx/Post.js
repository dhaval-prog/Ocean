import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// The "anime screenshot" pass: soft bloom, then colour grading
// (saturation, warm highlights, cool shadows) and a gentle vignette.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSat: { value: 1.12 },
    uWarm: { value: new THREE.Vector3(0.05, 0.02, -0.035) },
    uCool: { value: new THREE.Vector3(-0.02, 0.0, 0.045) },
    uVig: { value: 0.22 },
    uAspect: { value: 1 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uSat; uniform vec3 uWarm; uniform vec3 uCool; uniform float uVig; uniform float uAspect;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
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
  }

  /** Night gets a touch more bloom, storms a little less saturation. */
  update(night, storm) {
    this.bloom.strength = 0.4 + night * 0.4;
    this.grade.uniforms.uSat.value = 1.12 - storm * 0.15;
  }

  render(dt) { this.composer.render(dt); }
}
