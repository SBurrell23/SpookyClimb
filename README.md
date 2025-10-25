# Spooky Platformer (Vue 3 + TypeScript + Vite)

A canvas-drawn spooky platformer with 3 levels. All art is generated via Canvas API (no external assets). Enemies are not implemented yet, but the engine includes placeholders for future expansion.

## Requirements
- Node 18+

## Scripts
- `npm run dev` — start dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview production build
- `npm run type-check` — strict TypeScript type check (no emit)

## Controls
- Move: `A/D` or `←/→`
- Jump: `Space` or `W` or `↑`
- Reset Level: `R`
- Switch Level: `1`, `2`, `3`

## Notes
- Everything is rendered via `CanvasRenderingContext2D` using procedural drawing utilities.
- The engine is structured to add enemies later: see `src/game/enemies.ts` placeholders and hooks in the game loop.

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
