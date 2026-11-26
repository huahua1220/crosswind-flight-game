# CROSSWIND — status

A 3D valley flight game in vanilla JS + 2D canvas (no libraries, no network).
Hand-rolled painter's-algorithm renderer over a seeded heightfield terrain:
river, patchwork fields, forest, ridge, clouds, and a runway strip.

## What was built
- `game/index.html` + `game/src/` — one file per job:
  - `config.js` constants + palette
  - `random.js` seeded RNG + fbm noise
  - `terrain.js` heightfield world: river, runway, trees, barns, clouds
  - `flight.js` flight model: throttle, pitch/roll/yaw, stall, wind,
    fuel burn, damage, touchdown grading
  - `aircraft.js` polygon plane model
  - `render3d.js` projection pipeline, sky, fog, painter sort
  - `input.js` keyboard + mouse-stick
  - `missions.js` 4 sorties: Farm Loop (rings), Crosswind Solo
    (gusty touch-and-go), River Run (low gates), Freight Run (cargo drop)
  - `effects.js` dust/smoke/crash particles
  - `audio.js` WebAudio engine/wind/alerts, no files
  - `hud.js` speed/alt tapes, engine stack, attitude dial, compass,
    mission card, title/overlay screens
  - `shots.js` deterministic `?shot=` poses used for screenshots
  - `main.js` game loop + state machine

## Controls
Arrows or mouse-stick fly; W/S throttle; A/D rudder; F flaps;
B brake; SPACE drop crate; C view (chase/cockpit); M mouse-stick;
R retry; ESC menu.

## Screenshots (screenshots/)
1. `1-rings.jpg` — cover: threading ring 4 of the Farm Loop over the river
2. `2-final.jpg` — short final to runway 36, mission card + full HUD
3. `3-cockpit.jpg` — cockpit panel, Crosswind Solo approach
4. `4-landing.jpg` — touchdown, dust trail, "GREASED IT" grading banner

## Verify
- `node serve.ts` then http://localhost:8080 (or any static server on repo/)
- `MAKEFUN_OUTPUT_DIR=out node main.ts` builds `out/` + `dossier.json` — verified
- `node <kit>/cli/makefun.mjs check --kit <kit> --repo repo --worktree`:
  all game-side rows pass; transcripts/repo-public rows are the
  submitter's step (kit copy is level 51 vs site 53 — re-download the kit
  before bundling/submitting).
