# Jakarta Heat

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/elfandrifitrah/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/elfandrifitrah/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in a fictional Jakarta, built for the [make.fun](https://make.fun/) "Make GTA 6" bounty. Bimo owes the fixer Bu Ratna $5,000. Drive, fight, and race across the city at golden hour to pay it back: four story missions, traffic and pedestrians, a wanted level with pursuing police, combat on foot, and a living city of avenues, kampung alleys, a monument plaza, and a working port.

All places, people, and brands are fictional. All art is procedural geometry drawn in code, and all sound is synthesized with WebAudio. No external assets, no real trademarks.

## The story

1. **Macet Total** ($800) — Deliver Bu Ratna's package up a jammed Sudirman avenue before the clock runs out.
2. **Kopor Hilang** ($1,200) — A thief took the courier's suitcase in the kampung alleys. Catch him, take him down, bring it back.
3. **Balap Liar** ($1,500) — An illegal street race around the avenue loop. Hit every gate against three rivals.
4. **Jebakan di Pelabuhan** ($1,500) — A ledger waits in a port container. It is a trap. Clear the yard, take the ledger, and outrun the police home.

Pay off the full $5,000 to finish the story, then keep exploring in free roam.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move on foot, drive and steer in a car |
| Shift | Sprint on foot, handbrake in a car |
| E | Enter or leave a car |
| F | Punch |
| Mouse click | Shoot the pistol (once Bu Ratna lends it to you) |
| H | Honk |
| P / Esc | Pause |
| M | Sound on or off |
| N | New story (title screen) |

Progress saves automatically after each mission. The title screen offers to continue where you left off.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network requests: the game is plain static files under `game/`.

To build the submission dossier:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## How it is built

- `game/index.html` — the page and canvas.
- `game/src/main.js` — boot, screens, the fixed-step loop, saving.
- `game/src/world.js` — the one state object and the step order.
- `game/src/city.js` — the seeded city: roads, buildings, props, routes, landmarks.
- `game/src/player.js` — on-foot movement and arcade car physics.
- `game/src/traffic.js` — traffic, motorbikes, parked cars, pedestrians.
- `game/src/enemies.js` — the thief, the goons, and the port guards.
- `game/src/wanted.js` — heat, stars, police pursuit, and the bust meter.
- `game/src/combat.js` — punches, pistol shots, damage, and pickups.
- `game/src/missions.js` — the four-mission story state machine.
- `game/src/render.js` — the 2.5D canvas renderer and golden-hour grade.
- `game/src/hud.js` — HUD, minimap, banners, and menu panels.
- `game/src/audio.js` — synthesized WebAudio: engine, siren, and effects.
- `game/src/effects.js` — particles, tracers, floating text, screen shake.
- `game/src/shots.js` — the staged screenshot scenes.
- `main.ts` — hands the game in by writing the dossier with the kit library.

Built from scratch for this bounty. The kit starter's plumbing (`serve.ts`, `vendor/makefun-game.ts`) is unchanged.
