# Bulwark

A 3D low-poly sci-fi base-defense game in TypeScript + Three.js. You control a fortress cannon at the centre of the map, build turrets and barriers around it, and hold out through 10 waves ending in a boss.

There are three battlefields, picked on the title screen. Each has its own look and layout:

| Level | Ground units enter by | Hazard |
| --- | --- | --- |
| **Mirrorlake Isles**: a green island in a lake ringed by pine woods | 3 land bridges | The lake |
| **Sunscar Dunes**: pale desert flats walled in by sandstone mesas | 4 canyons | Quicksand pits |
| **Mossgate Hollow**: grassy stone terraces with standing stones | 4 dirt ramps down from the rim | Ravines with a stream |

### Shields and the newer threats
- **Core shield**: a single energy dome (radius 15) over the main gun. Enemy bolts, wasp lasers, artillery, rockets and bombs entering from outside are absorbed at its surface; fire that starts inside, and melee units, get through. It recharges after 3 s without hits. When drained it collapses into shards and reboots after 8 s at 30%, building back up from its base ring. Its strength shows under Core Integrity in the HUD. The logic lives in `systems/ShieldSystem.ts`, and the layered shader (flowing energy, filaments, hex lattice, ripples, rim, base ring) in `vfx/ShieldDome.ts`.
- **Capacitor** (key 5): adds +450 dome strength and +12/s recharge while it stands, and streams energy motes into the dome. Capacitors outside the dome can be bombed.
- **Howler** (from wave 3): rocket artillery that stops 30 units out and fires 4-rocket salvos. It outranges most turrets.
- **Vulture** (from wave 5): a bomber cruising above the dome that flies passes over its target. It releases a stick of 3 bombs early enough to land on it, overshoots, loops back and repeats. Flak and Repeaters shoot it down.

### Skipping ahead
- **Starting wave** (title screen): begin a run at any wave from 1 to 10. You get catch-up scrap of 80% of what the skipped waves would have paid (kills plus clear bonuses), computed from the wave tables in `systems/waveRewards.ts`. The choice is remembered.
- **Call the next wave early** (Enter or the button during combat): the next wave starts on top of the current one. You're paid the current wave's clear bonus right away, plus 3 scrap per enemy still alive or to come. It's disabled for 2 s after each launch so a double-tap of Enter doesn't skip a wave.

### Core gun modes
The core's main gun has four modes. Switching takes 0.7 s while the barrels swap, and you can't fire during it. Damage and fire-rate upgrades apply to every mode.

| Mode | Behaviour |
| --- | --- |
| Autocannon | Twin rapid cannons with a small splash; good all-round |
| Scatter | 7-pellet cone from four barrels; short range, shoves swarms back |
| Lance | Hold to channel a piercing beam that ramps up over 0.6 s; hits air too |
| Siege | Lobs a heavy shell at the cursor (10–50 range, shown by a ring); big knockback, ground only |

With **auto-fire** on, the gun picks targets itself: the enemy closest to the core that the current mode can hit. It leads moving targets and fires once lined up. Holding LMB still takes manual control. The setting is remembered per browser.

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
| Mouse / LMB hold | Aim and fire the core gun |
| A S D F / Tab | Switch gun mode: Autocannon / Scatter / Lance / Siege (Tab cycles) |
| T | Toggle auto-fire (also a switch in the Core gun panel) |
| RMB | Swarm missiles at enemies near the cursor |
| Space | Nova pulse: damage plus knockback around the core |
| 1–5 | Select Repeater / Flak / Mortar / Arc Coil / Capacitor |
| Q W E R | Deploy a squad: Sentinels / Lancers / Rampart / Kestrels |
| Shift + click | Keep placing the same structure |
| X | Sell the hovered structure |
| Enter | Launch next wave; during a wave, call the next one early |
| Wheel · P · M | Zoom · pause · mute |

## Code layout

```
src/
  config/     Pure data: enemy, structure, wave, upgrade and balance tables, colour palette
  core/       Game loop + phase machine (Game), system container (World), input, events, math
  entities/   Core, Enemy, Structure, Ally, Squad: state + visuals for a single object
  systems/    Behaviour across many objects: EnemyAI, TurretWeapons, ProjectileSystem,
              PlayerWeapons, WaveManager, BuildSystem, Economy, UpgradeSystem,
              SquadManager + AllyAI (player squads), CoreGun (main gun modes)
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

The terrain has real relief. `battlefieldRelief()` in `levels/biomes/shapes.ts` keeps the core's pad flat, gently rolls the build area and adds knolls beyond it, with every slope walkable. Structures sit on the ground and can't be built where their footprint is too steep. The terrain mesh darkens hollows and brightens crests based on curvature.

Ground colour is baked into a 1024² texture, about four texels per unit (`world/GroundTexture.ts`). That keeps path edges, grass patches and sand ripples crisp. The bake samples a coarse lattice first and only evaluates every texel where the colour actually changes. The helpers in `levels/biomes/ground.ts` (`patches`, `flecks`, `crisp`, `edgeJitter`) give the Taur-style flat colour zones with clean edges. Most of the ground detail comes from small props scattered in natural drifts by `levels/clutter.ts`: pebbles, grass tufts, branches, stumps and flagstones. The build area only gets low clutter, so structures stay readable.

Water (`world/features/Water.ts`) is a stylised shader on Phong lighting. `WaterField.ts` bakes the depth below the surface and the distance to the nearest shore or rock into a small texture. The shader reads it per pixel to draw see-through shallows over the lakebed, darker deep water, a crisp waterline, and foam bands that roll in toward the shores and around rocks. A cheap sky reflection uses Fresnel. The hollow's streams use the `swirl` option, so their foam runs along the ravines.

The nav grid and flow field are built from the biome automatically. In dev builds, a gate with no path to the core logs a warning.

### Unit models
All units are built from primitives in `render/models/`. Beyond boxes and cylinders, `ModelBuilder` offers:
- `bevelBox`: chamfered armour.
- `wedge`: tapered plates.
- `hull`: any convex shape, for claws, fuselages and membranes.
- `strut`: a tapered segment between two points, for limbs, spars and barrels.

Walkers have hip and knee pivots, crawlers move in alternating tripods, and turrets track independently. The designs follow two Scenario concept sheets, one per faction. A generated 3D model was tested and rejected: it was 3.4 MB, a single mesh that couldn't animate, with texture detail invisible at game zoom.

### Rendering notes
- Models are built from primitives by `ModelBuilder` and merged into one lit mesh and one glow mesh per part. Colour is stored per vertex, so the whole game uses a handful of shared materials.
- The scene renders into a half-float target. Glow colours go above 1.0 and drive `UnrealBloomPass`. `OutputPass` then applies ACES tone mapping.
- Only the scene pass is multisampled. The resolved image is copied to a single-sample buffer before bloom, because blending into an MSAA buffer is very slow on Apple Silicon. Bloom is sized in CSS pixels.
- Resolution is capped by a pixel budget (about 1.5x on a Retina MacBook), and `ResolutionGovernor` steps it down further if frames run slow. The settings are in `config/graphics.ts`.
- Each particle type is a single `InstancedMesh` with struct-of-arrays state. There are no per-particle allocations.

In dev builds, `window.bulwark` exposes the running game for console debugging.
