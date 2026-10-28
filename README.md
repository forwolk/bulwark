# Bulwark

A 3D low-poly sci-fi base-defense game in TypeScript + Three.js. You control a fortress cannon at the centre of the map, build turrets and barriers around it, and hold out through 10 waves ending in a boss.

There are three battlefields, picked on the title screen. Each has its own look and layout:

| Level | Ground units enter by | Hazard |
| --- | --- | --- |
| **Mirrorlake Isles**: a green island in a lake ringed by pine woods | 3 land bridges | The lake |
| **Sunscar Dunes**: pale desert flats walled in by sandstone mesas | 4 canyons | Quicksand pits |
| **Mossgate Hollow**: grassy stone terraces with standing stones | 4 dirt ramps down from the rim | Ravines with a stream |

### Squads
Squads are allied units you deploy from the core for scrap, using the left-hand panel or Q W E R. Each type has its own cooldown, and at most 6 squads can be in the field at once. Each squad takes a guard post on the emptiest entry lane and engages enemies within a leash of that post. Enemies attack squads too, and squads are repaired between waves with the structures.

| Squad | Units | Role |
| --- | --- | --- |
| Sentinels | 6 hover drones | Cheap rapid blasters, ground + air |
| Lancers | 3 walkers | Rail beams that punch through armour |
| Rampart | 1 hover tank | Damage sponge with splash cannon |
| Kestrels | 3 interceptors | Circle their post, homing missiles at ground + air |

Mortar shells, missiles and the nova pulse knock enemies back. An enemy shoved into a hazard is lost, and you still get its scrap. Flyers ignore terrain.

All art, effects and audio are generated in code. There are no asset files.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle in dist/
```

Requires Node 16+. Vite is pinned to v4 for Node 16 compatibility. Once you're on Node 18+, you can upgrade it.

## Controls

| Input | Action |
| --- | --- |
| Mouse / LMB hold | Aim and fire the core cannon |
| RMB | Swarm missiles at enemies near the cursor |
| Space | Nova pulse: damage plus knockback around the core |
| 1–5 | Select Repeater / Flak / Mortar / Arc Coil / Barrier |
| Q W E R | Deploy a squad: Sentinels / Lancers / Rampart / Kestrels |
| Shift + click | Keep placing the same structure |
| X | Sell the hovered structure |
| Enter | Launch next wave |
| Wheel · P · M | Zoom · pause · mute |

## Code layout

```
src/
  config/     Pure data: enemy, structure, wave, upgrade and balance tables, colour palette
  core/       Game loop + phase machine (Game), system container (World), input, events, math
  entities/   Core, Enemy, Structure, Ally, Squad: state + visuals for a single object
  systems/    Behaviour across many objects: EnemyAI, TurretWeapons, ProjectileSystem,
              PlayerWeapons, WaveManager, BuildSystem, Economy, UpgradeSystem,
              SquadManager + AllyAI (player squads)
  render/     Renderer (HDR + bloom), CameraRig, ModelBuilder, procedural models/
  vfx/        Instanced low-poly particles, glow sprites, light flashes, scorch decals,
              and Effects (named recipes like explosion, shockwave, lightning)
  levels/     Level catalog (themes, gates), runtime Level, NavGrid + FlowField pathfinding,
              and one Biome per battlefield (height, hazards, colouring, set dressing)
  levels/props.ts  Low-poly nature props (trees, rocks, cacti, standing stones, crystals...)
  world/      Smooth terrain mesh builder, water + shore foam, quicksand, glow pools, baked
              contact shadows, ambient motes, lighting rig + build-zone overlay (Arena)
  audio/      WebAudio-synthesized sound effects
  ui/         DOM HUD, build bar, upgrade shop, world-anchored overlays, screens
```

Tuning the game usually only touches `src/config/`. To add an enemy:
1. Add an entry to `config/enemies.ts`.
2. Add a model factory to `render/models/EnemyModels.ts`.
3. Use the enemy in `config/waves.ts`.

To add a level:
1. Write a `Biome` in `levels/biomes/`. It provides height, hazard zones and ground colours, plus a `decorate()` pass. That pass places props from `levels/props.ts`, blocks cells, bakes contact shadows, adds glow pools and registers animations.
2. Add a `LevelDef` to `levels/catalog.ts` with a theme (lights, fog, motes, dust) and the gates where ground units enter.

The nav grid and flow field are built from the biome automatically. In dev builds, a gate with no path to the core logs a warning.

### Rendering notes
- Models are built from primitives by `ModelBuilder` and merged into one lit mesh and one glow mesh per part. Colour is stored per vertex, so the whole game uses a handful of shared materials.
- The scene renders into a half-float target. Glow colours go above 1.0 and drive `UnrealBloomPass`. `OutputPass` then applies ACES tone mapping.
- Only the scene pass is multisampled. The resolved image is copied to a single-sample buffer before bloom, because blending into an MSAA buffer is very slow on Apple Silicon. Bloom is sized in CSS pixels.
- Resolution is capped by a pixel budget (about 1.5x on a Retina MacBook), and `ResolutionGovernor` steps it down further if frames run slow. The settings are in `config/graphics.ts`.
- Each particle type is a single `InstancedMesh` with struct-of-arrays state. There are no per-particle allocations.

In dev builds, `window.bulwark` exposes the running game for console debugging.
