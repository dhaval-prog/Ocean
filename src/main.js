import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Ocean } from './ocean/Ocean.js';
import { createControls } from './ui/controls.js';
import './styles.css';

const app = document.getElementById('app');
const isTouch = matchMedia('(pointer: coarse)').matches;

// --- renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, alpha: true, powerPreference: 'high-performance' });
// The water shader is fragment-heavy, so phones render at a lower pixel ratio.
const maxDpr = isTouch ? 1.5 : 2;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
renderer.domElement.className = 'scene';
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
camera.position.set(0, 12, 18);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, -3);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 45;
controls.minPolarAngle = 0.25;
controls.maxPolarAngle = 1.32; // never dip below the surface
controls.rotateSpeed = isTouch ? 0.6 : 0.8;
controls.update();

// --- lights (scaled by time of day) ----------------------------------------
const lights = [
  [new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.0), null],
  [new THREE.DirectionalLight(0xffffff, 2.2), [4, 7, 5]],
  [new THREE.DirectionalLight(0xfff4e6, 0.5), [-5, 3, -4]],
].map(([l, p]) => { if (p) l.position.set(...p); l.userData.base = l.intensity; scene.add(l); return l; });

// --- ocean ------------------------------------------------------------------
const ocean = new Ocean({ size: 140, segments: isTouch ? 200 : 280 });
scene.add(ocean.mesh);

const root = document.documentElement;
function applyLook() {
  root.style.setProperty('--sky', '#' + ocean.skyColor.getHexString());
  root.style.setProperty('--sky-top', '#' + ocean.skyTopColor.getHexString());
  root.dataset.dark = ocean.light < 0.6 ? '1' : '0';
  for (const l of lights) l.intensity = l.userData.base * ocean.light;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#' + ocean.skyTopColor.getHexString());
}

// --- UI -----------------------------------------------------------------------
const state = { tod: 1, auto: true };
const ui = createControls(document.getElementById('panel'), {
  initial: { tod: state.tod, auto: state.auto, storm: ocean.storm, reef: ocean.reef },
  onTimeOfDay: v => { state.tod = v; state.auto = false; ocean.setTimeOfDay(v); applyLook(); },
  onAuto: v => { state.auto = v; },
  onStorm: v => { ocean.storm = v; },
  onReef: v => { ocean.reef = v; },
});
applyLook();

// --- resize & loop ------------------------------------------------------------
function resize() {
  const w = app.clientWidth || 1, h = app.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Pull the camera back a little in portrait so the ocean fills a phone.
  camera.fov = w < h ? 58 : 45;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(app);
resize();

const clock = new THREE.Clock();
let elapsed = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.1, clock.getDelta());
  elapsed += dt;
  if (state.auto) {
    state.tod += dt / 8;
    ocean.setTimeOfDay(state.tod);
    applyLook();
    ui.setTimeOfDay(ocean.timeOfDay, ocean.timeName);
  }
  ocean.update(dt, elapsed);
  controls.update();
  renderer.render(scene, camera);
});

// Exposed for upcoming game / chat layers and for debugging in the console.
window.oceanApp = { THREE, scene, camera, controls, renderer, ocean };
