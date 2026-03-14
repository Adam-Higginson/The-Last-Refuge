# The Last Refuge — Phase 2 Build Spec

## Overview

Expand the star system into a full, explorable space. Multiple planets orbit at realistic distances. The camera supports zoom and pan to navigate the larger world. A fog of war system requires the ship to scan its surroundings — knowledge fades when the ship moves away. All planets can be viewed up close, though only New Terra is colonisable for now.

Phase 2 builds on the camera/viewport system introduced after Phase 1, which established a fixed world coordinate space with camera transforms.

---

## World Scale

### Coordinate Space

- **WORLD_SIZE:** Increase from `1000` to `10000` logical units
- Origin remains at `(0, 0)` — the star
- Camera system scales to fit; zoom level determines how much of the world is visible at once

### Orbital Distances

Planets are spaced at realistic relative distances. Inner rocky worlds are closer together; outer gas giants are far apart with vast empty space between them.

| Planet | Type | Orbit Radius | Size (world units) |
|--------|------|-------------|-------------------|
| Ember | Rocky (volcanic) | 800 | 12 |
| New Terra | Rocky (habitable) | 1500 | 18 |
| Dust | Rocky (barren) | 2400 | 14 |
| Goliath | Gas giant | 4500 | 55 |
| Shepherd | Gas giant (ringed) | 7200 | 40 |

Optional: An asteroid belt between Dust and Goliath at radius ~3200-3600, rendered as scattered small dots.

---

## Camera System — Zoom & Pan

### Zoom

- **Scroll wheel:** Zoom in/out, centred on mouse cursor position
- **Pinch gesture:** Zoom in/out on mobile (two-finger pinch)
- **Zoom range:** Min zoom shows the entire system (~0.05x). Max zoom shows fine detail (~2.0x). Default zoom starts showing the inner system (star + New Terra orbit visible).
- **Smooth zoom:** Interpolate zoom level over ~200ms for a fluid feel, not instant snapping
- **Zoom-to-cursor:** The world point under the cursor stays fixed during zoom — the camera pans to compensate

### Pan

- **Middle-click drag** or **right-click drag** on empty space: Pan the camera
- **Touch drag** (single finger on empty space): Pan on mobile
- **Pan limits:** Soft-clamp so the star remains reachable — prevent panning infinitely into void
- Right-click on the **ship's movement range** still moves the ship (not pan). Pan only triggers on empty space outside interactive entities.

### Camera Component Updates

Extend `CameraComponent` with:
- `zoomLevel` — current zoom multiplier (default 1.0)
- `targetZoomLevel` — for smooth interpolation
- `panX`, `panY` — world-space offset of camera centre from origin
- Updated `scale` calculation: `baseScale * zoomLevel` where `baseScale = Math.min(canvasWidth, canvasHeight) / WORLD_SIZE`
- Updated `offsetX/Y` to incorporate pan offset
- `worldToScreen` / `screenToWorld` updated to account for zoom and pan

### Minimap

- Small minimap in bottom-right corner showing the full system at a glance
- Current viewport shown as a rectangle outline on the minimap
- Ship position shown as a bright dot
- Fog of war reflected on minimap (unrevealed areas dark)
- Click on minimap to centre camera on that location

---

## Multiple Planets

### Planet Data

Each planet has:
- **Name** — thematic (Ember, New Terra, Dust, Goliath, Shepherd)
- **Type** — Rocky or Gas Giant
- **Size** — world-unit radius for rendering
- **Orbit radius** — distance from star
- **Orbit speed** — outer planets orbit slower (Kepler-ish: speed proportional to `1 / sqrt(radius)`)
- **Colour palette** — distinct visual identity per planet
- **Colonisable** — boolean, only New Terra for Phase 2
- **Surface regions** — only generated for planets that can be viewed up close (all planets in Phase 2)

### Planet Appearances

| Planet | Visual Description |
|--------|-------------------|
| Ember | Dark red-orange surface, faint volcanic glow, no atmosphere haze |
| New Terra | Blue-green with cloud wisps, atmospheric glow on star-facing limb (existing) |
| Dust | Pale tan/grey, cratered, thin dusty atmosphere ring |
| Goliath | Amber and cream bands, Great-Storm-style spot, thick atmosphere glow |
| Shepherd | Pale blue-green bands, prominent ring system rendered as thin ellipse |

### Planet View

- All planets support the zoom/view transition (click planet -> planet surface view)
- Non-colonisable planets show surface regions with biome data but no COLONISE button
- Gas giants show a swirling atmospheric view instead of a terrain map — bands of colour, storm features. No regions, no colonise. Informational only ("Atmospheric composition: Hydrogen, Helium...").
- Planet view shows a data panel with planet stats: name, type, size classification, orbital period, surface conditions summary

### Entity Factory

- Rename `createPlanet.ts` to create New Terra specifically, or generalise to accept planet config
- Create a `createSolarSystem.ts` (or similar) that spawns all planets from a config array
- Each planet entity has: `TransformComponent`, `OrbitComponent`, `SelectableComponent`, `DrawComponent`, plus planet-specific data component

---

## Fog of War

### Concept

The star system is initially hidden. The ship reveals its surroundings as it moves through space. Knowledge is strongest near the ship and fades when the ship moves away, representing the crew's limited sensor range on an unfamiliar alien vessel.

### Visibility States

Each point in the world can be in one of three states:

1. **Hidden** — Never been scanned. Rendered as solid black (space). Entities in hidden space are invisible.
2. **Revealed** — Previously scanned but the ship has since moved away. Rendered with a greyed-out desaturation filter. Entities are visible but dimmed — their last known position is shown (planets will have moved since). A subtle label or indicator could show "LAST KNOWN POSITION".
3. **Active** — Within the ship's current scan radius. Full colour, real-time positions. This is the only state where interaction is possible (clicking planets, seeing accurate positions).

### Scan Radii

The ship has two concentric scan zones:

- **Detail radius** (~600 world units): Full visibility. Entities rendered at full detail with accurate real-time positions. Interaction enabled (click to view, colonise, etc.).
- **Blip radius** (~1200 world units): Outer ring beyond detail radius. Entities appear as simple blips — a dot and a name label, but no detail. Planets show as coloured circles without surface detail. Cannot interact (no click). Conveys "something is out there" without full knowledge.

### Pre-revealed Area

At game start, the area around the ship's starting position is pre-revealed:
- The star and New Terra's full orbit are within the active zone (or pre-revealed if the ship starts further out)
- This gives the player immediate context — they can see the star and the planet they're heading toward
- Everything beyond this starting bubble is hidden

### Rendering

- **Fog overlay:** Render fog as a full-screen overlay after the world layer. Use canvas compositing (`globalCompositeOperation`) to mask out revealed/active areas.
- **Active zone:** Clear circle around the ship — no fog, full colour
- **Blip zone:** Semi-transparent dark overlay with entity blips poking through
- **Revealed zones:** The fog is lighter than hidden areas but still visibly dimmed. Apply a desaturation or opacity reduction to previously revealed regions.
- **Fog edge:** Soft gradient at the boundary of active/blip/hidden zones — not a hard circle cutoff

### Fog Data Structure

- Track visibility on a grid or per-entity basis
- Option A: **Tile grid** — divide world into cells (~100x100 grid for a 10000-unit world), each cell tracks its visibility state. Simple, works well with canvas masking.
- Option B: **Per-entity tracking** — each entity tracks its own visibility state. Simpler for small entity counts but doesn't handle empty-space revelation.
- **Recommended: Tile grid** — allows revealing empty space (showing there's nothing there is itself information) and works naturally with overlay rendering.

### Fog Updates

- Each frame, update the grid cells within the ship's scan radii to "active"
- Cells that were "active" last frame but are now outside scan range transition to "revealed"
- Revealed cells stay revealed permanently (greyed out but not re-hidden)

---

## Ship Updates

### Movement in Larger World

- Movement budget increases proportionally with world size — perhaps `800` world units per turn (tunable)
- Ship movement animation speed scales with distance to maintain consistent travel feel
- Movement range circle rendered in world space (already works with camera system)

### Scan Visualisation

- Faint concentric circles around the ship showing detail and blip radii
- These circles are subtle — dashed lines or very low opacity
- Only visible when the ship is selected, to avoid clutter

---

## Turn Resolution Updates

On "END TURN":

1. Advance all planet orbit angles (each at its own speed)
2. Reset ship movement budget
3. Increment turn counter
4. Update fog of war — mark cells outside scan range as "revealed" (from "active")
5. (Stub) Fire any pending events
6. Re-render

---

## HUD Updates

- Movement budget display remains
- Add zoom level indicator (subtle, perhaps "1.0x" in corner)
- Turn counter remains
- "END TURN" button remains
- Crew count remains
- Consider adding a "CENTRE ON SHIP" button to quickly navigate back to the ship after panning

---

## Aesthetic Notes

- Maintain Phase 1 colour palette and typography
- Gas giants should feel grand — large, colourful, atmospheric
- Fog of war should feel mysterious, not punishing — soft edges, not harsh blackout
- The transition from hidden to revealed to active should feel like peeling back layers
- Zoom should feel smooth and weighty, matching the existing animation philosophy
- Ring system on Shepherd rendered as a thin tilted ellipse with slight transparency

---

## Out of Scope for Phase 2

- Resource extraction from planets
- Building structures (listening posts, mining stations)
- Multiple star systems / hyperlane travel
- Extiris faction and advance timer
- Combat encounters
- Technology tree
- Expanding fog of war via buildings (listening posts come later)
- Asteroid mining
- Save / load

---

## Implementation Order

### Step 1: World Scale & Camera Zoom/Pan
- Increase WORLD_SIZE to 10000
- Add zoom (scroll wheel + pinch) and pan (drag) to CameraComponent
- Update InputSystem for zoom/pan input handling
- Adjust existing entity positions for new scale
- Verify at desktop and mobile sizes

### Step 2: Multiple Planets
- Create planet configuration data structure
- Generalise planet entity creation to support multiple planets
- Implement distinct planet appearances (colours, sizes, atmospheric effects)
- Add gas giant rendering (bands, rings for Shepherd)
- All planets orbit at correct speeds and distances

### Step 3: Planet View for All Planets
- Extend planet view transition to work for any planet
- Rocky planets show Voronoi surface regions (existing system)
- Gas giants show atmospheric view (no regions)
- Add planet info panel with stats
- Only New Terra shows COLONISE button

### Step 4: Fog of War
- Implement tile grid visibility tracking
- Render fog overlay with soft edges
- Active zone (full visibility) around ship
- Blip zone (outer ring, simplified entity rendering)
- Pre-reveal starting area
- Update fog state on turn end

### Step 5: Minimap
- Render minimap in corner showing full system
- Show viewport rectangle, ship position, planet positions
- Reflect fog of war state
- Click-to-navigate

### Step 6: Polish & Tuning
- Tune zoom limits, pan bounds, movement budget
- Scan radius visualisation on selected ship
- "CENTRE ON SHIP" HUD button
- Visual verification at multiple viewport sizes
- Performance testing with fog overlay

---

## Definition of Done

Phase 2 is complete when:

1. Five planets orbit the star at distinct distances with unique visual appearances
2. Camera zoom (scroll/pinch) and pan (drag) navigate the larger system smoothly
3. All planets can be clicked to enter planet view (surface for rocky, atmosphere for gas giants)
4. Fog of war hides unexplored space; ship reveals surroundings as it moves
5. Previously scanned areas appear greyed out when the ship moves away
6. Blip zone shows simplified planet indicators at the edge of scan range
7. Minimap shows full system overview with fog state and viewport indicator
8. All Phase 1 functionality still works (ship movement, turn system, colonisation on New Terra)
9. Mobile touch input works for zoom, pan, and all interactions
10. `npm run check` passes (lint + type-check + tests)
