# Bulwark

A 3D low-poly sci-fi base-defense game in TypeScript + Three.js. You control a fortress cannon at the centre of the map, build turrets and barriers around it, and hold out through 10 waves ending in a boss.

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
| Shift + click | Keep placing the same structure |
| X | Sell the hovered structure |
| Enter | Launch next wave |
| Wheel · P · M | Zoom · pause · mute |

## Code layout

```
src/
  config/     Pure data: enemy, structure, wave, upgrade and balance tables, colour palette
  core/       Game loop + phase machine (Game), system container (World), input, events, math
  entities/   Core, Enemy, Structure: state + visuals for a single object
  systems/    Behaviour across many objects: EnemyAI, TurretWeapons, ProjectileSystem,
              PlayerWeapons, WaveManager, BuildSystem, Economy, UpgradeSystem
  render/     Renderer (HDR + bloom), CameraRig, ModelBuilder, procedural models/
  vfx/        Instanced low-poly particles, glow sprites, light flashes, scorch decals,
              and Effects (named recipes like explosion, shockwave, lightning)
  world/      Terrain heightfield, decor scattering, lighting, build-zone overlay
  audio/      WebAudio-synthesized sound effects
  ui/         DOM HUD, build bar, upgrade shop, world-anchored overlays, screens
```

Tuning the game usually only touches `src/config/`. To add an enemy:
1. Add an entry to `config/enemies.ts`.
2. Add a model factory to `render/models/EnemyModels.ts`.
3. Use the enemy in `config/waves.ts`.

### Rendering notes
- Models are built from primitives by `ModelBuilder` and merged into one lit mesh and one glow mesh per part. Colour is stored per vertex, so the whole game uses a handful of shared materials.
- The scene renders into a half-float target. Glow colours go above 1.0 and drive `UnrealBloomPass`. `OutputPass` then applies ACES tone mapping.
- Only the scene pass is multisampled. The resolved image is copied to a single-sample buffer before bloom, because blending into an MSAA buffer is very slow on Apple Silicon. Bloom is sized in CSS pixels.
- Resolution is capped by a pixel budget (about 1.5x on a Retina MacBook), and `ResolutionGovernor` steps it down further if frames run slow. The settings are in `config/graphics.ts`.
- Each particle type is a single `InstancedMesh` with struct-of-arrays state. There are no per-particle allocations.

In dev builds, `window.bulwark` exposes the running game for console debugging.
