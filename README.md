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
  - **Clouds**: thick, puffy, realistic clouds (soft billowy puffs with frayed edges, rounded light and shadow, darker undersides and a silver lining, no outlines) drift between the camera and the sea in cloudy weather, each with its shadow straight below it; in a storm they hang low and dark and close strikes come straight down out of them; fog hides them; they turn see-through where they cover the boat. Plus soft-edged far cloud shadows (two layers); Clear → Overcast dulls and greys the colours and hides the sun glitter. The stylised wind lines give way to rain and fog.
  - **Extras**: a rainbow after a good shower (daytime, not in rain or fog) with a smooth spectrum, a faint secondary bow and the darker band between, sea spray off the bow in rough water at speed, and one wind direction that turns the waves and foam, the smoke and the wind streaks together.
  - **Colour by time of day**: rain drops, rings and spray are pink-gold at dawn, silver by day, amber at sunset, lavender at dusk and moonlit blue at night; storm lightning is dark blue at dawn, dark red at sunset, warm yellow at dusk and blue-white at night (and so are the patch of sea it lights and the flash); fog glows pink-peach at dawn, gold at sunset (with the sun as a big soft disc) and blue-silver at night (with a halo round the moon). At night rain rings sparkle cyan, and a lightning flash makes the whole sea and every glowing wake and ring flare.
  - **Sunbeams**: on cloudy days, after showers and as sunset light breaks into a storm, patches of sunlight drift across the water. Sail into one and the water glows gold round the boat (soft chime). After a shower the sun breaks through in a big sweep, then the rainbow appears.
  - **Rainbow**: stays where it appeared, so you can sail under its arc (sparkles and a chime). On some clear nights after rain it is a pale moonbow.
  - **Rare moments**: a waterspout now and then in a thunderstorm (a twisting funnel far off, drifting across with a whirl of spray at its base), and short hail bursts in heavy rain (pellets bounce off the water, with a rattle).
  - **The boat in the weather**: a headwind holds it back and a tailwind lets it surf faster (it also drifts slowly downwind in strong wind). Its windows light up in storms and fog, a searchlight sweeps the water, and in fog it sounds a foghorn now and then (Space gives a foghorn too). A close lightning strike jolts it: it heels over, rocks hard and its lights flicker; steering away from the strike calms it faster.
  - URL option: `?weather=clear|cloudy|rain|storm|fog` starts in a fixed weather.
- **Ocean colour** (Account settings): Deep Ocean (default), Tropical, Nordic or Pastel, applied on top of every time of day and remembered. Defined in `src/ocean/palettes.js` (`STYLES`).
- **Time of day**: **Real time** by default (follows the device clock: dawn ~6:30, day 8:30–16:30, sunset ~18:30, dusk ~19:45, night from 21:00), or a **2-hour cycle** (dawn → day → sunset → dusk → night every 2 hours, 24 minutes each; inside each time of day the weather runs clear → cloudy → rain → storm → fog, about 5 minutes each, so every time of day gets the same share of every weather), or **Manual** (picking a time or dragging the slider). The choice is remembered. Mapping in `src/core/Clock.js`.
- **Tugboat**: a chunky, cel-shaded, outlined tugboat (scaled up and widened for cartoon bulk) that rocks with the waves: it rises, falls, pitches and rolls with the actual water surface (exaggerated so it reads from above, capped so it never tips over), sways on its own swell, and shudders with the engine and in storm chop. Much livelier in a storm; its windows glow at night. Model: `public/models/tugboat.glb`.
  - **Steer**: tap the water to sail there, or press on the boat and drag to steer it with your finger (it carries on to where you let go). Desktop: arrow keys / WASD to drive, Space for the horn.
  - **Tap the boat** and it sinks; a soaked sheet of paper flutters up out of the water like a leaf on the wind (swinging side to side, tilting into each swing, dipping, flipping over once, drifting with the weather's wind), dripping and drying out as it rises (the edges dry last), then hovers in front of you with a little bounce and sway before settling onto the screen. Drag and flick the paper up or down (or flick up / down anywhere on the letter screen, or press Esc) to send it back into the sea and the boat bobs back up. The paper is a letter: tap it to write (handwriting font, placeholder "Write something for your loved one"), with camera / voice / reminder / inbox buttons along the bottom (placeholders for now). The plain "Drag and flick back into the sea" guide under it disappears once you write something, and your words fly away with the paper.
  - **Who it's for**: a row of small round avatars at the top, each sitting in a circle of water: the photo or coloured initials fade out softly toward their round edge (no border), with a gap of sea before a live ring of water (drawn every frame: several wave trains run round it at different speeds and directions so its edges keep reshaping unevenly, a slow swell makes some stretches choppy and others calm, the water is thick in some places and thin in others with the thick parts drifting round, foam on the crests, glints drifting along it, all in the sea's colours for the time of day; `src/social/WaterRing.js`); droplets splash out from it every few seconds and bubbles rise inside. Notifications and Add Status match. A number at the top right of the water circle shows unread letters from them; a green dot at the bottom right means they're on the ocean right now. Swipe sideways (on the paper or anywhere on the letter screen) or tap to choose: the chosen one pops with a squash and stretch and a light haptic tick (vibration on Android, the switch-control tick on iPhone iOS 18+), the others shrink and fade toward the screen edges. Demo people in `src/social/people.js` (`photo`, `unread`, `online`; the two demo photos are illustrations).
  - **Writing the letter**: every letter you type draws itself in like a pen stroke with a slight handwritten wobble, in ink that follows the time of day (violet-blue at dawn, deep blue by day, sepia at sunset, purple at dusk, glowing silver on dark paper). "to …" writes itself at the top and your name signs at the bottom, while the empty page types prompts for you ("Tell Aarav about your day…", "What made you smile today?"…); the paper has softly rounded corners; every few words bubbles (fireflies at night) drift up off the line. The paper breathes with the waves and its corner lifts near where you type. Soft pen-scratch sounds, a page rustle on Enter, a haptic tick per word.
  - **Stationery and decoration** (✦ and pen in the paper's corner): paper follows the time and weather by default (pink dawn, cream day, warm sunset, lavender dusk, starry navy night, water stains in rain) or pick Parchment, Waves, Starry or Sakura; a mood (Miss you, Thank you, Good night, Love you, Cheer up) tints the paper, adds a wavy border and changes the music; stickers (shell, starfish, stamp, boat, fish) to place and move (drag off the paper to remove); doodle with the pen. 🎤 records a voice note drawn as a wavy ink line (tap ▶ to play); 📷 adds a photo as a clipped-on polaroid.
  - **Sending**: the letter folds into a paper plane in 8 real folds (crease in half, top corners in, edges in again, fold in half, each wing down), each fold leaving a faint crease line; at the end it turns over and dips its nose 60° away so you see it from behind, the keel hanging below the wings in a T; then it swoops into their circle, or rolls up from its bottom edge into a scroll inside a glass bottle that drops into the sea; their circle catches it with a splash.
    - Blank or written, the letter folds by hand, anywhere on the screen: **drag down** folds it into a paper plane, fold by fold through the 8 steps; **drag up** rolls it up from the bottom edge into a bottle. Drag the other way to undo it, back to the flat letter.
    - **Throw**: keep pulling past the end and let go fast (a finished plane can also be flicked up). A plane flies to the chosen friend's circle; a bottle drops into the sea.
    - Letting go part-way: a quick pull finishes the shape, a quick pull back undoes it, otherwise it settles to the nearest. Past either end the paper gives a little and springs back (rubber band).
    - Holding the finished plane, each movement is either sideways or up/down, never both. Sideways: the plane banks (moving right raises the left wing), the friend it's heading for lights up, and past a short distance a gust shoves it across (wind streaks) as the friends row moves to that friend. Steering never throws.
    - **Unsend**: for 3 seconds after a throw, an "Unsend" button brings the letter back flat, as it was.
    - **Press and hold** the flat letter (or right-click): a menu to send it as a paper plane or in a bottle, or to move to the previous / next friend.
    - **Pen**: while drawing, a "Drawing ✓ Done" pill shows at the top of the paper; ✓, a tap outside the paper or a second finger ends it.
    - First letter: a finger shows drag down (plane) and drag up (bottle); after the first throw the hint line gets shorter. Each fold step has its own crease sound and tick, with a firmer snap and vibration when the shape is finished. Touches must move about 15px (phones) before counting as a drag; touches starting at the screen's side edges are left to the browser; no iPhone text-selection popup on the circles. With reduced motion on, folds and flights are quicker and the gust is a nudge without wind streaks.
  - **Letter buttons**: pen, clear, photo, voice note, reminder, inbox and decorate sit in one row under the letter, a swipeable carousel that fades out at both sides like the friends row.
  - **Contact circles** (`src/social/Circles.js`): the chosen circle swirls faster (the rest calm down); each friend's ring is in the colours of their own local time of day, with rain or snow inside if that's their weather (Open-Meteo, by city); "writing…" pulses when a friend is writing to you; long-press to peek (status, their last letter, when you last wrote, streak); drag a circle down onto the letter to address it to them; a water plop pitched per friend; new letters arrive and the number pops up; birthday confetti; night lanterns over online friends and a constellation between the friends you write to most. Writing and arrivals are simulated for the demo.
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
  social/WaterRing.js live water rings round the avatars (koi, rain / snow)
  social/Circles.js  contact circle moments
  social/Stationery.js paper styles, moods, ink; paints the finished letter
  social/stickers.js sticker SVGs
  social/people.js   demo people (you + friends in the ocean)
  ui/controls.js     settings panel
public/models/       tugboat.glb / .mtl, plus the original stylized-ocean.glb / .mtl exports
```

`ocean.getHeightAt(x, z)` returns the live water height, `ocean.addRipple(x, z)` makes a splash, `ocean.setBoat(x, z, heading, speed01)` draws a boat wake, and `ocean.setObjects([{ x, z, radius }])` draws foam rings around up to 4 floating objects (boats, players).
For console access, `window.oceanApp` exposes `{ scene, camera, ocean, ... }`.
