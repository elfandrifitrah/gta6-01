# Jakarta Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/elfandrifitrah/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/elfandrifitrah/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

Jakarta Heat is an original open-world crime game set in a fictional Jakarta in 2026, at golden hour. It was built for the [Make GTA 6 bounty on make.fun](https://make.fun/c/gta6-01). All art is procedural geometry drawn by the game's own software 3D renderer, and all sound is synthesized WebAudio. No external assets, no real trademarks, and no borrowed material.

## The story

Bimo is a driver who owes the fixer Bu Ratna $5,000. Four jobs clear the debt:

1. **Macet Total** ($800): drive a package through Jakarta's worst jam to the monument plaza.
2. **Kopor Hilang** ($1,200): take a stolen suitcase back from thieves in the kampung alleys.
3. **Balap Liar** ($1,500): win an illegal street race through the city's avenues.
4. **Jebakan di Pelabuhan** ($1,500): survive an ambush at the port, take the ledger, and escape.

Start cash is $250. The payouts run 250 to 1050 to 2250 to 3750 to 5250, exactly the debt plus a little room to breathe.

## The city

A wide Sudirman-style avenue, a monument plaza with a waving flag, kampung alleys with warung stalls, a working port with cranes and containers, and the harbour at the east edge. Traffic runs on the left: cars, taxis, vans, trucks, and ojek motorbikes. Pedestrians walk the sidewalks and run from trouble. The police respond to the wanted level, from one patrol car to a full chase.

## How to play

Run a static server over `game/` and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

Controls:

- **WASD / arrows**: move on foot, drive in a car
- **Shift**: run
- **E**: enter and exit cars
- **Click**: shoot
- **F**: punch
- **Space**: handbrake
- **Drag mouse**: look around, **wheel**: zoom
- **P / Esc**: pause (resume, restart the mission, save, quit to title)

Progress saves automatically when a mission completes, and from the pause menu. The start screen offers Continue when a save exists.

## How it is built

`game/index.html` loads ES modules under `game/src/`, one job per file: the city generator, the software 3D renderer, the player and vehicle physics, traffic and police, pedestrians, combat, the wanted system, missions, the HUD and minimap, synthesized audio, and screenshot staging. The entrypoint `main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's vendored library. `shots.json` lists the four staged screenshots and the query strings that produce them.
