import * as THREE from 'three';
import { Ocean } from './ocean/Ocean.js';
import { Particles } from './fx/Particles.js';
import { WindStreaks } from './fx/WindStreaks.js';
import { Post } from './fx/Post.js';
import { Ambience } from './audio/Ambience.js';
import { AutoQuality } from './core/AutoQuality.js';
import { TopDownControls } from './core/TopDownControls.js';
import { todFromClock, clockLabel, CYCLE_RATE, cycleWeather } from './core/Clock.js';
import { Boat } from './boat/Boat.js';
import { Marker } from './boat/Marker.js';
import { Smoke } from './boat/Smoke.js';
import { SinkSequence } from './boat/SinkSequence.js';
import { Letter } from './social/Letter.js';
import { createControls } from './ui/controls.js';
import { Weather, PRESETS } from './weather/Weather.js';
import { Rain } from './weather/Rain.js';
import { Spray } from './weather/Spray.js';
import { Lightning } from './weather/Lightning.js';
import { Hail } from './weather/Hail.js';
import { Waterspout } from './weather/Waterspout.js';
import { Clouds } from './weather/Clouds.js';
import './styles.css';

const app = document.getElementById('app');
const isTouch = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

// --- renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
// Same sharpness on phones as on desktop: up to 2x (a 3x phone screen gains
// almost nothing visible above 2x, but would cost over twice the pixels).
// Graphics setting: 'high' (default) or 'saver' (battery saver: lower 3D resolution, no MSAA,
// 30 fps while nothing moves fast). The letter, buttons and circles are HTML, so they stay sharp.
let hqGraphics = (() => { try { return localStorage.getItem('ocean.graphics') !== 'saver'; } catch { return true; } })();
const SAVER_DPR = 1.25;
const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
let pixelRatio = hqGraphics ? maxDpr : Math.min(maxDpr, SAVER_DPR);
let calmSince = 0, stillFrameAt = 0, needFrame = false, ringsAt = 0;   // battery saver's still picture (see the loop)
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
const rain = new Rain();
const spray = new Spray();
scene.add(ocean.mesh, particles.points, streaks.mesh, rain.points, spray.points);
const weather = new Weather();
const lightning = new Lightning();
const hail = new Hail();
const spout = new Waterspout();
const clouds = new Clouds();
scene.add(clouds.mesh);
const sparkles = new Spray('#fff2b8', 1.3);          // magic sparkles (rainbow, sunbeams)
scene.add(lightning.group, hail.points, spout.mesh, sparkles.points);
// lightning lights up the sky behind the sea too
const flashEl = document.createElement('div'); flashEl.className = 'flash'; flashEl.setAttribute('aria-hidden', 'true');

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
  getWind: () => ({ dir: weather.windDir, strength: weather.cur.wind }),   // the paper drifts with the wind
  onDrip: p => spray.drip(p),                                                // water dripping off the wet paper
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
post.setUninked(seq.paper);   // no ink outlines on the letter paper
const ambience = new Ambience();
letter.audio = ambience;                                  // writing sounds, plops, mood music
seq.planeTarget = () => letter.targetPoint();             // the paper plane flies into the chosen contact's circle
seq.onSent = kind => letter.caught(kind);                 // …which catches it with a splash
seq.onSplash = p => { spray.burst(p.x, p.z, ocean.base, 36, 0.9); ambience.plop(5); };   // the bottle hits the sea

const root = document.documentElement;
const glintColor = new THREE.Color();
const stormGrey = new THREE.Color('#7d8a8c'), cloudGrey = new THREE.Color('#aab4ba'), fogWhite = new THREE.Color('#dde4e8');
const skyNow = new THREE.Color(), skyTopNow = new THREE.Color(), fogNow = new THREE.Color(), seaNow = new THREE.Color();
const themeMeta = document.querySelector('meta[name="theme-color"]');
const cssCache = {};
const setCss = (k, v) => { if (cssCache[k] !== v) { cssCache[k] = v; k.startsWith('--') ? root.style.setProperty(k, v) : (root.dataset.dark = v); } };
// Sky, fog colour and lights from the time of day + weather. Cheap enough to
// run every frame (CSS is only touched when a colour actually changes).
function applyLook() {
  const W = weather.cur;
  const g = ocean.storm * ocean.storm * 0.55;                       // storms grey the sky to match the sea
  skyNow.copy(ocean.skyColor).lerp(stormGrey, g).lerp(cloudGrey, W.clouds * 0.3);
  skyTopNow.copy(ocean.skyTopColor).lerp(stormGrey, g * 1.1).lerp(cloudGrey, W.clouds * 0.35);
  fogNow.copy(ocean.fogTint).multiplyScalar(0.35 + 0.65 * ocean.light).lerp(skyNow, 0.25);   // fog glows with the light: peach dawn, gold sunset, blue-silver night
  skyNow.lerp(fogNow, W.fog * 0.6); skyTopNow.lerp(fogNow, W.fog * 0.7);
  ocean.uniforms.uFogCol.value.copy(fogNow);
  setCss('--sky', '#' + skyNow.getHexString());
  setCss('--sky-top', '#' + skyTopNow.getHexString());
  setCss('dark', ocean.light < 0.6 ? '1' : '0');
  const dim = 1 - W.clouds * 0.22 - W.rain * 0.08;
  for (const l of lights) l.intensity = l.userData.base * (ocean.light * dim + weather.flash * 0.4);
  const theme = '#' + ocean.uniforms.uPalB.value[1].getHexString();
  if (cssCache.theme !== theme) { cssCache.theme = theme; themeMeta?.setAttribute('content', theme); }
  // the page background (shown only in any strip the sea doesn't reach) follows the sea's
  // current look: the near-water colour, greyed by storms / clouds / fog like the sky
  seaNow.copy(ocean.uniforms.uPalB.value[1]).lerp(ocean.uniforms.uPalB.value[2], 0.4).lerp(stormGrey, g * 1.2).lerp(cloudGrey, W.clouds * 0.4).lerp(fogNow, W.fog * 0.6);
  setCss('--sea', '#' + seaNow.getHexString());
}

// --- UI -----------------------------------------------------------------------
// Time of day: 'realtime' (default, follows the device clock), 'cycle' (a full
// day every hour) or 'manual' (a time the user picked). The choice is remembered.
const MODE_KEY = 'ocean.todMode', TOD_KEY = 'ocean.tod';
const state = { mode: 'realtime', tod: todFromClock(), style: 'deep' };
try {
  const st = localStorage.getItem('ocean.style');
  if (['deep', 'tropical', 'nordic', 'pastel'].includes(st)) state.style = st;
  const m = localStorage.getItem(MODE_KEY);
  if (m === 'cycle' || m === 'manual') state.mode = m;
  const t = parseFloat(localStorage.getItem(TOD_KEY));
  if (state.mode !== 'realtime' && Number.isFinite(t)) state.tod = t;
} catch {}
if (params.has('tod')) { state.tod = +params.get('tod'); state.mode = 'manual'; } // e.g. ?tod=4 for night
// Weather: 'auto' (default, changes by itself), 'local' (real weather near you)
// or 'manual' (a preset, fine-tuned with the sliders). Remembered.
const WX_KEY = 'ocean.weather';
try {
  const w = JSON.parse(localStorage.getItem(WX_KEY) || 'null');
  if (w?.mode === 'manual') {
    if (PRESETS[w.preset]) weather.setPreset(w.preset);
    else if (w.custom) { weather.setPreset('clear'); Object.assign(weather.target, w.custom); weather.preset = 'custom'; weather.name = 'Custom'; }
  } else if (w?.mode === 'local') weather.setMode('local');
  else if (w?.mode === 'cycle' || (!w && state.mode === 'cycle')) weather.mode = 'cycle';
} catch {}
if (weather.mode === 'cycle' && state.mode !== 'cycle') weather.mode = 'auto';
if (weather.mode === 'cycle') { weather.setMode('cycle'); weather.followCycle(cycleWeather(state.tod)); }
if (params.has('weather') && PRESETS[params.get('weather')]) weather.setPreset(params.get('weather')); // e.g. ?weather=storm
if (weather.mode === 'auto') weather.setMode('auto');
Object.assign(weather.cur, weather.target);                      // start in the chosen weather, no glide
const saveWeather = () => {
  try { localStorage.setItem(WX_KEY, JSON.stringify({ mode: weather.mode, preset: weather.preset, custom: weather.preset === 'custom' ? Object.fromEntries(['storm', 'foam', 'clouds', 'rain', 'fog', 'thunder', 'wind'].map(k => [k, +weather.target[k].toFixed(3)])) : null })); } catch {}
};
// A strike: a bolt comes down into the sea. Close ones land in view (never on
// the boat), distant ones far off toward the top of the screen. The water
// lights up most around the hit, rings spread from it and spray flies up.
weather.onThunder = (delay, strength, near) => {
  ambience.thunder(delay, strength, near);
  // (a bolt rises up the screen from where it hits, so close hits land in the
  // lower / middle part of the view to keep most of the bolt on screen)
  let x, z;
  const sc = near ? clouds.stormCloudNear(camera.position.x, camera.position.z - (camera.position.y - 6) / Math.tan(THREE.MathUtils.degToRad(controls.pitch))) : null;
  if (sc) {
    // straight down out of a storm cloud: hit the sea just below it (a little toward the viewer so the bolt shows)
    x = sc.x + (Math.random() - 0.5) * sc.r * 0.6; z = sc.z + 1 + Math.random() * 3;
  } else if (near) {
    const halfW = controls.worldPerPixel() * app.clientWidth / 2;        // visible half-width (narrow on phones)
    x = controls.center.x + (Math.random() - 0.5) * 1.5 * halfW; z = controls.center.z - 2 + Math.random() * 10;
  }
  else { const a = (Math.random() - 0.5) * 1.6; x = controls.center.x + Math.sin(a) * 50; z = controls.center.z - Math.cos(a) * (35 + Math.random() * 35); }
  const bx = boat.position.x, bz = boat.position.y, d = Math.hypot(x - bx, z - bz);
  if (d < 5) { const k = 5 / Math.max(d, 0.01); x = bx + (x - bx) * k; z = bz + (z - bz) * k; }   // never on the boat
  ocean.uniforms.uFlashPos.value.set(x, z);
  lightning.strike(x, ocean.base, z, near, near ? clouds.boltSource(x, z) : null);   // out of the storm cloud above
  if (near) {
    ocean.addRipple(x, z, 1); setTimeout(() => ocean.addRipple(x + 0.3, z - 0.2, 0.8), 180);
    spray.burst(x, z, ocean.base, 45, 1.1);
    // close to the boat: it jolts, rocks hard and its lights flicker
    const db = Math.hypot(x - boat.position.x, z - boat.position.y);
    if (db < 14 && boat.ready && !boat.frozen) boat.jolt(x, z, THREE.MathUtils.clamp(1.3 - db / 14, 0.35, 1));
  }
};

// --- weather moments -----------------------------------------------------------
// Sunbeams: patches of sunlight breaking through gaps in the clouds (cloudy
// days, clearing showers, and sunset light breaking into a storm). Sail into
// one and the water glows gold round the boat.
const beams = [null, null, null];
let beamTimer = 4, beamChimeAt = 0, boatGlow = 0;
function spawnBeam(big = false) {
  const slot = beams.findIndex(b => !b); if (slot < 0) return;
  const halfW = controls.worldPerPixel() * app.clientWidth / 2;
  const wd = weather.windDir;
  if (big) {   // the sun breaking through after a shower: a big patch sweeping across the view
    beams[slot] = { x: controls.center.x - wd[0] * 22, z: controls.center.z - wd[1] * 22, r: 13, vx: wd[0] * 1.3, vz: wd[1] * 1.3, age: 0, life: 32 };
  } else {
    beams[slot] = { x: controls.center.x + (Math.random() - 0.5) * 2 * halfW, z: controls.center.z - 6 + Math.random() * 14, r: 4 + Math.random() * 5,
      vx: wd[0] * (0.3 + weather.cur.wind * 0.8), vz: wd[1] * (0.3 + weather.cur.wind * 0.8), age: 0, life: 20 + Math.random() * 20 };
  }
}
weather.onSunbreak = () => { if (ocean.light > 0.45) spawnBeam(true); };
function updateBeams(dt) {
  const W = weather.cur, U = ocean.uniforms.uBeams.value;
  const sky = W.clouds > 0.35 && ocean.light > 0.45 && W.fog < 0.5;
  const rate = W.thunder > 0.3 ? (ocean.light < 0.9 ? 0.06 : 0.02) : 0.07;   // storms: mostly sunset light breaking through
  if (sky && (beamTimer -= dt) <= 0) { beamTimer = 1 / rate * (0.6 + Math.random() * 0.8); spawnBeam(); }
  let inBeam = 0;
  beams.forEach((b, i) => {
    if (!b) { U[i].w = 0; return; }
    b.age += dt; b.x += b.vx * dt; b.z += b.vz * dt;
    if (b.age > b.life) { beams[i] = null; U[i].w = 0; return; }
    if (!sky && b.r < 10) b.life = Math.min(b.life, b.age + 4);        // clouds closed / night fell: fade out
    const fade = Math.max(0, Math.min(1, b.age / 4, (b.life - b.age) / 4));
    U[i].set(b.x, b.z, b.r, fade);
    if (boat.ready && Math.hypot(boat.position.x - b.x, boat.position.y - b.z) < b.r * 0.7) inBeam = Math.max(inBeam, fade);
  });
  boatGlow += (inBeam - boatGlow) * Math.min(1, dt * 1.5);
  ocean.uniforms.uBoatGlow.value = boatGlow;
  if (inBeam > 0.6 && elapsed > beamChimeAt) {          // sailed into the sunlight
    beamChimeAt = elapsed + 12; ambience.chime('sun');
    sparkles.burst(boat.position.x, boat.position.y, ocean.base + 0.3, 24, 0.6);
  }
}

// Rainbow: anchored in the world where it appears; sail under its arc for a sparkle and a chime.
let bowAnchored = false, bowChimeAt = 0;
function updateRainbow() {
  const U = ocean.uniforms;
  if (U.uRainbow.value > 0.01 && !bowAnchored) {
    const camH = Math.max(camera.position.y - ocean.base, 1);
    U.uRainbowPos.value.set(camera.position.x, camera.position.z - 0.15 * camH);   // where the view-relative arc used to sit
    U.uRainbowS.value = camH;
    bowAnchored = true;
  } else if (U.uRainbow.value <= 0.005 && weather.rainbow < 0.01) bowAnchored = false;
  if (!bowAnchored || !boat.ready || U.uRainbow.value < 0.25) return;
  const S = U.uRainbowS.value, bx = boat.position.x - U.uRainbowPos.value.x, bz = boat.position.y - U.uRainbowPos.value.y;
  const r = Math.hypot(bx, bz) / S, al = -bz / S;
  if (r > 0.93 && r < 1.12 && al > -0.1 && elapsed > bowChimeAt) {
    bowChimeAt = elapsed + 6; ambience.chime('rainbow');
    sparkles.burst(boat.position.x, boat.position.y, ocean.base + 0.6, 50, 1.0);
  }
}

// Waterspout: rare in a thunderstorm, far off, drifting slowly across.
let spoutCheck = 25, spoutDrop = 0;
function updateSpout(dt) {
  const W = weather.cur;
  if (!spout.active && W.thunder > 0.5 && (spoutCheck -= dt) <= 0) {
    spoutCheck = 60 + Math.random() * 60;
    if (Math.random() < 0.4) spawnSpout();
  }
  const base = spout.update(dt, elapsed, { light: ocean.light, tint: ocean.fogTint });
  if (base && (spoutDrop -= dt) <= 0) {              // a whirl of spray and rings where it touches the sea
    spoutDrop = 0.25;
    ocean.addRipple(base.x + (Math.random() - 0.5), base.y + (Math.random() - 0.5), 0.8);
    spray.burst(base.x, base.y, ocean.base, 6, 0.8);
  }
}
function spawnSpout() {
  // far off, near the top of the view (how far that is depends on the screen shape)
  const side = Math.random() < 0.5 ? -1 : 1, camH = Math.max(camera.position.y - ocean.base, 1);
  const dTop = camH / Math.tan(THREE.MathUtils.degToRad(controls.pitch - camera.fov / 2));
  const halfW = controls.worldPerPixel() * app.clientWidth / 2;
  spout.spawn(controls.center.x - side * halfW * (0.3 + Math.random() * 0.4), camera.position.z - dTop * (0.72 + Math.random() * 0.08),
    side * (0.35 + Math.random() * 0.35), 0.05, ocean.base, 40 + Math.random() * 20);
}

// Foghorn: in fog the boat sounds it now and then (and the horn key gives a foghorn)
let foghornIn = 6;
const saveTod = () => { try { localStorage.setItem(MODE_KEY, state.mode); localStorage.setItem(TOD_KEY, String(state.tod % 5)); } catch {} };
let todLabelAt = 0;
function showTod() {
  const name = state.mode === 'realtime' ? `${ocean.timeName} · ${clockLabel()}` : ocean.timeName;
  ui.setTimeOfDay(ocean.timeOfDay, name);
}
const ui = createControls(document.getElementById('panel'), {
  initial: { tod: state.tod, mode: state.mode, style: state.style, storm: weather.cur.storm, foam: weather.cur.foam, clouds: weather.cur.clouds, glitter: ocean.glitter, reef: ocean.reef, graphics: hqGraphics },
  onTimeOfDay: v => { state.tod = v; state.mode = 'manual'; if (weather.mode === 'cycle') weather.setMode('auto'); ocean.setTimeOfDay(v); applyLook(); saveTod(); },
  onMode: m => {
    state.mode = m;
    if (m === 'realtime') state.tod = todFromClock();
    // the 2-hour cycle brings its own weather (each time of day: clear, cloudy, rain, storm, fog in turn)
    if (m === 'cycle') weather.setMode('cycle');
    else if (weather.mode === 'cycle') weather.setMode('auto');
    ocean.setTimeOfDay(state.tod); applyLook(); showTod(); saveTod();
  },
  onStyle: id => {
    state.style = id; ocean.setStyle(id); applyLook();
    try { localStorage.setItem('ocean.style', id); } catch {}
  },
  onWeatherMode: m => weather.setMode(m),
  onPreset: id => weather.setPreset(id),
  onStorm: v => weather.tweak('storm', v),
  onFoam: v => weather.tweak('foam', v),
  onClouds: v => weather.tweak('clouds', v),
  onGlitter: v => { ocean.glitter = v; },
  onReef: v => { ocean.reef = v; },
  onGraphics: hq => setGraphics(hq),
});
ocean.style = state.style;
ocean.setTimeOfDay(state.tod);
showTod();
weather.onChange = () => { ui.setWeather(weather); saveWeather(); };
ui.setWeather(weather);
app.appendChild(flashEl);

// Account button (next to sound) opens / closes the settings. A tap outside
// the panel or Esc closes it.
const accountBtn = document.getElementById('account'), panelEl = document.getElementById('panel');
ui.onOpenChange(open => accountBtn.setAttribute('aria-expanded', String(open)));
accountBtn.addEventListener('click', e => { e.stopPropagation(); ui.setOpen(!ui.open); });
window.addEventListener('pointerdown', e => {
  if (ui.open && !panelEl.contains(e.target) && !accountBtn.contains(e.target)) ui.setOpen(false);
}, { capture: true });
window.addEventListener('keydown', e => { if (e.code === 'Escape' && ui.open) { ui.setOpen(false); accountBtn.focus(); } });
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
  if (weather.cur.fog > 0.5) ambience.foghorn(); else ambience.horn();
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
  if (e.isPrimary && e.button === 0) down = { x: e.clientX, y: e.clientY, t: performance.now() };
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
  needFrame = true;                                     // a new size (rotation, the keyboard): redraw the still picture
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(W, H, false);
  post.setSize(W, H, pixelRatio);
  streaks.setSize(W * pixelRatio, H * pixelRatio);
  smoke.setScale(H * pixelRatio, camera.fov);
  spray.setScale(H * pixelRatio, camera.fov);
  sparkles.setScale(H * pixelRatio, camera.fov);
}
function resize() {
  const cv = renderer.domElement;                 // the canvas can be taller than #app (it reaches under the toolbar)
  W = cv.clientWidth || app.clientWidth || 1; H = cv.clientHeight || app.clientHeight || 1;
  camera.aspect = W / H;
  camera.fov = W < H ? 62 : 40; // portrait phones need a wider view to see enough sea
  camera.updateProjectionMatrix();
  applySize();
}
const ro = new ResizeObserver(resize); ro.observe(app); ro.observe(renderer.domElement);
resize();

const quality = new AutoQuality({
  min: Math.min(1, maxDpr), max: maxDpr, start: pixelRatio, enabled: params.get('quality') !== 'fixed',
  onChange: v => { pixelRatio = v; applySize(); },
});
function setGraphics(hq) {
  hqGraphics = hq;
  try { localStorage.setItem('ocean.graphics', hq ? 'high' : 'saver'); } catch {}
  post.setSamples(hq ? 4 : 0);                                    // edge smoothing (MSAA) only in high quality
  quality.max = hq ? maxDpr : Math.min(maxDpr, SAVER_DPR);        // battery saver: a fixed, lower 3D resolution
  quality.enabled = hq && params.get('quality') !== 'fixed';
  quality.capped = false; quality.set(quality.max);
  letter.ringInterval = hq ? 0 : 0.1;                             // friends' water rings at ~10 fps in battery saver
  needFrame = true;
}
setGraphics(hqGraphics);
// battery saver: 30 fps while nothing moves fast (calm sea, writing, reading); 60 while a finger
// is down or anything is flying, folding, sinking or sailing
let fingers = 0, touchedAt = 0;
addEventListener('pointerdown', () => { fingers++; touchedAt = performance.now(); }, true);
addEventListener('pointerup', () => { fingers = Math.max(0, fingers - 1); touchedAt = performance.now(); }, true);
addEventListener('pointercancel', () => { fingers = Math.max(0, fingers - 1); }, true);
const calm = now => fingers === 0 && now - touchedAt > 600 && !controls.dragging && !boat.target
  && (seq.mode === 'idle' || seq.mode === 'card' || (seq.mode === 'shaping' && seq._shapeTarget == null));
let lastFrameAt = 0;
// battery saver, writing or reading the letter: the scene is drawn once and then holds still as a
// picture (no 3D rendering at all); only the friends row keeps moving, at ~10 fps. Nothing done on the
// letter wakes it; it comes back to life when the letter is folded, rolled, sent or closed. (A single
// frame is redrawn only if the paper itself changes or the screen size changes, e.g. the keyboard.)
const paintPaper = seq.paint.bind(seq);
seq.paint = (...a) => { needFrame = true; return paintPaper(...a); };   // the paper changed: draw it

// --- loop -----------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document); // pauses cleanly while the tab is hidden
let elapsed = 0, glowTimer = 0, dropTimer = 1, wxSyncAt = 0, ringColAt = 0;
const ringTmp = new THREE.Color();
const lookWx = { glints: 0, petals: 0, specks: 0 }, windVec = [0, 0], bowPos = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const nowMs = performance.now(), isCalm = calm(nowMs);
  // battery saver, letter open and flat: the sea stays frozen whatever you do on the letter (typing,
  // tapping, stickers, drawing, voice, choosing a friend); only folding / rolling / sending wakes it
  const still = !hqGraphics && seq.mode === 'card' && letter.visible;
  calmSince = still ? (calmSince || nowMs) : 0;
  if (still && nowMs - calmSince > 500) {
    if (!needFrame) {
      if (nowMs - ringsAt >= 100) { letter.update(Math.min(0.25, (nowMs - (ringsAt || nowMs)) / 1000)); ringsAt = nowMs; }
      timer.update();                                    // time keeps moving, so nothing jumps when it wakes up
      return;
    }
    needFrame = false; stillFrameAt = nowMs;            // the paper or the screen size changed: one frame, then still again
  } else if (!hqGraphics && isCalm && nowMs - lastFrameAt < 1000 / 30 - 3) return;   // battery saver: 30 fps while calm
  lastFrameAt = nowMs;
  lastFrameAt = nowMs;
  timer.update();
  const dt = Math.min(0.1, timer.getDelta());
  elapsed += dt;
  if (state.mode !== 'manual') {
    if (state.mode === 'cycle') state.tod = (state.tod + dt * CYCLE_RATE) % 5;
    else state.tod = todFromClock();
    ocean.setTimeOfDay(state.tod);
    if ((todLabelAt -= dt) <= 0) { todLabelAt = 1; showTod(); if (state.mode === 'cycle') saveTod(); }
  }
  if (weather.mode === 'cycle') weather.followCycle(cycleWeather(state.tod));   // 2-hour cycle: weather in step with the time of day
  weather.update(dt);
  ocean.setWeather(weather, dt);
  applyLook();
  flashEl.style.opacity = weather.flash > 0.01 ? (weather.flash * 0.16).toFixed(3) : '0';
  if (weather.flash > 0.01) { const fc = ocean.uniforms.uFlashCol.value, m = Math.max(fc.r, fc.g, fc.b, 0.001); flashEl.style.background = `rgb(${[fc.r, fc.g, fc.b].map(v => Math.round(255 * Math.min(1, 0.35 + 0.65 * v / m))).join(',')})`; }
  if ((wxSyncAt -= dt) <= 0) { wxSyncAt = 0.5; ui.setWeatherValues(weather.cur); }
  const W = weather.cur;
  // ambient particles: no petals or rising glints in the rain
  const L = ocean.look;
  lookWx.glints = L.glints * (1 - W.rain * 0.8); lookWx.petals = L.petals * (1 - W.rain); lookWx.specks = L.specks * (1 - W.rain);

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
  ocean.update(dt, elapsed);
  seq.update(dt, performance.now());
  // the avatars' water rings take the sea's colours for the time of day (blended like the sea)
  if ((ringColAt -= dt) <= 0 && letter.visible) {
    ringColAt = 0.25;
    letter.setLook({ tod: ocean.timeOfDay, rain: W.rain, light: ocean.light });   // stationery + ink follow the time and weather
    letter.circles.myPrecip = W.rain > 0.3 ? 'rain' : null;                       // my own circle shows my weather
    const U = ocean.uniforms, k = U.uMix.value, rgb = i => { const c = ringTmp.copy(U.uPalA.value[i]).lerp(U.uPalB.value[i], k); return c.getHexString().match(/../g).map(h => parseInt(h, 16)); };
    letter.water.setColors(rgb(4), rgb(3), rgb(1), rgb(5));   // bright, shallow, deep, foam
  }
  letter.update(dt);
  boat.update(dt, elapsed);
  if (marker.show && !boat.target) marker.hide();   // arrived
  marker.update(dt, elapsed);
  smoke.setLight(ocean.light);
  const ws = 0.3 + W.wind * 1.6;
  windVec[0] = weather.windDir[0] * ws; windVec[1] = weather.windDir[1] * ws;
  smoke.update(dt, { funnel: boat.frozen ? null : boat.funnelWorld(funnelPos), heading: boat.heading, speed01: boat.throttle01, wind: windVec });
  // sea spray off the bow in rough water
  const live = boat.ready && !boat.frozen && boat.group.visible;
  if (live) bowPos.set(boat.position.x + Math.cos(boat.heading) * 2.2, 0, boat.position.y - Math.sin(boat.heading) * 2.2);
  lightning.setColor(ocean.uniforms.uFlashCol.value);
  lightning.update(camera, Math.min(1, weather.flash / 0.6));
  spray.setLight(ocean.light, ocean.uniforms.uRainCol.value);
  sparkles.update(dt, { bow: null, heading: 0, speed01: 0, rough: 0, water: ocean.base });
  hail.update(elapsed, { center: controls.center, hail: weather.hail, windDir: weather.windDir, wind: W.wind, pixelRatio, light: ocean.light });
  updateBeams(dt); updateRainbow(); updateSpout(dt);
  clouds.update(dt, { center: controls.center, halfW: controls.worldPerPixel() * renderer.domElement.clientWidth / 2, cover: W.clouds, storm: W.thunder, fog: W.fog,
    windDir: weather.windDir, wind: W.wind, light: ocean.light, sky: skyNow, camera, pitch: controls.pitch,
    boat: boat.ready && boat.group.visible ? { x: boat.position.x, y: ocean.base + 0.8, z: boat.position.y } : null });
  clouds.shadows(ocean.uniforms.uCloudBlobs.value);
  // the boat in the weather: wind, window lights, searchlight, foghorn
  boat.setWind(weather.windDir, W.wind);
  const gloom = Math.max(W.fog, W.thunder, W.rain * W.clouds * 0.8);
  boat.setSearchlight(Math.max(W.fog, W.thunder) > 0.4 ? 1 : 0);
  if (boat.spot) ocean.uniforms.uSpot.value.set(boat.spot.x, boat.spot.z, boat.spot.r, boat.ready && !boat.frozen ? boat.spot.i * (1 - Math.min(1, ocean.light) * 0.6) : 0);   // stands out more the darker it is
  if (W.fog > 0.55 && live && (foghornIn -= dt) <= 0) { foghornIn = 28 + Math.random() * 20; ambience.foghorn(); }
  spray.update(dt, { bow: live ? bowPos : null, heading: boat.heading, speed01: Math.max(0, boat.speed) / boat.maxSpeed, rough: ocean.storm, water: ocean.base });
  rain.update(elapsed, { center: controls.center, rain: W.rain, wind: W.wind, windDir: weather.windDir, pixelRatio, light: ocean.light, tint: ocean.uniforms.uRainCol.value });
  ambience.setEngine(boat.throttle01);
  boat.setNight(Math.max(L.night, gloom * 0.9));      // windows light up at night and in storms / fog
  glintColor.copy(ocean.uniforms.uPalB.value[5]).lerp(ocean.uniforms.uPalA.value[8], 0.5);
  particles.update(elapsed, { center: controls.center, look: lookWx, storm: ocean.storm, pixelRatio, glintColor });
  streaks.update(elapsed, ocean.storm, ocean.light, weather.windDir, W.wind, (1 - W.rain * 0.9) * (1 - W.fog * 0.85));   // anime wind lines give way to rain and fog
  post.update(L.night, ocean.storm);
  ambience.update(ocean.storm, L.night, W.rain, W.wind, weather.hail);

  post.render(dt);
  quality.tick(dt);
});

// Exposed for upcoming game / chat layers and for debugging in the console.
window.oceanApp = { pace: () => ({ fingers, sinceTouch: Math.round(performance.now() - touchedAt), dragging: controls.dragging, sailing: !!boat.target, mode: seq.mode, calm: calm(performance.now()), still: !!calmSince && performance.now() - calmSince > 500 }), THREE, scene, camera, controls, renderer, ocean, weather, rain, spray, lightning, hail, spout, sparkles, clouds, spawnSpout, spawnBeam, beams, boat, marker, smoke, seq, letter, particles, post, ambience, quality };
