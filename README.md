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
- **Light on the water**: a sun path (gold at sunset, silver moonlight at night) of cartoon glints running from the viewer toward the sun in the north-north-east; the water deepens toward the far side of the view; the boat casts a soft shadow.
- **Foam**: a few big cartoon patches with clean outlines that form, drift downwind and dissolve into lace before forming again elsewhere, plus white caps that sit on the crests of the swell the boat rides and slide off the back as each crest passes. At night the boat's wake and the ripples glow cyan-blue.
- **Weather** (Account settings): **Clear, Cloudy, Rain, Storm, Fog** presets set sea state, foam, clouds, sky and sound together; the Sea state / Foam / Clouds sliders fine-tune on top (and switch to a Custom fixed weather). Modes: **Changing** (default: drifts by itself every few minutes, e.g. clear, breezy, cloudy, a rain shower, clearing up), **Near me** (real local weather from Open-Meteo, asks for location; coordinates are rounded to ~1 km; refreshes every 15 min; falls back to Changing if location is refused) and **Fixed**. Remembered. `src/weather/Weather.js`.
  - **Rain**: thin motion-blurred streaks of varied length and brightness, slanted by the wind, falling in sheets that sweep across; under them the water goes darker and pitted, with small rings of different sizes; mist cuts the visibility; rain hiss.
  - **Storm**: lightning bolts strike the sea: a jagged, forked, glowing bolt comes down from the storm into the water (never on the boat), the water lights up around the hit, rings spread and spray flies up. Each strike flickers in 2–4 strokes, brightest under the strike (close strikes crack almost at once, distant ones are dim glows with a late rumble), darker faster cloud shadows, grey-green sea, foam blown into streaks along the wind, heavy rain and mist, big waves.
  - **Fog**: the water fades into soft grey-white with distance in uneven banks that drift with the wind; the sun is a diffuse glow instead of glitter.
  - **Clouds**: thick, puffy cartoon clouds (cel-shaded puffs with ink rims, like the boat's smoke) drift between the camera and the sea in cloudy weather, each with its shadow straight below it; in a storm they hang low and dark and the lightning comes out of them; fog hides them; they turn see-through where they cover the boat. Plus soft-edged far cloud shadows (two layers); Clear → Overcast dulls and greys the colours and hides the sun glitter. The stylised wind lines give way to rain and fog.
  - **Extras**: a rainbow after a good shower (daytime, not in rain or fog) with a smooth spectrum, a faint secondary bow and the darker band between, sea spray off the bow in rough water at speed, and one wind direction that turns the waves and foam, the smoke and the wind streaks together.
  - **Colour by time of day**: rain drops, rings and spray are pink-gold at dawn, silver by day, amber at sunset, lavender at dusk and moonlit blue at night; lightning is warmer at sunset, violet-white at dusk, blue-white at night (and so is the patch of sea it lights); fog glows pink-peach at dawn, gold at sunset (with the sun as a big soft disc) and blue-silver at night (with a halo round the moon). At night rain rings sparkle cyan, and a lightning flash makes the whole sea and every glowing wake and ring flare.
  - **Sunbeams**: on cloudy days, after showers and as sunset light breaks into a storm, patches of sunlight drift across the water. Sail into one and the water glows gold round the boat (soft chime). After a shower the sun breaks through in a big sweep, then the rainbow appears.
  - **Rainbow**: stays where it appeared, so you can sail under its arc (sparkles and a chime). On some clear nights after rain it is a pale moonbow.
  - **Rare moments**: a waterspout now and then in a thunderstorm (a twisting funnel far off, drifting across with a whirl of spray at its base), and short hail bursts in heavy rain (pellets bounce off the water, with a rattle).
  - **The boat in the weather**: a headwind holds it back and a tailwind lets it surf faster (it also drifts slowly downwind in strong wind). Its windows light up in storms and fog, a searchlight sweeps the water, and in fog it sounds a foghorn now and then (Space gives a foghorn too). A close lightning strike jolts it: it heels over, rocks hard and its lights flicker; steering away from the strike calms it faster.
  - URL option: `?weather=clear|cloudy|rain|storm|fog` starts in a fixed weather.
- **Ocean colour** (Account settings): Deep Ocean (default), Tropical, Nordic or Pastel, applied on top of every time of day and remembered. Defined in `src/ocean/palettes.js` (`STYLES`).
- **Time of day**: **Real time** by default (follows the device clock: dawn ~6:30, day 8:30–16:30, sunset ~18:30, dusk ~19:45, night from 21:00), or a **1-hour cycle** (dawn → night → dawn every hour), or **Manual** (picking a time or dragging the slider). The choice is remembered. Mapping in `src/core/Clock.js`.
- **Tugboat**: a chunky, cel-shaded, outlined tugboat (scaled up and widened for cartoon bulk) that rocks with the waves: it rises, falls, pitches and rolls with the actual water surface (exaggerated so it reads from above, capped so it never tips over), sways on its own swell, and shudders with the engine and in storm chop. Much livelier in a storm; its windows glow at night. Model: `public/models/tugboat.glb`.
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
  core/TopDownControls.js tilted pan / zoom camera (pitch, default 60°)
  core/Clock.js      real clock → time of day
  weather/Weather.js presets, changing + local weather, lightning, rainbow
  weather/Rain.js    falling rain
  weather/Spray.js   bow spray, strike splashes
  weather/Lightning.js lightning bolts
  weather/Hail.js    hail bursts
  weather/Waterspout.js waterspout
  weather/Clouds.js  puffy cartoon clouds
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
