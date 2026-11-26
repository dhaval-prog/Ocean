# Ocean

A mobile + desktop web app built on a stylized, shader-driven 3D ocean (three.js + Vite).
This is the foundation for an upcoming game + chat experience.

**Live:** https://ocean-world-dhaval.vercel.app (deploys automatically from `main` via Vercel)

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN for phone testing)
npm run build      # production build in dist/
```

## What's here

- **Anime sky**: painted gradient, cel-shaded cumulus (towering banks on the horizon, drifting puffs overhead), sun, crescent moon, stars, Milky Way, shooting stars, god rays through cloud gaps and a glowing horizon line. All blend through the 5 times of day.
- **Water**: stylized shader with time of day, sea state, foam amount, reef shallows, cel-shaded wave crests.
- **Touch the sea**: tapping or dragging makes ripples: white foam by day, glowing blue-green at night. At night the sea also glows by itself in patches.
- **Ambient life**: lights drifting up off the water (dusk/night), petals on the wind (dawn/sunset), snow-like specks at night, anime wind lines.
- **Finishing pass**: bloom on the brightest highlights, colour grading (saturation, warm highlights, cool shadows) and a vignette.
- **Cinematic idle**: after a few seconds without input the camera drifts slowly.
- **Ambient sound**: generated waves, wind and a soft pad (no audio files). It starts on the first tap; the speaker button mutes it, and the choice is remembered.
- **Phones**: sky drawn at low resolution, bloom at half resolution, one draw call for all particles, and the pixel ratio adjusts automatically if the frame rate drops.

URL options: `?tod=0..4` starts at a time of day (0 Dawn … 4 Night), `?quality=fixed` turns off automatic quality.

## Structure

```
src/
  main.js            renderer, camera, lights, loop
  ocean/Ocean.js     Ocean class: mesh, setTimeOfDay(), storm, reef, getHeightAt(x, z)
  ocean/shaders.js   GLSL for the water (ported from Ocean_Standalone.html)
  ocean/palettes.js  time-of-day colour + sky presets
  sky/Sky.js         sky dome rendered at low resolution behind the scene
  fx/Particles.js    glints, petals, specks (one batch)
  fx/WindStreaks.js  screen-space wind lines
  fx/Post.js         bloom + colour grading + vignette
  audio/Ambience.js  generated waves / wind / music
  core/AutoQuality.js adaptive pixel ratio
  ui/controls.js     settings panel
public/models/       original stylized-ocean.glb / .mtl exports (static, baked colours)
```

`ocean.getHeightAt(x, z)` returns the live water height, `ocean.addRipple(x, z)` makes a splash, and `ocean.setObjects([{ x, z, radius }])` draws foam rings around up to 4 floating objects (boats, players).
For console access, `window.oceanApp` exposes `{ scene, camera, ocean, ... }`.
