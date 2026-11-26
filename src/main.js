import * as THREE from 'three';
import { Ocean } from './ocean/Ocean.js';
import { Particles } from './fx/Particles.js';
import { WindStreaks } from './fx/WindStreaks.js';
import { Post } from './fx/Post.js';
import { Ambience } from './audio/Ambience.js';
import { AutoQuality } from './core/AutoQuality.js';
import { TopDownControls } from './core/TopDownControls.js';
import { todFromClock, clockLabel, HOUR_CYCLE_RATE } from './core/Clock.js';
import { Boat } from './boat/Boat.js';
import { Marker } from './boat/Marker.js';
import { Smoke } from './boat/Smoke.js';
import { SinkSequence } from './boat/SinkSequence.js';
import { Letter } from './social/Letter.js';
import { createControls } from './ui/controls.js';
import './styles.css';

const app = document.getElementById('app');
const isTouch = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

// --- renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
// Same sharpness on phones as on desktop: up to 2x (a 3x phone screen gains
// almost nothing visible above 2x, but would cost over twice the pixels).
const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
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
const ocean = new Ocean({ size: 500, segments: 340 }); // big enough that the tilted view never reaches its edge
const particles = new Particles();
const streaks = new WindStreaks(7);
scene.add(ocean.mesh, particles.points, streaks.mesh);

// the tugboat: tap the sea to sail it there
const boat = new Boat(ocean);
const marker = new Marker();
const smoke = new Smoke();
scene.add(boat.group, marker.group, smoke.points);
const funnelPos = new THREE.Vector3();

// click the boat: it sinks, a paper flies up and onto the screen; flick it back to get the boat back
const seqHint = document.getElementById('seq-hint');
const seq = new SinkSequence({
  scene, camera, dom: renderer.domElement, boat, ocean,
  onChange: mode => {
    controls.enabled = mode === 'idle';                // the camera holds still during the sequence
    if (mode !== 'idle') marker.hide();
    letter?.onMode(mode);                              // writing overlay, people row, guide text
  },
});
// the letter on the paper + who it's for (people row at the top)
const letter = new Letter({ root: app, seq, hint: seqHint });
boat.load().catch(err => console.warn('Boat failed to load', err));

const post = new Post(renderer, scene, camera);
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
// Time of day: 'realtime' (default, follows the device clock), 'cycle' (a full
// day every hour) or 'manual' (a time the user picked). The choice is remembered.
const MODE_KEY = 'ocean.todMode', TOD_KEY = 'ocean.tod';
const state = { mode: 'realtime', tod: todFromClock() };
try {
  const m = localStorage.getItem(MODE_KEY);
  if (m === 'cycle' || m === 'manual') state.mode = m;
  const t = parseFloat(localStorage.getItem(TOD_KEY));
  if (state.mode !== 'realtime' && Number.isFinite(t)) state.tod = t;
} catch {}
if (params.has('tod')) { state.tod = +params.get('tod'); state.mode = 'manual'; } // e.g. ?tod=4 for night
const saveTod = () => { try { localStorage.setItem(MODE_KEY, state.mode); localStorage.setItem(TOD_KEY, String(state.tod % 5)); } catch {} };
let todLabelAt = 0;
function showTod() {
  const name = state.mode === 'realtime' ? `${ocean.timeName} · ${clockLabel()}` : ocean.timeName;
  ui.setTimeOfDay(ocean.timeOfDay, name);
}
const ui = createControls(document.getElementById('panel'), {
  initial: { tod: state.tod, mode: state.mode, storm: ocean.storm, foam: ocean.foam, glitter: ocean.glitter, reef: ocean.reef },
  onTimeOfDay: v => { state.tod = v; state.mode = 'manual'; ocean.setTimeOfDay(v); applyLook(); saveTod(); },
  onMode: m => {
    state.mode = m;
    if (m === 'realtime') state.tod = todFromClock();
    ocean.setTimeOfDay(state.tod); applyLook(); showTod(); saveTod();
  },
  onStorm: v => { ocean.storm = v; },
  onFoam: v => { ocean.foam = v; },
  onGlitter: v => { ocean.glitter = v; },
  onReef: v => { ocean.reef = v; },
});
ocean.setTimeOfDay(state.tod);
showTod();
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

// --- steering: press on (or right next to) the boat and drag -------------------
// The boat follows your finger while you hold; let go and it carries on to that
// spot. A quick tap on the boat sounds the horn. This gesture runs before the
// camera's, so the view does not pan while you steer.
let steer = null;
function honk() {
  ambience.horn();
  smoke.burst(boat.funnelWorld(), boat.heading, 3);
}
app.addEventListener('pointerdown', e => {
  if (e.target !== renderer.domElement || !boat.ready || !e.isPrimary || seq.active) return;
  const s = boat.screenInfo(camera, renderer.domElement);
  if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > Math.max(38, s.radius * 1.25)) return;
  steer = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, last: null };
  controls.enabled = false;            // this gesture belongs to the boat
}, { capture: true });
window.addEventListener('pointermove', e => {
  if (!steer || e.pointerId !== steer.id) return;
  steer.moved = Math.max(steer.moved, Math.hypot(e.clientX - steer.x, e.clientY - steer.y));
  if (steer.moved < 8) return;
  const p = waterPoint(e);
  if (p) { boat.sailTo(p.x, p.z); steer.last = { x: p.x, z: p.z }; marker.hide(); setFollow(true); }
});
function endSteer(e) {
  if (!steer || e.pointerId !== steer.id) return;
  if (steer.moved < 8) seq.start();            // a tap on the boat sinks it
  else if (steer.last) marker.place(steer.last.x, steer.last.z, ocean.base);
  steer = null;
  controls.enabled = !seq.active;
}
window.addEventListener('pointerup', endSteer);
window.addEventListener('pointercancel', endSteer);

renderer.domElement.addEventListener('pointerdown', e => {
  if (steer || seq.active) return;
  pressed = true; rippleAt(e, 1);
  if (e.isPrimary && e.button === 0 && !e.shiftKey) down = { x: e.clientX, y: e.clientY, t: performance.now() };
});
window.addEventListener('pointerup', e => {
  pressed = false;
  // a quick tap on the water (not a drag or pinch) sends the boat there
  if (down && e.isPrimary && performance.now() - down.t < 400 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10) {
    const p = waterPoint(e);
    if (p) { boat.sailTo(p.x, p.z); marker.place(p.x, p.z, ocean.base); setFollow(true); }
  }
  down = null;
});
renderer.domElement.addEventListener('pointermove', e => {
  if (steer || !pressed || performance.now() - lastTrail < 140) return;
  lastTrail = performance.now(); rippleAt(e, 0.5);
});

// --- keyboard (desktop): arrows / WASD to drive, Space for the horn ----------
const keys = new Set();
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
function applyKeys() {
  boat.input.throttle = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
  boat.input.turn = (keys.has('left') ? 1 : 0) - (keys.has('right') ? 1 : 0);
}
window.addEventListener('keydown', e => {
  if (e.target.closest?.('input, button, textarea, select')) return;   // let sliders keep their arrow keys
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) honk(); return; }
  if (e.code === 'Escape' && seq.active) { seq.throwBack(); return; }
  if (seq.active) return;
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  keys.add(k); applyKeys();
  marker.hide(); setFollow(true);
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) { keys.delete(k); applyKeys(); } });
window.addEventListener('blur', () => { keys.clear(); applyKeys(); });

// --- follow mode: the camera keeps the boat in view ---------------------------
// On by default and whenever you send the boat somewhere; dragging the view
// turns it off; the button toggles it.
const followBtn = document.getElementById('follow');
let follow = true;
function setFollow(on) {
  follow = on;
  followBtn.classList.toggle('on', on);
  followBtn.setAttribute('aria-pressed', String(on));
  followBtn.setAttribute('aria-label', on ? 'Stop following the boat' : 'Follow the boat');
}
setFollow(true);
followBtn.addEventListener('click', e => { e.stopPropagation(); setFollow(!follow); });
controls.onPan = () => setFollow(false);
function followBoat(dt) {
  if (!follow || !boat.ready) return;
  // look a little ahead of the boat when it is moving
  const lead = boat.speed * 0.9;
  const tx = boat.position.x + Math.cos(boat.heading) * lead, tz = boat.position.y - Math.sin(boat.heading) * lead;
  const k = Math.min(1, dt * 2.5);
  controls.center.x += (tx - controls.center.x) * k;
  controls.center.z += (tz - controls.center.z) * k;
  controls.velocity.set(0, 0);
}

// --- 360° view -------------------------------------------------------------------
// The button turns on look-around mode: a one-finger drag turns the view all the
// way round and tilts it. Turning it off eases back to the normal north-up view.
// Two-finger twist (phones), right-drag / Shift+drag and Q / E (desktop) turn it any time.
const orbitBtn = document.getElementById('orbit');
function setOrbit(on) {
  controls.orbit = on;
  orbitBtn.classList.toggle('on', on);
  orbitBtn.setAttribute('aria-pressed', String(on));
  orbitBtn.setAttribute('aria-label', on ? 'Leave 360° view and reset the camera' : '360° view: drag to look around');
  if (!on) controls.resetView();
}
orbitBtn.addEventListener('click', e => { e.stopPropagation(); setOrbit(!controls.orbit); });
const rotKeys = new Set();
window.addEventListener('keydown', e => {
  if (e.target.closest?.('input, button, textarea, select') || seq.active) return;
  if (e.code === 'KeyQ' || e.code === 'KeyE') { rotKeys.add(e.code); e.preventDefault(); }
});
window.addEventListener('keyup', e => rotKeys.delete(e.code));
window.addEventListener('blur', () => rotKeys.clear());
let shownYaw = NaN;
function updateOrbit(dt) {
  if (rotKeys.size) controls.rotateBy(((rotKeys.has('KeyQ') ? 1 : 0) - (rotKeys.has('KeyE') ? 1 : 0)) * dt * 1.4);
  ocean.uniforms.uViewDir.value.set(-Math.sin(controls.yaw), -Math.cos(controls.yaw));
  const deg = Math.round(THREE.MathUtils.radToDeg(controls.yaw));
  if (deg !== shownYaw) { shownYaw = deg; orbitBtn.style.setProperty('--yaw', deg + 'deg'); }
}

// --- slow drift when idle: the view floats in a lazy circle -----------------
let idle = 0, interacting = false, driftT = 0;
const anchor = new THREE.Vector2();
controls.onStart = () => { interacting = true; idle = 0; };
controls.onEnd = () => { interacting = false; idle = 0; };
function drift(dt) {
  if (interacting || follow || seq.active) { idle = 0; return; }
  if (idle === 0) { driftT = 0; anchor.set(controls.center.x, controls.center.z); }
  idle += dt;
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
  smoke.setScale(H * pixelRatio, camera.fov);
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
  min: Math.min(1, maxDpr), max: maxDpr, start: maxDpr, enabled: params.get('quality') !== 'fixed',
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
  if (state.mode !== 'manual') {
    if (state.mode === 'cycle') state.tod = (state.tod + dt * HOUR_CYCLE_RATE) % 5;
    else state.tod = todFromClock();
    ocean.setTimeOfDay(state.tod);
    applyLook();
    if ((todLabelAt -= dt) <= 0) { todLabelAt = 1; showTod(); if (state.mode === 'cycle') saveTod(); }
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
  followBoat(dt);
  controls.update(dt);
  updateOrbit(dt);
  ocean.update(dt, elapsed);
  seq.update(dt, performance.now());
  letter.update();
  boat.update(dt, elapsed);
  if (marker.show && !boat.target) marker.hide();   // arrived
  marker.update(dt, elapsed);
  smoke.setLight(ocean.light);
  smoke.update(dt, { funnel: boat.frozen ? null : boat.funnelWorld(funnelPos), heading: boat.heading, speed01: boat.throttle01 });
  ambience.setEngine(boat.throttle01);
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
window.oceanApp = { THREE, scene, camera, controls, renderer, ocean, boat, marker, smoke, seq, letter, particles, post, ambience, quality };
