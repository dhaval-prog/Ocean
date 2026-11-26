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

- **Endless top view**: the camera looks straight down at a sea that goes on forever. Drag to pan (flicks glide to a stop), pinch or scroll to zoom toward your fingers or cursor, double-tap to zoom in on a spot (double-tap again when fully in to zoom back out). Past the edge of the play area the view resists and springs back.
- **Cartoon water**: 3 bold tones per time of day, crisp ink outlines, rounded foam blobs with hollow swirls, little wave marks that pop in and slide away, pop-in star twinkles and flat cloud shadows. The pattern slides with the current instead of boiling.
- **A cartoon island** with palms, sand, a shallow halo and pulsing surf.
- **Life on the sea**: schools of fish shadows, seagull shadows gliding over, and leaves drifting with the current.
- **Touch the sea**: taps make bouncy rings with splash droplets, white by day and glowing at night. At night the outlines glow and the sea pulses by itself.
- **Ambient extras**: lights drifting up off the water (dusk/night), petals (dawn/sunset), specks at night, curly cartoon wind swirls, bloom on the brightest highlights, colour grading.
- **Controls**: time of day (Dawn, Day, Sunset, Dusk, Night, or cycle), sea state, foam, twinkles (Glitter) and reef shallows, in a bubbly rounded UI (Fredoka font).
- **Ambient sound**: generated waves, wind and a soft pad (no audio files). It starts on the first tap; the speaker button mutes it, and the choice is remembered.
- **Fast on phones**: all water patterns come from one pre-baked noise texture on a single flat quad, half-resolution bloom on phones, one draw call each for particles and sea life, and the pixel ratio adjusts automatically if the frame rate drops.

URL options: `?tod=0..4` starts at a time of day (0 Dawn … 4 Night), `?quality=fixed` turns off automatic quality.

## Structure

```
src/
  main.js            renderer, camera, lights, loop
  ocean/Ocean.js     Ocean class: follow(), setTimeOfDay(), storm, foam, glitter, reef, ripples, objects, island
  ocean/shaders.js   top-down cartoon water shader
  ocean/noise.js     pre-baked tiling noise texture
  ocean/palettes.js  time-of-day colours + ambient particle presets
  fx/Particles.js    glints, petals, specks (one batch)
  fx/SeaLife.js      fish schools, gull shadows, leaves (one batch)
  fx/WindStreaks.js  curly screen-space wind swirls
  fx/Post.js         bloom + colour grading + vignette
  audio/Ambience.js  generated waves / wind / music
  core/AutoQuality.js adaptive pixel ratio
  core/TopDownControls.js top-down pan / zoom / double-tap camera
  ui/controls.js     settings panel
public/models/       original stylized-ocean.glb / .mtl exports (static, baked colours)
```

`ocean.addRipple(x, z)` makes a splash, `ocean.setObjects([{ x, z, radius }])` draws foam rings around up to 4 floating objects (boats, players), `ocean.setIsland(x, z, radius)` moves the island, and `ocean.getHeightAt(x, z)` gives a gentle bob for floating things.
For console access, `window.oceanApp` exposes `{ scene, camera, ocean, ... }`.
