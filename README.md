# Jakarta Heat

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun)
[![rank](https://make.fun/badge/gta6-01/elfandrifitrah/gta6-01/rank.svg)](https://make.fun)
[![reward](https://make.fun/badge/gta6-01/elfandrifitrah/gta6-01/reward.svg)](https://make.fun)

Jakarta Heat is an open-world crime game set in fictional Jakarta, 2026. It was built for the [make.fun](https://make.fun) bounty **gta6-01**. All art is procedural geometry, all sound and music is synthesized WebAudio, and the game makes zero network requests at runtime.

## Story

You are Bimo. You owe fixer Bu Ratna $5,000. Four jobs clear the debt:

1. **Macet Total** ($800): drive Pak Haji from Hotel Merdeka to the port within 150 seconds.
2. **Kopor Hilang** ($1,200): defeat three rivals at the warehouse yard, take the briefcase to Bengkel Sumber Jaya.
3. **Balap Liar** ($1,500): steal the yellow Garuda GT coupe at the hotel, hit three checkpoints, deliver it to the chop shop. Half pay if it arrives badly damaged.
4. **Jebakan di Pelabuhan** ($1,500): survive a two-wave ambush at the port, take the money bag home.

Cash flow: $250 to $1,050 to $2,250 to $3,750 to $5,250.

## How to run

Serve the repository root with any static server, then open `game/index.html` in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

No build step. No network requests. Three.js r160 is vendored under `game/vendor/`.

## Controls

- WASD / arrows: move and drive
- Mouse: shoot (click)
- F: punch
- R: reload
- E: enter cars, start jobs, retry
- Space: handbrake
- Shift: sprint
- Right-drag or Q: orbit camera
- Mouse wheel: zoom
- P / Esc: pause
- M: mute

## Features

- Open city on foot and by car: 5x5 road grid, left-hand traffic
- Traffic cars, motorbikes, buses, MRT train, pedestrians
- Steal and drive cars and bikes, including police cars
- Wanted stars, police chase with road-grid routing, bust and wasted respawns
- On-foot combat: punches and pistol
- HUD with health, cash, debt, wanted stars, ammo, speed, mission tracker, and minimap
- Title screen, pause, localStorage save with Continue
- Synthesized sound effects and music loop
- Landmarks: Tugu Semangat monument plaza, Sudirman glass-tower corridor with busway, Bundaran Semangat roundabout, Kota Tua shophouses, kampung quarters, Masjid Agung, port, toll road, coastal flyover, MRT line

## Originality

All content is original. No Rockstar material, no GTA names, no real trademarks or logos. Street names, billboard brands, warung names, and vehicle liveries are invented.
