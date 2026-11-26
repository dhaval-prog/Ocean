import * as THREE from 'three';
import { Ocean } from './ocean/Ocean.js';
import { Particles } from './fx/Particles.js';
import { WindStreaks } from './fx/WindStreaks.js';
import { Post } from './fx/Post.js';
import { Ambience } from './audio/Ambience.js';
import { AutoQuality } from './core/AutoQuality.js';
import { TopDownControls } from './core/TopDownControls.js';
import { Boat } from './boat/Boat.js';
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
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);

// Tilted view: drag to pan, pinch / scroll to zoom.
// looking down at 60° from the horizon; bound keeps the far edge of the ocean out of view
const controls = new TopDownControls(camera, renderer.domElement, { height: isTouch ? 26 : 32, pitch: 60, bound: 40 });
controls.update(0);

// --- lights (scaled by time of day) ----------------------------------------
const lights = [
  [new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.0), null],
  [new THREE.DirectionalLight(0xffffff, 2.2), [4, 7, 5]],
  [new THREE.DirectionalLight(0xfff4e6, 0.5), [-5, 3, -4]],
].map(([l, p]) => { if (p) l.position.set(...p); l.userData.base = l.intensity; scene.add(l); return l; });

// --- world ------------------------------------------------------------------
const ocean = new Ocean({ size: 500, segments: isTouch ? 260 : 340 }); // big enough that the tilted view never reaches its edge
const particles = new Particles(isTouch ? { glints: 70, petals: 50, specks: 90 } : {});
const streaks = new WindStreaks(isTouch ? 5 : 7);
scene.add(ocean.mesh, particles.points, streaks.mesh);

// the tugboat: tap the sea to sail it there
const boat = new Boat(ocean);
scene.add(boat.group);
boat.load().catch(err => console.warn('Boat failed to load', err));

const post = new Post(renderer, scene, camera, { mobile: isTouch });
const ambience = new Ambience();

const root = document.documentElement;
const glintColor = new THREE.Color();
function applyLook() {
  root.style.setProperty('--sky', '#' + ocean.skyColor.getHexString());
  root.style.setProperty('--sky-top', '#' + ocean.skyTopColor.getHexString());
  root.dataset.dark = ocean.light < 0.6 ? '1' : '0';
  for (const l of lights) l.intensity = l.userData.base * ocean.light;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#' + ocean.uniforms.uPalB.value[1].getHexString());
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
function waterPoint(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(waterPlane, hit) && hit.distanceTo(camera.position) < 90 ? hit : null;
}
function rippleAt(e, strength) {
  const p = waterPoint(e);
  if (p) ocean.addRipple(p.x, p.z, strength);
}
let pressed = false, lastTrail = 0, down = null;
renderer.domElement.addEventListener('pointerdown', e => {
  pressed = true; rippleAt(e, 1);
  if (e.isPrimary) down = { x: e.clientX, y: e.clientY, t: performance.now() };
});
window.addEventListener('pointerup', e => {
  pressed = false;
  // a quick tap (not a drag or pinch) sends the boat there
  if (down && e.isPrimary && performance.now() - down.t < 400 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10) {
    const p = waterPoint(e);
    if (p) boat.sailTo(p.x, p.z);
  }
  down = null;
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!pressed || performance.now() - lastTrail < 140) return;
  lastTrail = performance.now(); rippleAt(e, 0.5);
});

// --- slow drift when idle: the view floats in a lazy circle -----------------
let idle = 0, interacting = false, driftT = 0;
const anchor = new THREE.Vector2();
controls.onStart = () => { interacting = true; idle = 0; };
controls.onEnd = () => { interacting = false; idle = 0; };
function drift(dt) {
  if (interacting) return;
  if (idle === 0) driftT = 0;
  idle += dt;
  // float around the boat, following it if it sails off
  anchor.set(boat.position.x, boat.position.y);
  const w = THREE.MathUtils.smoothstep(idle, 4, 8);
  if (w <= 0) return;
  driftT += dt * w;
  const a = driftT * 0.06, R = 4;
  controls.center.x += (anchor.x + Math.sin(a) * R - controls.center.x) * Math.min(1, dt * 0.5 * w);
  controls.center.z += (anchor.y + (Math.cos(a) - 1) * R - controls.center.z) * Math.min(1, dt * 0.5 * w);
}

// --- sizing & adaptive quality ---------------------------------------------
let W = 1, H = 1;
function applySize() {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(W, H, false);
  post.setSize(W, H, pixelRatio);
  streaks.setSize(W * pixelRatio, H * pixelRatio);
}
function resize() {
  W = app.clientWidth || 1; H = app.clientHeight || 1;
  camera.aspect = W / H;
  camera.fov = W < H ? 62 : 40; // portrait phones need a wider view to see enough sea
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
let elapsed = 0, glowTimer = 0, dropTimer = 1;
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

  // now and then something drops into the sea somewhere in view
  if ((dropTimer -= dt) <= 0) {
    dropTimer = 1.2 + Math.random() * 2.3;
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 12;
    ocean.addRipple(controls.center.x + Math.cos(a) * r, controls.center.z + Math.sin(a) * r * 0.7, 0.5 + Math.random() * 0.5);
  }

  // at night the sea glows by itself in random patches near the view
  if (L.night > 0.3 && (glowTimer -= dt) <= 0) {
    glowTimer = 0.5 + Math.random() * 0.8;
    const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 13;
    ocean.addRipple(controls.center.x + Math.cos(a) * r, controls.center.z + Math.sin(a) * r * 0.7, 0.35 * L.night);
  }

  drift(dt);
  controls.update(dt);
  ocean.update(dt, elapsed);
  boat.update(dt, elapsed);
  boat.setNight(L.night);
  glintColor.copy(ocean.uniforms.uPalB.value[5]).lerp(ocean.uniforms.uPalA.value[8], 0.5);
  particles.update(elapsed, { center: controls.center, look: L, storm: ocean.storm, pixelRatio, glintColor });
  streaks.update(elapsed, ocean.storm, ocean.light);
  post.update(L.night, ocean.storm);
  ambience.update(ocean.storm, L.night);

  post.render(dt);
  quality.tick(dt);
});

// Exposed for upcoming game / chat layers and for debugging in the console.
window.oceanApp = { THREE, scene, camera, controls, renderer, ocean, boat, particles, post, ambience, quality };
