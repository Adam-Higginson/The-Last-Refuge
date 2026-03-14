# The Last Refuge — Phase 3 Build Spec

## Overview

Deepen the colony experience from a single click into a full building and resource loop. Crew members are assigned between ship and colonies, each colony has a leader, and buildings produce and consume resources. Non-habitable planets support automated outposts that generate resources without crew. The player must balance limited population across competing priorities.

Phase 3 builds on the colonisation system from Phase 1 and the multi-planet system from Phase 2.

---

## Resources

### Resource Types

| Resource | Description | Sources | Consumed By |
|----------|-------------|---------|-------------|
| **Food** | Feeds population. Colonies and ship consume food each turn. Starvation causes morale loss and eventually death. | Farms (colony), Hydroponics Bay (ship) | All population (1 Food per person per turn) |
| **Materials** | Raw construction resources. Used to build structures. | Mining Rig (colony/outpost), Mineral Extractor (outpost), Salvage Bay (ship) | Building construction, repairs |
| **Energy** | Powers structures and the ship. Unpowered buildings stop functioning. | Solar Array (colony), Geothermal Tap (outpost), Ship Reactor (passive) | All active buildings (variable per building), ship systems |

### Resource Storage

- Resources are **global** — shared across ship and all colonies (hand-wave: shuttle transport between locations is abstracted away).
- Each resource has a **storage cap** determined by storage buildings. Excess production is lost.
- Starting storage caps are provided by the ship (modest — enough for early game).
- Building **Warehouses** (colony) or **Cargo Expansion** (ship) increases caps.

### Starting Resources

| Resource | Starting Amount | Starting Cap |
|----------|----------------|--------------|
| Food | 100 | 200 |
| Materials | 50 | 150 |
| Energy | 80 | 200 |

### Per-Turn Cycle

On END TURN, resources are resolved in this order:
1. **Production** — all active buildings generate their output
2. **Consumption** — food consumed by population, energy consumed by buildings
3. **Deficit check** — if food < 0: morale drops sharply. If energy < 0: random buildings go offline until next turn
4. **Cap check** — excess resources above storage cap are lost
5. **UI update** — resource bar updates with net change indicators (+/- per turn)

---

## Crew Assignment

### Ship vs Colony

Every crew member is assigned to exactly one location:
- **The Ship** — maintains ship systems, enables scanning, navigation
- **A Colony** — works in the colony based on their role

Crew can be **transferred** between ship and colonies at any time (no turn cost — abstracted shuttle transport). Transfers take effect immediately.

### Role-Based Productivity

Each role contributes differently depending on assignment:

**On the Ship:**
| Role | Ship Function |
|------|--------------|
| Engineer | Maintains ship systems. Below minimum (3), ship efficiency degrades (slower movement, reduced scan range) |
| Soldier | Bridge crew / security. Below minimum (2), ship cannot move |
| Medic | Treats injuries/illness across all locations |
| Scientist | No ship function yet (Phase 4: research) |
| Civilian | No ship function. Passengers only. |

**In a Colony:**
| Role | Colony Function |
|------|----------------|
| Engineer | Construction speed. Each engineer in a colony with a pending build order speeds construction. Also required to operate Workshops. |
| Soldier | Garrison. Required for defence (future phases). Can also be assigned to exploration. |
| Medic | Colony health. Reduces morale loss from events. 1 medic per 15 colonists recommended. |
| Scientist | No colony function yet (Phase 4: operates Research Labs) |
| Civilian | Operates Farms and basic buildings. The backbone of colony labour. |

### Minimum Crew Requirements

- **Ship minimum:** 2 Soldiers + 3 Engineers = 5 crew. Below this, ship systems degrade.
- **Colony minimum:** 5 crew + 1 leader to found. Below 3 crew (excluding leader), colony output halves.
- **Building staffing:** Each building requires a number of assigned workers to operate at full capacity. Understaffed buildings produce at reduced rates.

---

## Colony Leaders

### Appointment

- Each colony must have exactly one **Colony Leader** — appointed when the colony is founded or when a vacancy occurs.
- Any crew member can be leader regardless of role.
- The leader does not count toward building staffing — they manage, not labour.
- Leaders can be **reassigned** at any time (swap leaders between colonies, or demote back to worker).

### Leader Bonuses

The leader's role provides a passive bonus to their colony:

| Leader Role | Colony Bonus |
|-------------|-------------|
| Soldier | +20% garrison effectiveness, +5 colony morale |
| Engineer | -20% construction time (rounded up), -10% material cost |
| Medic | +10 colony morale, slower morale decay |
| Scientist | +1 Data per turn (Phase 4 hook — no effect yet) |
| Civilian | +20% food production, +1 population capacity |

### Leader Traits

Leader traits provide additional modifiers (selected examples):
- **Resourceful** — -10% material cost on all construction
- **Protective** — colony takes less damage from events
- **Analytical** — +10% building efficiency
- **Hopeful** — +5 morale to all colonists
- **Stubborn** — +10 morale under crisis, -5 morale normally
- **Haunted** — -5 morale, but colonists gain Empathetic trait bonus if present

Trait effects are displayed in the colony info panel but the social simulation layer (approval, relationship-driven effects) is deferred to Phase 5.

### Ship Captain

- The ship also has a **Captain** — one designated crew member.
- Captain role bonus works the same as colony leader but applies to ship operations.
- A Soldier captain gives movement bonus; an Engineer captain gives scan range bonus; etc.
- If no captain is assigned, ship operates at base efficiency.
- At game start, **Commander Soren Vael** is the default captain.

---

## Colony Buildings

### Building System

- Buildings are placed on **colonised regions** of habitable planets (New Terra only for now).
- Each region supports a limited number of building **slots** (based on region size — typically 4-6 slots per region).
- Buildings are constructed over multiple turns (construction time varies by building type).
- Construction requires **Materials** (upfront cost) and **Engineers** in the colony.
- Buildings consume **Energy** each turn while active.
- Buildings can be **disabled** (stops consumption and production) or **demolished** (returns partial materials).

### Building Types

#### Tier 1 — Available Immediately

| Building | Cost | Build Time | Energy/Turn | Workers | Effect |
|----------|------|-----------|-------------|---------|--------|
| **Shelter** | 10 Materials | 1 turn | 0 | 0 | Houses 10 colonists. Required for population. |
| **Farm** | 15 Materials | 2 turns | 1 | 2 Civilians | Produces 8 Food/turn |
| **Solar Array** | 20 Materials | 2 turns | 0 (produces) | 1 Engineer | Produces 10 Energy/turn |
| **Storage Depot** | 20 Materials | 2 turns | 1 | 0 | +100 to all resource caps |

#### Tier 2 — Requires 1 Colony Established

| Building | Cost | Build Time | Energy/Turn | Workers | Effect |
|----------|------|-----------|-------------|---------|--------|
| **Workshop** | 25 Materials | 3 turns | 3 | 2 Engineers | Produces 6 Materials/turn (refining local resources) |
| **Med Bay** | 30 Materials | 3 turns | 2 | 1 Medic | +15 colony morale, heals injuries |
| **Barracks** | 20 Materials | 2 turns | 2 | 0 | Houses 5 Soldiers, enables garrison |
| **Hydroponics Bay** | 35 Materials | 3 turns | 4 | 1 Engineer | Produces 12 Food/turn (more efficient than Farm, but energy-hungry) |

#### Ship Buildings (upgrades to the ship)

| Building | Cost | Build Time | Energy/Turn | Effect |
|----------|------|-----------|-------------|--------|
| **Cargo Expansion** | 30 Materials | 2 turns | 0 | +150 to all resource caps |
| **Salvage Bay** | 25 Materials | 3 turns | 2 | Produces 3 Materials/turn from ship recycling |
| **Ship Hydroponics** | 30 Materials | 3 turns | 3 | Produces 5 Food/turn on the ship |
| **Improved Reactor** | 40 Materials | 4 turns | 0 (produces) | Ship passive Energy +15/turn |

Ship buildings occupy **ship module slots** (start with 4 empty slots).

### Construction Process

1. Player selects a colonised region and opens the **Colony View**
2. Player clicks an empty building slot
3. A **Build Menu** shows available buildings (filtered by tier requirements and resources)
4. Player selects a building — Materials are deducted immediately
5. Construction begins — a progress bar shows turns remaining
6. Each turn, if the colony has Engineers, construction progresses (more Engineers = not faster per building, but allows parallel construction of multiple buildings)
7. When complete, the building activates and begins producing/consuming

### Staffing

- Each building with a worker requirement must have crew assigned to it
- Unstaffed buildings are **idle** — no production, no consumption
- Partially staffed buildings produce at proportionally reduced output
- Crew are assigned to buildings through the Colony Management panel

---

## Automated Outposts (Non-Habitable Planets)

### Concept

Ember, Dust, Goliath, and Shepherd cannot support human life, but automated outposts can be built remotely. These are unmanned facilities controlled from the ship.

### Building Outposts

- Ship must be within **colonise range** of the planet
- Player enters planet view and selects a region (for rocky planets) or the planet itself (for gas giants)
- Outpost buildings cost **Materials** and **Energy** to construct
- Construction time applies (progresses each turn automatically — no engineers needed)
- Once built, outposts produce resources passively each turn

### Outpost Buildings

| Planet | Building | Cost | Build Time | Output |
|--------|----------|------|-----------|--------|
| Ember | **Geothermal Tap** | 30 Materials | 3 turns | 8 Energy/turn |
| Ember | **Mineral Extractor** | 25 Materials | 3 turns | 4 Materials/turn |
| Dust | **Mining Rig** | 20 Materials | 2 turns | 5 Materials/turn |
| Goliath | **Gas Harvester** | 40 Materials | 4 turns | 10 Energy/turn |
| Shepherd | **Gas Harvester** | 40 Materials | 4 turns | 8 Energy/turn |

#### Listening Post (Available on All Planets)

| Building | Cost | Build Time | Output |
|----------|------|-----------|--------|
| **Listening Post** | 35 Materials | 4 turns | Expands fog of war radius by 500wu around the planet |

- Can be built on **any planet** (habitable or not) — one per planet
- On habitable planets, occupies a building slot in a colonised region (requires a colony)
- On non-habitable planets, built as an automated outpost (no crew needed)
- Listening Posts are the primary way to expand fog coverage beyond the ship's scan range

### Outpost Limits

- Each rocky planet region supports 1 outpost building
- Each gas giant supports 2 outpost buildings total (no regions)
- Outposts have no crew and cannot be expanded beyond their building type
- Outposts can be demolished (returns partial materials)

---

## Colony View (Region Detail)

### Entering Colony View

- From the planet surface view, click a colonised region
- Zooms into the region showing a detailed layout with building slots

### Colony View Layout

- Region fills the screen (similar to how planet view fills the screen)
- Background colour matches the region's biome
- **Building slots** displayed as marked plots in a grid-like arrangement (not a strict grid — organic placement matching the biome)
- Empty slots show a faint outline with a "+" icon
- Occupied slots show the building with a small icon and name
- Buildings under construction show a progress overlay

### Colony Info Panel

- Slides in from the right (like planet/ship info panels)
- Shows:
  - Colony name (auto-generated or player-named)
  - Leader name, role, and bonus
  - Population: assigned crew count / capacity
  - Resource summary: net Food, Materials, Energy for this colony
  - Building list with status (active, idle, under construction)
  - Crew roster for this colony with role assignments

### Build Menu

- Opens when clicking an empty building slot
- Shows available buildings with:
  - Name, icon
  - Cost (Materials)
  - Build time (turns)
  - Energy consumption
  - Worker requirements
  - Production output
- Greyed out if insufficient resources or tier requirements not met
- Confirm button deducts resources and starts construction

### Crew Management Panel

- Accessible from the Colony Info Panel
- Shows all crew at this colony
- Each crew member can be:
  - Assigned to a specific building (if they match the role requirement)
  - Left unassigned (idle — no productivity)
  - Transferred to ship or another colony
- Drag-and-drop or click-to-assign interface

---

## HUD Updates

### Resource Bar

- Add a resource bar to the top of the screen (or expand the bottom HUD)
- Shows: Food (icon + count), Materials (icon + count), Energy (icon + count)
- Each resource shows **net per turn** in green (+) or red (-)
- Clicking a resource shows a breakdown tooltip (sources and drains)

### Population Indicator

- Update "50 SOULS ABOARD" to show split: "23 ABOARD / 27 COLONISTS" (or similar)
- Clicking shows a breakdown by location

---

## Turn Resolution Updates

On END TURN (extending existing resolution):

1. Advance all planet orbit angles
2. Reset ship movement budget
3. Increment turn counter
4. Update fog of war
5. **Progress construction** — reduce remaining build time on all active construction sites
6. **Resource production** — all active buildings generate output
7. **Resource consumption** — food consumed by all population, energy consumed by buildings
8. **Deficit penalties** — if food < 0: morale drops 10 per deficit unit. If energy < 0: random buildings go offline
9. **Cap excess** — discard resources above storage cap
10. **Morale update** — leader bonuses, trait effects, deficit penalties applied
11. Re-render

---

## Data Hooks for Phase 4

Build in the data structures but no gameplay effect yet:
- **Data** resource type (generated by Listening Posts and Scientists, consumed by research)
- **Research queue** field on game state (empty)
- **Tech tree** data structure (empty, but the component exists)
- **Building tier requirements** field that can reference tech unlocks

---

## Aesthetic Notes

- Colony view should feel grounded — earthy colours for the biome, functional building icons
- Building under construction: animated scaffolding/progress bar overlay
- Resource bar: clean, minimal, same monospace typography
- Crew management: similar panel styling to existing ship/planet panels
- Outpost buildings on non-habitable planets: industrial, utilitarian icons
- Maintain the cold, functional UI aesthetic — this is survival, not SimCity

---

## Out of Scope for Phase 3

- Tech tree / research system (Phase 4)
- Data resource gameplay effects (Phase 4)
- Social dynamics / leader approval (Phase 5)
- Extiris faction / combat (Phase 5+)
- Multiple star systems / hyperlane travel
- Events system (random events, crises)
- Population growth / reproduction
- Trade between colonies
- Save / load

---

## Implementation Order

### Step 1: Resource System
- Add resource data to game state (Food, Materials, Energy)
- Resource production/consumption per turn
- Resource bar HUD element
- Storage caps and overflow

### Step 2: Crew Assignment
- Crew location tracking (ship vs colony)
- Transfer UI (move crew between ship and colonies)
- Role-based minimum requirements and warnings
- Population indicator update

### Step 3: Colony Leaders & Ship Captain
- Leader appointment on colony founding
- Leader role bonus system
- Leader trait modifiers
- Ship captain designation
- Leader info in colony panel

### Step 4: Colony Buildings (Habitable)
- Building slot system on colonised regions
- Build menu with Tier 1 buildings
- Construction over turns
- Building staffing and production
- Tier 2 unlock after first colony established

### Step 5: Colony View
- Region detail zoom (building placement UI)
- Colony info panel
- Crew management within colony
- Build menu interaction

### Step 6: Ship Buildings
- Ship module slot system
- Ship building menu
- Ship upgrades (Cargo Expansion, Salvage Bay, etc.)

### Step 7: Automated Outposts
- Outpost building on non-habitable planets
- Outpost construction and passive production
- Listening Post fog expansion

### Step 8: Individual Hunger & Starvation
- Each crew member tracks a personal hunger level (0-100, starts full)
- When global food is insufficient, crew members lose hunger points each turn
- At hunger 0, the crew member begins starving — morale drops severely
- After N consecutive turns starving (e.g. 3), the crew member dies
- Death triggers relationship grief events in connected crew (Phase 5 hook)
- Well-fed crew (hunger > 80) get a small morale bonus
- Hunger displayed in individual crew panel as a bar alongside morale

### Step 9: Polish & Balance
- Tune resource costs, production rates, build times
- Warning indicators (food shortage, energy deficit, understaffed)
- Net resource display and breakdown tooltips
- Visual polish on colony view and building icons
- Mobile HUD responsiveness (resource bar layout, button sizing, tooltip behaviour on touch)
- Replace native `confirm()` dialogs with styled modals matching the game UI (leader appointment, transfer warnings, ship minimum warnings)
- Reusable confirmation modal component for all game dialogs

---

## Definition of Done

Phase 3 is complete when:

1. Resources (Food, Materials, Energy) are tracked and displayed in the HUD
2. Resources are produced and consumed each turn based on active buildings
3. Crew can be transferred between ship and colonies
4. Each colony has a designated leader with role-based bonuses
5. The ship has a designated captain
6. Colony buildings can be constructed on habitable planet regions (Tier 1 and Tier 2)
7. Buildings require workers and produce resources when staffed
8. Colony view shows building slots with build/manage UI
9. Ship buildings can be constructed in module slots
10. Automated outposts can be built on non-habitable planets
11. Listening Posts expand fog of war
12. Resource deficits cause appropriate penalties (morale, buildings offline)
13. Multiple regions on the same planet can be colonised
14. Crew members have individual hunger levels that deplete during food deficits
15. Starvation kills crew members after consecutive turns without food
16. All Phase 1 and Phase 2 functionality still works
17. `npm run check` passes (lint + type-check + tests)
