import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Ocean } from './ocean/Ocean.js';
import { Sky } from './sky/Sky.js';
import { Particles } from './fx/Particles.js';
import { WindStreaks } from './fx/WindStreaks.js';
import { Post } from './fx/Post.js';
import { Ambience } from './audio/Ambience.js';
import { AutoQuality } from './core/AutoQuality.js';
import { createControls } from './ui/controls.js';
import './styles.css';

const app = document.getElementById('app');
const isTouch = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

// --- renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
// The water shader is fragment-heavy, so phones start at a lower pixel ratio.
const maxDpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
let pixelRatio = maxDpr;
renderer.setPixelRatio(pixelRatio);
renderer.domElement.className = 'scene';
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
camera.position.set(0, 7, 22);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3, -8);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 8;
controls.maxDistance = 60;
controls.minPolarAngle = 0.45;
controls.maxPolarAngle = 1.5; // look at the horizon, never under the surface
controls.rotateSpeed = isTouch ? 0.6 : 0.8;
controls.update();

// --- lights (scaled by time of day) ----------------------------------------
const lights = [
  [new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.0), null],
  [new THREE.DirectionalLight(0xffffff, 2.2), [4, 7, 5]],
  [new THREE.DirectionalLight(0xfff4e6, 0.5), [-5, 3, -4]],
].map(([l, p]) => { if (p) l.position.set(...p); l.userData.base = l.intensity; scene.add(l); return l; });

// --- world ------------------------------------------------------------------
const ocean = new Ocean({ segments: isTouch ? 220 : 300 });
const sky = new Sky(ocean.uniforms);
const particles = new Particles(isTouch ? { glints: 70, petals: 50, specks: 90 } : {});
const streaks = new WindStreaks(isTouch ? 5 : 7);
scene.add(sky.backdrop, ocean.mesh, particles.points, streaks.mesh);

const post = new Post(renderer, scene, camera, { mobile: isTouch });
const ambience = new Ambience();

const root = document.documentElement;
const glintColor = new THREE.Color();
function applyLook() {
  root.style.setProperty('--sky', '#' + ocean.skyColor.getHexString());
  root.style.setProperty('--sky-top', '#' + ocean.skyTopColor.getHexString());
  root.dataset.dark = ocean.light < 0.6 ? '1' : '0';
  for (const l of lights) l.intensity = l.userData.base * ocean.light;
  const L = ocean.look, S = sky.uniforms;
  S.uSunDir.value.copy(L.sunDir); S.uMoon.value = L.moon; S.uRays.value = L.rays; S.uStars.value = L.stars; S.uLight.value = ocean.light;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#' + ocean.skyTopColor.getHexString());
}

// --- UI -----------------------------------------------------------------------
const state = { tod: 1, auto: true };
if (params.has('tod')) { state.tod = +params.get('tod'); state.auto = false; } // e.g. ?tod=4 for night
const ui = createControls(document.getElementById('panel'), {
  initial: { tod: state.tod, auto: state.auto, storm: ocean.storm, foam: ocean.foam, glitter: ocean.glitter, reef: ocean.reef },
  onTimeOfDay: v => { state.tod = v; state.auto = false; ocean.setTimeOfDay(v); applyLook(); },
  onAuto: v => { state.auto = v; },
  onStorm: v => { ocean.storm = v; },
  onFoam: v => { ocean.foam = v; },
  onGlitter: v => { ocean.glitter = v; },
  onReef: v => { ocean.reef = v; },
});
ocean.setTimeOfDay(state.tod);
ui.setTimeOfDay(ocean.timeOfDay, ocean.timeName);
applyLook();

// Sound: starts on the first tap (browsers block audio before that).
const soundBtn = document.getElementById('sound');
let muted = false;
try { muted = localStorage.getItem('ocean.muted') === '1'; } catch {}
const renderSound = () => { soundBtn.classList.toggle('off', muted); soundBtn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off'); };
ambience.muted = muted; renderSound();
soundBtn.addEventListener('click', e => {
  e.stopPropagation();
  muted = !muted; renderSound();
  try { localStorage.setItem('ocean.muted', muted ? '1' : '0'); } catch {}
  if (!muted) ambience.start();
  ambience.setMuted(muted);
});
const firstGesture = () => { if (!muted) ambience.start(); };
window.addEventListener('pointerdown', firstGesture, { once: true });
window.addEventListener('keydown', firstGesture, { once: true });

// --- touching the water makes ripples (foam by day, glow by night) ---------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ocean.base);
function rippleAt(e, strength) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (ray.ray.intersectPlane(waterPlane, hit) && hit.distanceTo(camera.position) < 90) ocean.addRipple(hit.x, hit.z, strength);
}
let pressed = false, lastTrail = 0;
renderer.domElement.addEventListener('pointerdown', e => { pressed = true; rippleAt(e, 1); });
window.addEventListener('pointerup', () => { pressed = false; });
renderer.domElement.addEventListener('pointermove', e => {
  if (!pressed || performance.now() - lastTrail < 140) return;
  lastTrail = performance.now(); rippleAt(e, 0.5);
});

// --- slow cinematic camera drift when idle ---------------------------------
let idle = 0, interacting = false, driftT = 0;
controls.addEventListener('start', () => { interacting = true; idle = 0; });
controls.addEventListener('end', () => { interacting = false; idle = 0; });
const sph = new THREE.Spherical(), offset = new THREE.Vector3();
function drift(dt) {
  if (interacting) return;
  idle += dt;
  const w = THREE.MathUtils.smoothstep(idle, 5, 9);
  if (w <= 0) return;
  driftT += dt * w;
  offset.copy(camera.position).sub(controls.target);
  sph.setFromVector3(offset);
  const goal = Math.sin(driftT * 0.05) * 0.35; // sway either side of the sun
  sph.theta += (goal - sph.theta) * Math.min(1, dt * 0.25 * w);
  sph.phi += (1.44 - sph.phi) * Math.min(1, dt * 0.1 * w);
  camera.position.copy(controls.target).add(offset.setFromSpherical(sph));
}

// --- sizing & adaptive quality ---------------------------------------------
let W = 1, H = 1;
function applySize() {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(W, H, false);
  post.setSize(W, H, pixelRatio);
  sky.setSize(W * pixelRatio, H * pixelRatio, isTouch ? 0.5 : 0.75);
  streaks.setSize(W * pixelRatio, H * pixelRatio);
}
function resize() {
  W = app.clientWidth || 1; H = app.clientHeight || 1;
  camera.aspect = W / H;
  camera.fov = W < H ? 58 : 45; // portrait phones see more sky and sea
  camera.updateProjectionMatrix();
  applySize();
}
new ResizeObserver(resize).observe(app);
resize();

const quality = new AutoQuality({
  min: isTouch ? 0.6 : 0.75, max: maxDpr, start: maxDpr, enabled: params.get('quality') !== 'fixed',
  onChange: v => { pixelRatio = v; applySize(); },
});

// --- loop -----------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document); // pauses cleanly while the tab is hidden
let elapsed = 0, glowTimer = 0;
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(0.1, timer.getDelta());
  elapsed += dt;
  if (state.auto) {
    state.tod += dt / 8;
    ocean.setTimeOfDay(state.tod);
    applyLook();
    ui.setTimeOfDay(ocean.timeOfDay, ocean.timeName);
  }
  const L = ocean.look;

  // at night the sea glows by itself in random patches near the view
  if (L.night > 0.3 && (glowTimer -= dt) <= 0) {
    glowTimer = 0.5 + Math.random() * 0.8;
    const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 22;
    ocean.addRipple(controls.target.x + Math.cos(a) * r, controls.target.z + Math.sin(a) * r * 0.7, 0.35 * L.night);
  }

  ocean.update(dt, elapsed);
  sky.uniforms.uStorm.value = ocean.storm;
  glintColor.copy(ocean.uniforms.uPalB.value[5]).lerp(ocean.uniforms.uPalA.value[8], 0.5);
  particles.update(elapsed, { center: controls.target, look: L, storm: ocean.storm, pixelRatio, glintColor });
  streaks.update(elapsed, ocean.storm, ocean.light);
  post.update(L.night, ocean.storm);
  ambience.update(ocean.storm, L.night);

  drift(dt);
  controls.update();
  sky.render(renderer, camera);
  post.render(dt);
  quality.tick(dt);
});

// Exposed for upcoming game / chat layers and for debugging in the console.
window.oceanApp = { THREE, scene, camera, controls, renderer, ocean, sky, particles, post, ambience, quality };
