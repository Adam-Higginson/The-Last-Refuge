# CLAUDE.md — Project Conventions for The Last Refuge

## Workflow

- When you've finished a task, run `echo -e '\a'` to ring the terminal bell.

## Project Overview

Browser-based game built with HTML5 Canvas + TypeScript. Entity-Component-System architecture with fixed-timestep game loop. See `docs/PHASE1_SPEC.md` for the full build spec.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Build:** Vite
- **Testing:** Vitest
- **No frameworks.** Vanilla TS, ES modules, canvas rendering.

## Architecture

- **ECS pattern:** Entities are numeric IDs with a debug name and a bag of Components. Systems run in explicit order each tick. Two kinds of logic placement:
  - **Systems** for generic cross-entity infrastructure (InputSystem, TurnSystem, RenderSystem, ComponentSystem).
  - **Component lifecycle** for entity-specific behaviour. Components may implement optional `init()`, `update(dt)`, `destroy()` methods, driven by ComponentSystem. Use this for behaviour tied to a single entity type (e.g. MovementComponent, OrbitComponent).
- **Event Queue:** Cross-entity and cross-system communication goes through `EventQueue`. Events are queued and drained once per frame.
- **Service Locator:** Shared services (canvas, ctx, eventQueue, world) are registered and retrieved via `ServiceLocator` — never hardcoded imports of singletons.
- **Game Loop:** Fixed-timestep update (60/sec) with variable rendering. Systems implement `update(dt)` for logic and `render(alpha)` for drawing.

## File Structure

```
src/
  core/           Framework classes (Entity, Component, System, World, GameLoop, EventQueue, ServiceLocator)
  components/     Component classes (data, or data + lifecycle methods for entity-specific behaviour)
  systems/        System classes (generic cross-entity infrastructure)
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
- **Components are data by default.** Entity-specific behaviour may implement optional lifecycle methods (`init`, `update`, `destroy`), driven by ComponentSystem. Use Systems for generic cross-entity infrastructure (InputSystem, TurnSystem, RenderSystem). Use component lifecycle for entity-specific behaviour (MovementComponent, OrbitComponent).

## Testing

- **Framework:** Vitest. Run with `npm test`. Watch mode with `npm run test:watch`.
- **Test location:** Colocated `__tests__` directories next to source (e.g. `src/core/__tests__/Entity.test.ts`).
- **What to test:**
  - All core framework classes (Entity, World, EventQueue, ServiceLocator).
  - All System logic — instantiate real Components, call `update(dt)`, assert state changes.
  - Component lifecycle logic — instantiate component, call `init()`, `update(dt)`, assert state changes.
  - Crew generation invariants (50 humans, correct role distribution, no relationship orphans, pre-seeded characters present).
- **What NOT to test:**
  - Canvas rendering output (verify visually).
  - DOM/HTML panel appearance (verify visually).
- **Coverage:** Enforced on `src/core/` — 80% threshold for branches, functions, lines, statements. Run `npm run test:coverage` to check.
- **Before committing:** Run `npm run check` (lint + type-check + tests).

## Commit Conventions

Follows [Conventional Commits](https://www.conventionalcommits.org/) with project-specific scopes.

### Format

```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### Types

- `feat` — New feature or gameplay functionality
- `fix` — Bug fix
- `refactor` — Code restructuring without behaviour change
- `test` — Adding or updating tests
- `chore` — Build config, dependencies, tooling, CI
- `docs` — Documentation changes
- `style` — Code formatting (no logic change)
- `perf` — Performance improvement

### Scopes

- `core` — ECS framework (Entity, Component, System, World, GameLoop, EventQueue, ServiceLocator)
- `render` — RenderSystem, canvas drawing, visual effects
- `input` — InputSystem, mouse/keyboard handling
- `movement` — MovementSystem, ship movement
- `orbit` — OrbitSystem, planetary orbits
- `ui` — UISystem, HTML panels, HUD
- `crew` — CrewMemberComponent, crew generation, relationships
- `planet` — Planet data, biomes, regions, colonisation
- `data` — Static data files (names, configs)

Scope is optional for broad changes that span multiple areas.

### Rules

- **Subject line:** imperative mood, lowercase, no period, max 72 chars (e.g. `feat(render): add star glow pulse animation`)
- **Body:** explain the "why", not the "what". The diff shows the what.
- **One concern per commit.** Don't mix a feature with a refactor.
- **Do not amend** previous commits — always create new ones.
- All commits are GPG-signed (configured globally).

## Mobile Support

The game supports both desktop (mouse) and mobile (touch) input.

- **Touch events** mirror mouse events. `touchstart`/`touchmove` update coordinates, `touchend` triggers a click. Both InputSystem and PlanetViewInputComponent have their own touch listeners.
- **No pinch-zoom.** Viewport meta sets `maximum-scale=1.0, user-scalable=no`.
- **Proportional positioning.** Entity positions (e.g. ship spawn) must use canvas-proportional offsets (relative to orbit radius), not absolute pixel values, so they work at any screen size.
- **Clamp on resize.** MovementComponent clamps the ship to canvas bounds after resize to prevent it going off-screen on narrow viewports.
- **DOM buttons work automatically.** Browsers synthesise click events from taps, so HUD buttons, panels, and modals need no touch-specific code.
- **Test at mobile size.** After layout or positioning changes, use `preview_resize` with the `mobile` preset (375×812) to verify nothing is off-screen.

## Visual Testing (Claude Preview)

Use Claude Preview to manually test the game in a headless browser during development.

- **Launch config:** `.claude/launch.json` defines the `dev` server (Vite on port 5173).
- **Start the server:** Use `preview_start` with name `"dev"`. Reuses if already running.
- **Screenshot:** Use `preview_screenshot` to check rendering after changes.
- **Interact:** Use `preview_click` to test mouse input (e.g. clicking planets, ships).
- **Inspect:** Use `preview_inspect` to verify DOM elements and computed styles for HTML UI panels.
- **Console:** Use `preview_console_logs` to check for runtime errors.
- **Debug:** Use `preview_eval` to inspect game state (e.g. entity positions, component values).
- **After visual changes:** Always take a screenshot to verify rendering is correct.
- **Note:** On Windows, `npm` is not in the preview tool's PATH. The launch config uses the full path to `node.exe` with `node_modules/vite/bin/vite.js` directly.

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
