# CLAUDE.md — Project Conventions for The Last Refuge

## Project Overview

Browser-based game built with HTML5 Canvas + TypeScript. Entity-Component-System architecture with fixed-timestep game loop. See `docs/PHASE1_SPEC.md` for the full build spec.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Build:** Vite
- **Testing:** Vitest
- **No frameworks.** Vanilla TS, ES modules, canvas rendering.

## Architecture

- **ECS pattern:** Entities are numeric IDs with a debug name and a bag of Components. Components are data containers with minimal logic. Systems contain game logic and run in explicit order each tick.
- **Event Queue:** Cross-entity and cross-system communication goes through `EventQueue`. Events are queued and drained once per frame.
- **Service Locator:** Shared services (canvas, ctx, eventQueue, world) are registered and retrieved via `ServiceLocator` — never hardcoded imports of singletons.
- **Game Loop:** Fixed-timestep update (60/sec) with variable rendering. Systems implement `update(dt)` for logic and `render(alpha)` for drawing.

## File Structure

```
src/
  core/           Framework classes (Entity, Component, System, World, GameLoop, EventQueue, ServiceLocator)
  components/     Component classes (data only)
  systems/        System classes (game logic)
  data/           Static data (name lists, biome definitions, etc.)
  main.ts         Entry point — boots services, world, systems, game loop
```

## Code Style

Enforced by **ESLint** with `typescript-eslint/strict`. Run `npm run lint` to check, `npm run lint:fix` to auto-fix.

- **No `any`.** Enforced by `@typescript-eslint/no-explicit-any`.
- **No default exports.** Enforced by `no-restricted-syntax` on `ExportDefaultDeclaration`.
- **No non-null assertions (`!`).** Enforced by `@typescript-eslint/no-non-null-assertion`. Use proper null checks.
- **Explicit return types on functions.** Warned by `@typescript-eslint/explicit-function-return-type`.
- **Unused vars must be prefixed with `_`.** Enforced by `@typescript-eslint/no-unused-vars`.
- **Single responsibility.** One class per file. File name matches class name.
- **Components are data.** Game logic belongs in Systems, not Components.

## Testing

- **Framework:** Vitest. Run with `npm test`. Watch mode with `npm run test:watch`.
- **Test location:** Colocated `__tests__` directories next to source (e.g. `src/core/__tests__/Entity.test.ts`).
- **What to test:**
  - All core framework classes (Entity, World, EventQueue, ServiceLocator).
  - All System logic — instantiate real Components, call `update(dt)`, assert state changes.
  - Crew generation invariants (50 humans, correct role distribution, no relationship orphans, pre-seeded characters present).
- **What NOT to test:**
  - Canvas rendering output (verify visually).
  - DOM/HTML panel appearance (verify visually).
- **Coverage:** Enforced on `src/core/` — 80% threshold for branches, functions, lines, statements. Run `npm run test:coverage` to check.
- **Before committing:** Run `npm run check` (lint + type-check + tests).

## Commits

- Write clear commit messages: summary line describing the "why", then details if needed.
- Do not amend previous commits — create new ones.
- All commits are GPG-signed (configured globally).

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Type-check + production build
- `npm test` — Run test suite
- `npm run test:coverage` — Run tests with coverage report
- `npm run test:watch` — Run tests in watch mode
- `npm run lint` — Run ESLint
- `npm run lint:fix` — Run ESLint with auto-fix
- `npm run check` — Lint + type-check + tests (run before committing)
- `npm run preview` — Preview production build
