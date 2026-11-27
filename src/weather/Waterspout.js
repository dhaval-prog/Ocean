import * as THREE from 'three';

// A waterspout: a rare twisting funnel that reaches down from the storm
// clouds to the sea far off, spins, drifts slowly across and fades. The base
// throws up a whirl of spray (handled by the app with Spray + ripples).

const VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv; varying float vRim;
void main() {
  vUv = uv;
  vec3 p = position;
  float h = uv.y;                                       // 0 at the sea … 1 at the cloud
  float r = mix(0.35, 1.0, pow(max(h, 0.0), 1.7)) * (1.0 + 0.08*sin(h*20.0 - uTime*3.0));
  p.xz *= r * 5.0;
  p.x += sin(h*3.2 + uTime*0.5)*h*4.0;                   // the funnel bends and sways
  p.z += cos(h*2.6 + uTime*0.4)*h*2.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 n = normalize(normalMatrix * normalize(vec3(position.x, 0.0, position.z)));
  vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));          // edges of the funnel read denser
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform float uTime; uniform float uFade; uniform vec3 uColor;
varying vec2 vUv; varying float vRim;
void main() {
  float h = vUv.y;
  float swirl = sin((vUv.x*3.0 + h*6.0 - uTime*1.6)*6.2832);   // spiral bands spinning round
  float a = (0.5 + 0.25*swirl) * mix(0.45, 1.0, vRim);
  a *= smoothstep(0.0, 0.05, h) * smoothstep(1.0, 0.7, h) * uFade;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor*(0.8 + 0.2*swirl)*mix(1.0, 0.7, vRim), a);   // darker at the edges, like a real funnel
}`;

export class Waterspout {
  constructor() {
    const geo = new THREE.CylinderGeometry(1, 1, 42, 28, 40, true);
    geo.translate(0, 21, 0);
    this.uniforms = { uTime: { value: 0 }, uFade: { value: 0 }, uColor: { value: new THREE.Color('#c8ced6') } };
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 35; this.mesh.visible = false;
    this.active = false; this.age = 0; this.life = 45;
    this.vel = new THREE.Vector2(); this.base = new THREE.Vector2();
  }

  /** Touch down at (x, z), drifting with velocity (vx, vz), for `life` seconds. */
  spawn(x, z, vx, vz, water, life = 45) {
    this.active = true; this.age = 0; this.life = life;
    this.base.set(x, z); this.vel.set(vx, vz);
    this.mesh.position.set(x, water, z);
  }

  /** Returns the base position while active (for spray / ripples), or null. */
  update(dt, elapsed, { light, tint }) {
    this.uniforms.uTime.value = elapsed;
    if (!this.active) { this.mesh.visible = false; return null; }
    this.age += dt;
    if (this.age > this.life) { this.active = false; this.mesh.visible = false; return null; }
    this.base.addScaledVector(this.vel, dt);
    this.mesh.position.x = this.base.x; this.mesh.position.z = this.base.y;
    this.uniforms.uFade.value = Math.min(1, this.age / 6, (this.life - this.age) / 8);
    this.uniforms.uColor.value.copy(tint).multiplyScalar(0.4 + 0.3 * light);   // storm-grey
    this.mesh.visible = true;
    return this.base;
  }
}
