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

- **Top view only**: the camera looks straight down. Drag to pan, pinch or scroll to zoom; panning glides to a stop and stays inside the ocean.
- **Cartoon water**: big flat colour shapes, chunky white foam with ink outlines, little 4-point star twinkles and flat cloud shadows drifting across. Time of day (Dawn, Day, Sunset, Dusk, Night), sea state, foam amount, twinkle amount (Glitter) and reef shallows.
- **Drops in the water**: tapping (or something dropping in on its own every few seconds) makes a realistic drop: a quick splash of droplets, then several concentric rings that spread out, fade and bend the water pattern as they pass. White by day, glowing at night; at night the sea also glows by itself in patches.
- **Ambient life**: lights drifting up off the water (dusk/night), petals on the wind (dawn/sunset), specks at night, cartoon wind lines.
- **Finishing pass**: ink outlines (edge detection), bloom on the brightest highlights, saturated colour grading and a vignette.
- **Idle drift**: after a few seconds without input the view floats slowly in a lazy circle.
- **Ambient sound**: generated waves, wind and a soft pad (no audio files). It starts on the first tap; the speaker button mutes it, and the choice is remembered.
- **Phones**: half-resolution bloom, one draw call for all particles, and the pixel ratio adjusts automatically if the frame rate drops.

URL options: `?tod=0..4` starts at a time of day (0 Dawn … 4 Night), `?quality=fixed` turns off automatic quality.

## Structure

```
src/
  main.js            renderer, camera, lights, loop
  ocean/Ocean.js     Ocean class: mesh, setTimeOfDay(), storm, reef, getHeightAt(x, z)
  ocean/shaders.js   GLSL for the water (ported from Ocean_Standalone.html)
  ocean/palettes.js  time-of-day colours + ambient particle presets
  fx/Particles.js    glints, petals, specks (one batch)
  fx/WindStreaks.js  screen-space wind lines
  fx/Post.js         bloom + ink outlines + colour grading + vignette
  audio/Ambience.js  generated waves / wind / music
  core/AutoQuality.js adaptive pixel ratio
  core/TopDownControls.js top-down pan / zoom camera
  ui/controls.js     settings panel
public/models/       original stylized-ocean.glb / .mtl exports (static, baked colours)
```

`ocean.getHeightAt(x, z)` returns the live water height, `ocean.addRipple(x, z)` makes a splash, and `ocean.setObjects([{ x, z, radius }])` draws foam rings around up to 4 floating objects (boats, players).
For console access, `window.oceanApp` exposes `{ scene, camera, ocean, ... }`.
