# Jakarta Heat — gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/elfandrifitrah/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/elfandrifitrah/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Jakarta Heat is an original open-world crime game set in a fictionalized Jakarta, 2026. Bimo owes the fixer Bu Ratna $5,000. Four jobs pay the debt: a fare through macet total, a stolen briefcase, a hot coupe, and an ambush at the port. The city is explorable on foot and by car, with left-hand traffic, motorbike flow, bajaj three-wheelers, articulated buses on a dedicated busway, a wanted level with chasing police, on-foot combat, a HUD with minimap, and a save system. All art is procedural low-poly geometry, all sound is synthesized with WebAudio, and every place, person, vehicle and brand is invented. No real logos, trademarks, or landmark copies.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No network requests: three.js is vendored under `game/vendor/`.

## Controls

WASD to move and drive, mouse to shoot, F to punch, R to reload, E to enter cars and start jobs, Space for the handbrake, Shift to sprint, right-drag or Q to orbit the camera, the wheel to zoom, P to pause, M to mute.

## Build the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `game/` and `screenshots/` into `out/` and writes `out/dossier.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=zqpbgt3e&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
