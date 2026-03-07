# The Last Refuge — Phase 1 Build Spec

## Overview

Build a browser-based game (single HTML file + JS modules) for the opening scene of The Last Refuge. Humanity's remnants have escaped on a stolen Extiris slaver ship. They've found a habitable system. This is where the game begins.

## Tech Stack

- HTML5 Canvas for all rendering
- Vanilla JavaScript (ES modules), no frameworks
- Single entry point: `index.html`
- Modular structure: separate JS files for rendering, state, entities, UI

### File Structure

```
/
  index.html
  src/
    main.js         <- entry, game loop
    state.js        <- game state object
    renderer.js     <- all canvas drawing
    ship.js         <- ship entity + movement
    humans.js       <- crew generation + relationships
    planet.js       <- planet + biome data
    ui.js           <- HUD, panels, transitions
    events.js       <- turn resolution (stub for now)
  data/
    names.js        <- name lists for procedural generation
```

---

## View 1: System Map

### Camera & Canvas

- Full browser window canvas, responsive to resize
- Dark space background: deep black with subtle, realistic star field
  - Two layers of stars: distant (tiny, dim, many) and closer (slightly larger, brighter, fewer)
  - Very subtle blue/purple nebula wash in the background — painted with radial gradients, not garish
- No grid. No UI chrome on the canvas itself. Clean space.

### The Star

- Rendered at the centre of the canvas
- A warm G-type yellow-white star
- Soft multi-layered glow effect (several concentric radial gradients, outermost very faint)
- Subtle animated pulse — very slow, gentle brightness oscillation
- Corona effect: faint rays or halo, not cartoon-like

### New Terra

- Single habitable planet orbiting the star
- Orbit radius: roughly 35% of the smaller canvas dimension
- Animated: planet moves along its orbit in real time (slow, graceful)
- Planet appearance:
  - Blue-green with cloud wisps (suggest oceans and continents)
  - Subtle atmospheric glow on the limb facing the star
  - Small shadow on the side facing away from star
- On hover: soft highlight ring appears, cursor changes to pointer
- On click: triggers transition to Planet View (see View 2)

### The Ship

- Represents the stolen Extiris slaver ship
- Small, angular silhouette — slightly alien geometry (not a clean human design)
- Rendered as a vector shape on canvas (no sprites needed)
- Starts positioned near the edge of the canvas, not near the planet
- Has a visible movement range radius — a faint, dashed circle showing how far it can move this turn
- Right-click anywhere within the radius to move the ship to that point
- Movement is animated: ship glides smoothly to the target position
- Movement budget: ship has a fixed distance it can travel per turn (e.g. radius = 300px). Each move subtracts from the remaining budget. Remaining range circle shrinks accordingly.
- Ship facing: ship rotates to face its direction of travel during movement
- On click (left): opens the Ship Panel (see UI)

### HUD

- Minimal. Dark semi-transparent panel anchored to bottom of screen.
- Shows:
  - Turn number (e.g. "TURN 01")
  - Remaining movement budget as a subtle bar or distance readout
  - "END TURN" button — when clicked, advances the turn: planet moves forward in orbit, movement budget resets
- Top-right corner: small crew count indicator ("50 SOULS ABOARD")
- Font: monospace, slightly cold. Suggest 'Share Tech Mono' or 'Courier New' as fallback.

---

## View 2: Planet View

### Transition

- Clicking New Terra triggers a cinematic zoom transition:
  - The planet grows to fill the canvas over ~1.5 seconds
  - Fade to black briefly
  - Planet View fades in
- A "back" button (top-left) returns to System Map with a reverse transition

### Planet Surface Map

- Top-down 2D map of New Terra's surface
- Planet is divided into regions (suggest 7-10 regions)
- Each region has a biome type — rendered with distinct colour and texture:
  - **Temperate Plains** — soft greens
  - **Arctic Wastes** — pale blue-white
  - **Dense Jungle** — deep emerald
  - **Volcanic Highlands** — dark red/orange
  - **Ocean** — deep blue (cannot be colonised)
- Regions are irregular polygons (Voronoi-style, not a grid)
- Region borders: subtle dark lines
- On hover: region highlights with a faint glow, shows biome name in a tooltip
- One region is pre-marked as the Landing Zone candidate — highlighted in gold, marked "HABITABLE LANDING ZONE"

### Colonise Action

- When the ship is within colonisation range of New Terra (close enough on the system map), a "COLONISE" button appears on a region when it is hovered
- Clicking COLONISE on a region:
  - Opens a confirmation modal: "Establish first colony on [Biome Name] terrain? This will commit 50 souls to the surface."
  - Confirm -> triggers colony establishment (state update, visual change on region — settlement icon appears)
  - This is the primary win condition for Phase 1: establish the first colony

---

## The Humans System

### Generation

- Generate exactly 50 humans procedurally at game start
- Each human has:
  - Full name (first + last, varied cultural backgrounds — humanity's remnant is diverse)
  - Age (18-65, weighted toward 25-45)
  - Role (Engineer, Soldier, Medic, Scientist, Civilian — distributed roughly: 10 Engineers, 8 Soldiers, 5 Medics, 5 Scientists, 22 Civilians)
  - Morale (start between 40-70 — these people are traumatised but alive)
  - 2 traits selected from a list (e.g. Stubborn, Empathetic, Reckless, Analytical, Protective, Haunted, Resourceful, Quiet, Hopeful, Grieving)

### Relationships

- Generate a relationship web at start:
  - Each human has 1-3 relationships with other humans
  - Relationship types: Close Bond, Romantic, Mentor/Protege, Rival, Estranged
  - Ensure no orphans (every human has at least 1 relationship)
  - A few pre-seeded named characters with designed relationships (see below)

### Pre-seeded Characters

These specific individuals exist in the crew. Generate the rest around them:

| Name | Age | Role | Traits | Key Relationship |
|------|-----|------|--------|------------------|
| Mira Chen | 22 | Soldier | Determined, Reckless | Close Bond with Yael Chen |
| Dr. Yael Chen | 51 | Medic | Protective, Analytical | Close Bond with Mira (her daughter) |
| Commander Soren Vael | 38 | Soldier | Stubborn, Resourceful | Mentor to Mira Chen |
| Lt. Desta Morrow | 29 | Soldier | Haunted, Empathetic | Romantic with Soren Vael |

---

## UI Panels

### Ship Panel (opens on left-click of ship)

- Slides in from the right
- Header: ship name — "ESV-7 (Unnamed)" with a note: "Extiris Slaver Vessel, designation unknown. Captured during the Keth-7 exodus."
- Crew manifest: scrollable list of all 50 humans
  - Each row: Name | Role | Morale indicator (coloured dot) | Age
  - Rows are clickable
- Close button (X)

### Individual Panel (opens on clicking a crew member)

- Replaces or overlays the Ship Panel
- Shows:
  - Full name (large)
  - Age, Role
  - Traits (displayed as small tags)
  - Morale bar
  - Relationships list: each relationship shows the other person's name, relationship type, and a one-line description (e.g. "Close Bond — Mira trusts Soren more than anyone aboard")
  - A back arrow to return to the crew manifest

---

## Game State Object

```javascript
// state.js
export const state = {
  turn: 1,
  phase: 'system', // 'system' | 'planet' | 'transitioning'

  ship: {
    x: 0,           // canvas position
    y: 0,
    angle: 0,       // facing direction in radians
    movementBudget: 300,    // px remaining this turn
    movementMax: 300,
    selected: false,
  },

  planet: {
    name: 'New Terra',
    orbitAngle: 0,        // current position in orbit (radians)
    orbitSpeed: 0.002,    // radians per turn
    orbitRadius: 0,       // set on init from canvas size
    colonised: false,
    regions: [],          // generated on init
  },

  humans: [],             // array of 50 human objects

  ui: {
    shipPanelOpen: false,
    selectedHuman: null,
    planetViewActive: false,
  },

  flags: {
    firstColonyEstablished: false,
  }
};
```

---

## Turn Resolution

On "END TURN":

1. Advance `planet.orbitAngle` by `orbitSpeed`
2. Reset `ship.movementBudget` to `movementMax`
3. Increment turn counter
4. (Stub) Fire any pending events — none in Phase 1, but the hook should exist
5. Re-render

---

## Aesthetic Notes

- **Colour palette:** Near-black space (`#03040a`), cold blue UI accents (`#4fa8ff`), warm star glow (`#fff4c2` -> `#ff9500`), New Terra blues/greens
- **Typography:** Monospace throughout. Share Tech Mono (Google Fonts) with Courier New fallback. Cold, functional, slightly alien.
- **No rounded corners** on UI panels. Sharp edges. This is a military vessel.
- **Animations** should feel weighty. The ship doesn't snap to position — it glides. Transitions don't flash — they breathe.
- **Sound:** None in Phase 1. Leave hooks for later.

---

## Out of Scope for Phase 1

- Fuel / hyperlane travel
- Multiple systems
- Extiris faction and advance
- Combat
- Resource tracking (Population, Energy, Influence)
- Technology tree
- Faction diplomacy
- Events system (beyond the hook)
- Save / load

---

## Definition of Done

Phase 1 is complete when:

1. The system map renders with star, orbiting New Terra, and the ship
2. The ship can be right-click moved within its range radius
3. End Turn advances the orbit and resets movement
4. Clicking New Terra transitions to the planet view showing biomes
5. The ship panel opens showing all 50 crew members
6. Clicking a crew member shows their details and relationships
7. When the ship is close to New Terra, a region can be colonised
8. Colonisation confirmation modal works and updates state
