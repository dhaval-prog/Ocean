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
- **360° view**: tap the **360°** button and drag to turn the view all the way round and tilt it; tap it again to ease back to the normal north-up view (its compass needle shows which way is north). Any time: twist two fingers on phones, right-drag / Shift+drag or Q / E on desktop.
- **Cartoon water**: big flat colour shapes, chunky white foam with ink outlines, little 4-point star twinkles and flat cloud shadows drifting across. Time of day (Dawn, Day, Sunset, Dusk, Night), sea state, foam amount, twinkle amount (Glitter) and reef shallows.
- **Light on the water**: a sun path (gold at sunset, silver moonlight at night) of cartoon glints running from the viewer toward the sun in the north-north-east, so it shifts as the 360° view turns; the water deepens toward the far side of the view; the boat casts a soft shadow.
- **Sea state colour**: storms turn the sea and sky grey-green and darker, dim the sun path and whip up foam. Night foam is kept quiet so the sea reads moonlit.
- **Ocean colour** (Account settings): Deep Ocean (default), Tropical, Nordic or Pastel, applied on top of every time of day and remembered. Defined in `src/ocean/palettes.js` (`STYLES`).
- **Time of day**: **Real time** by default (follows the device clock: dawn ~6:30, day 8:30–16:30, sunset ~18:30, dusk ~19:45, night from 21:00), or a **1-hour cycle** (dawn → night → dawn every hour), or **Manual** (picking a time or dragging the slider). The choice is remembered. Mapping in `src/core/Clock.js`.
- **Tugboat**: a cel-shaded, outlined tugboat rides the waves (rising, falling, pitching and rolling with the actual water surface, still or moving); its windows glow at night. Model: `public/models/tugboat.glb`.
  - **Steer**: tap the water to sail there, or press on the boat and drag to steer it with your finger (it carries on to where you let go). Desktop: arrow keys / WASD to drive, Space for the horn.
  - **Tap the boat** and it sinks; a sheet of paper flies up out of the water and comes onto the screen. Drag and flick the paper back into the sea (or press Esc) and the boat bobs back up. The paper is a letter: tap it to write (handwriting font, placeholder "Write something for your loved one"), with camera / voice / reminder / inbox buttons along the bottom (placeholders for now). The plain "Drag and flick back into the sea" guide under it disappears once you write something, and your words fly away with the paper.
  - **Who it's for**: while the paper is up, a row of people appears at the top: Notifications, Add Status, you in the middle, and the friends in the ocean to the right, dimmed. Swipe left / right anywhere outside the paper (or tap an avatar, or use ← / →) to choose who you are writing to. People are demo data in `src/social/people.js` until chat has a backend.
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
- **Phones**: the same quality as desktop (up to 2x pixel ratio, 4x MSAA, full-resolution bloom, same water detail and particles). The pixel ratio only steps down (never below 1x) if the GPU is actually too slow; a screen capped at 30 fps (battery saver) keeps full sharpness.

URL options: `?tod=0..4` starts at a fixed time of day (0 Dawn … 4 Night, manual mode), `?quality=fixed` turns off automatic quality.

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
  core/TopDownControls.js tilted pan / zoom / 360° turn camera (pitch, default 60°)
  core/Clock.js      real clock → time of day
  boat/Boat.js       tugboat: load + merge by colour, toon shading, outline, tap-to-sail, feeds the wake
  boat/Marker.js     destination flag buoy + pulsing rings
  boat/Smoke.js      funnel smoke puffs (one batch)
  boat/SinkSequence.js tap boat → sink → paper flies onto the screen → flick back → boat returns
  social/Letter.js   writing overlay on the paper + people row (choose who the letter is for)
  social/people.js   demo people (you + friends in the ocean)
  ui/controls.js     settings panel
public/models/       tugboat.glb / .mtl, plus the original stylized-ocean.glb / .mtl exports
```

`ocean.getHeightAt(x, z)` returns the live water height, `ocean.addRipple(x, z)` makes a splash, `ocean.setBoat(x, z, heading, speed01)` draws a boat wake, and `ocean.setObjects([{ x, z, radius }])` draws foam rings around up to 4 floating objects (boats, players).
For console access, `window.oceanApp` exposes `{ scene, camera, ocean, ... }`.
