# Solmar Bay — Streets of Gold

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/astiip/gta6-01-bot/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/astiip/gta6-01-bot/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original 3D open-world crime game built for the make.fun **gta6-01** bounty.
Explore a sun-soaked coastal city on foot and by car, steal cars, outrun the
police, take on missions, and build your wanted level. All content is original —
our own city, characters, vehicles, names, story, art and sounds; nothing from
Rockstar Games or any other commercial game.

## The story

Rico Vega came to Solmar Bay to drive. Mara Solis, the fixer who runs the
crew out of the plaza, has bigger plans: eight jobs, one crew, and a city run by
Dante Kross and his Vultures gang.

1. **First Fare** — prove you can handle the city: drive Mara's car to the pier.
2. **Hot Wheels** — steal the marked coupe and deliver it to the garage.
3. **The Drop** — run a package to the north docks while the police close in.
4. **Turf War** — clear the Vultures out of the central plaza.
5. **The Bank Job** — hold the Solmar Bay Bank lobby while Mara cracks the vault.
6. **Skyline Escape** — the job put a police helicopter on you: break line of
   sight, lose the chopper, and reach the safehouse garage.
7. **The Golden Mile** — steal the Vultures' own gold coupe and deliver it to
   the marina, quiet — in their car, nobody looks twice.
8. **King of Solmar** — reach the marina yacht and end Dante Kross's rule.

## How to play

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse drag | Look around (third-person camera) |
| Shift | Run |
| Space | Jump / handbrake |
| E | Steal / enter a car, get out |
| Click | Shoot the pistol |
| F | Punch |
| R | Reload |
| P | Pause |
| M | Mute |

Follow the yellow beacon. Crime raises your wanted level (up to 5 stars) — the
police send cars and officers after you, and at 3 stars a helicopter joins the
chase with a searchlight; lose them and lay low to cool off. Getting busted
costs cash and fails the mission; getting wasted does the same. Drift at speed
and near-miss traffic for bonus cash. Progress (cash, missions, stats) saves
automatically in localStorage after every mission.

## The city

A 9×9 street grid at golden hour — a pink-orange sunset sky, a low sun over the
west sea, palm-lined boulevards, a boardwalk and beach umbrellas on the south
shore, a pier, a turning ferris wheel, a marina yacht, and a skyline on the
horizon. Traffic cruises the avenues, pedestrians stroll the sidewalks, and
parked cars are yours for the taking — if you don't mind the stars.

## Structure

Built with Three.js (vendored as `game/vendor/three.min.js`), plain static files
under `game/`, no build step, no network requests. The source is split into
files with one clear job each:

- `game/src/util.js` — seeded random, math, facade textures
- `game/src/config.js` — city layout, palette, tuning, controls
- `game/src/audio.js` — synthesized WebAudio sound (engine, sirens, gunfire)
- `game/src/city.js` — the city: streets, buildings, beach, pier, skyline
- `game/src/vehicles.js` — car meshes, traffic AI, arcade driving physics
- `game/src/people.js` — pedestrians and gang members
- `game/src/player.js` — Rico: on-foot movement, camera, entering cars
- `game/src/police.js` — wanted stars, police chases, the police helicopter, busted flow
- `game/src/combat.js` — pistol, punch, gang return fire
- `game/src/missions.js` — the eight-mission story, dialogue, and the waypoint beacon
- `game/src/hud.js` — wanted stars, cash, health/armour/respect, mission card, police response list, weapon slots, radio, round minimap, dialogue cards, drift feedback
- `game/src/save.js` — localStorage save / load
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=…`)
- `game/src/main.js` — bootstrap and the game loop

## Screenshots

Four real renders of the game running in desktop Chrome (`screenshots/`):

1. `1-chase.jpg` — a golden-hour police chase: 3 wanted stars, the helicopter
   and its searchlight, the police response list, and a mission objective on
   the HUD at once.
2. `2-city.jpg` — Rico on foot on the beach boulevard at sunset, the Solmar
   Wheel and the low sun over the sea.
3. `3-drive.jpg` — drifting down the Strip, the DRIFT combo paying out on
   the HUD.
4. `4-mission.jpg` — the Turf War mission in progress, with Mara's dialogue card.

## Run it

```sh
node serve.ts            # serves game/ at http://localhost:8080
```

Then open the page in desktop Chrome. To build the submission bundle:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`.
