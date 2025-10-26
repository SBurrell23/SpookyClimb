# Spooky Climb (Vue 3 + TypeScript + Vite)

A canvas-drawn spooky vertical platformer with 5 procedurally generated levels. All art and VFX are rendered via the Canvas API (no external sprite assets). Minimal procedural audio powers jumps, landings, thunder, a door chime, death, and a soft rain ambience. Enemies are not implemented yet; the engine includes placeholders for future expansion.

## Requirements
- Node 18+

## Scripts
- `npm run dev` — start dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview production build
- `npm run type-check` — strict TypeScript type check (no emit)

## Controls
- **Move**: `A/D` or `←/→`
- **Jump**: `Space` or `W` or `↑`
- **Fast-fall**: `S` or `↓`
- **Start / Restart**: `Space` on the start/end screen

## Features
- **5 vertical stages** with moving platforms and an exit door transition between levels
- **Coyote time**, **variable jump height**, and **one mid-air double jump**
- **Rain ambience** that intensifies as you climb; occasional **lightning** with a subtle screen flash and camera rumble
- Ambient **bats**, landing **dust puffs**, soft **vignette**, and a right-side **progress bar**
- **Start screen** (Press Space) and an **end screen** showing per-level and total time

## Notes
- Everything is rendered via `CanvasRenderingContext2D` using procedural drawing utilities.
- Audio is procedural via the Web Audio API (no audio files).
- Enemies are not implemented yet; see `src/game/enemies.ts` for placeholders and renderer hooks.
- Levels are generated deterministically per level seed for consistent layouts across runs.

## Project Structure
```
src/
  components/
    GameCanvas.vue
  game/
    camera.ts
    entities.ts
    enemies.ts
    game.ts
    input.ts
    levels.ts
    physics.ts
    renderer.ts
    types.ts
    utils/
      draw.ts
  App.vue
  env.d.ts
  main.ts
  styles.css
```
