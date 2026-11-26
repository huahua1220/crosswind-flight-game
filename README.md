# CROSSWIND

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/huahua1220/crosswind-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/huahua1220/crosswind-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A 3D valley flight game built for the
[make.fun best-flight-game bounty](https://make.fun/bounty/best-flight-game-20261126-0057).
Vanilla JS + 2D canvas, no libraries, no network: a hand-written
painter's-algorithm polygon engine renders a seeded heightfield valley —
river, patchwork fields, forest, ridge, clouds and a runway — with a small
prop plane in frame.

Four sorties (ring course, gusty crosswind touch-and-go, low river gates,
cargo drop), chase and cockpit views, a full instrument HUD, and a
stall/fuel/damage flight model with graded landings. WebAudio engine hum,
wind and alerts are generated in code — no audio files.

## Run

```
node serve.ts
```

then open http://localhost:8080 — keyboard (arrows/W-S/A-D/F/B/Space) or
mouse-stick (M toggles). `?shot=rings|final|cockpit|landing` jumps into the
poses used for the screenshots in `screenshots/`.
