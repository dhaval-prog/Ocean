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

- **Tilted view**: the camera looks down at the sea at 60° from the horizon (set with `pitch` in `main.js`; 90 = straight down). Drag to pan (the water stays under your finger), pinch or scroll to zoom; panning glides to a stop and stays inside the play area.
- **Cartoon water**: big flat colour shapes, chunky white foam with ink outlines, little 4-point star twinkles and flat cloud shadows drifting across. Time of day (Dawn, Day, Sunset, Dusk, Night), sea state, foam amount, twinkle amount (Glitter) and reef shallows.
- **Tugboat**: a cel-shaded, outlined tugboat bobs on the sea; its windows glow at night. Model: `public/models/tugboat.glb`.
  - **Steer**: tap the water to sail there, or press on the boat and drag to steer it with your finger (it carries on to where you let go). Tap the boat for the horn. Desktop: arrow keys / WASD to drive, Space for the horn.
  - **Tap the water** to sail there. A bobbing buoy with a flapping flag and pulsing rings marks the destination and disappears when the boat arrives.
  - **Wake**: a soft V of foam spreads back from the bow, with churned water behind the stern and a white splash at the bow, all growing with speed (glowing at night).
  - **Funnel smoke**: light cartoon puffs pop out of the funnel and fade quickly behind the boat; a few more when it goes fast, an occasional one when idle, a little burst with the horn.
  - **Sound**: a diesel chug that speeds up and gets louder with the throttle, and a two-note tugboat horn (muted by the speaker button like everything else).
  - **Follow mode** (target button, top right): the camera keeps the boat in view, looking a little ahead when it moves. It is on by default and whenever you send the boat somewhere; dragging the view turns it off; pinch-zoom keeps it on.
- **Drops in the water**: tapping (or something dropping in on its own every few seconds) makes a realistic drop: a quick splash of droplets, then 2–3 small, faint concentric rings (about 2 units across at most) that barely bend the water and fade within about 2 seconds. White by day, glowing at night; at night the sea also glows by itself in patches.
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
  core/TopDownControls.js tilted pan / zoom camera (pitch, default 60°)
  boat/Boat.js       tugboat: load + merge by colour, toon shading, outline, tap-to-sail, feeds the wake
  boat/Marker.js     destination flag buoy + pulsing rings
  boat/Smoke.js      funnel smoke puffs (one batch)
  ui/controls.js     settings panel
public/models/       tugboat.glb / .mtl, plus the original stylized-ocean.glb / .mtl exports
```

`ocean.getHeightAt(x, z)` returns the live water height, `ocean.addRipple(x, z)` makes a splash, `ocean.setBoat(x, z, heading, speed01)` draws a boat wake, and `ocean.setObjects([{ x, z, radius }])` draws foam rings around up to 4 floating objects (boats, players).
For console access, `window.oceanApp` exposes `{ scene, camera, ocean, ... }`.
