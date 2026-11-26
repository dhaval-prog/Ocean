# Ocean

A mobile + desktop web app built on a stylized, shader-driven 3D ocean (three.js + Vite).
This is the foundation for an upcoming game + chat experience.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN for phone testing)
npm run build      # production build in dist/
```

## What's here

- **Endless-looking ocean**: a 140×140 surface whose edges haze into the sky, so it reads as open sea on any screen size.
- **Time of day**: Dawn, Day, Sunset, Dusk and Night, blended with a far-to-near sweep, or cycled automatically.
- **Sea state**: from calm to stormy (wave height, foam and speed).
- **Reef shallows** toggle.
- **Touch + mouse camera**: drag to orbit, pinch or scroll to zoom, limited so you never go under the water.
- **Responsive UI**: a floating card on desktop and a collapsible bottom sheet on phones; safe-area aware; installable (web manifest).

## Structure

```
src/
  main.js            renderer, camera, lights, loop
  ocean/Ocean.js     Ocean class: mesh, setTimeOfDay(), storm, reef, getHeightAt(x, z)
  ocean/shaders.js   GLSL for the water (ported from Ocean_Standalone.html)
  ocean/palettes.js  time-of-day colour presets
  ui/controls.js     settings panel
public/models/       original stylized-ocean.glb / .mtl exports (static, baked colours)
```

`ocean.getHeightAt(x, z)` returns the live water height, ready for floating boats and players.
For console access, `window.oceanApp` exposes `{ scene, camera, ocean, ... }`.
