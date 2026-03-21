# Future Work

## Combat System (BSG Crisis Deck)

1. **Ambush missions** — Player orders scout to set ambush at terrain feature (asteroid field, debris). If Extiris passes through, encounter triggers with +3 difficulty bonus. Transforms combat from reactive to proactive. Needs terrain features as entities. Effort: L, Priority: P2. Blocked by: core combat PRs 1-4 + terrain features.
2. **Colony defense encounters** — When Extiris reaches colony sensor range, colony defense crisis triggers. Colony-stationed crew only. New crisis cards: perimeter breach, orbital bombardment warning. Higher difficulty, more crew slots. Effort: L, Priority: P1. Blocked by: core combat PRs 1-4.
3. **Ship confrontation encounters** — When Extiris catches ESV-7, multi-turn crisis sequence. Ship systems as "crew" slots (engines, shields, sensors). Effort: XL, Priority: P2. Blocked by: core combat PRs 1-4 + colony defense.

## Scout Ships

5. **Scout fuel/range tether** — Scouts track fuel (5 turns of movement). Refuel by returning to ship within docking radius. Effort: M, Priority: P2. Blocked by: scouts shipping.
6. **Fleet management sidebar evolution** — Expand sidebar to full fleet manager as more ship types are added (station shuttles, built scouts). Group commands, formation presets, status filters. Effort: L, Priority: P2. Blocked by: station + scout building.

## Relationship System

1. **Dynamic relationship evolution** — Levels shift based on game events, proximity, player decisions. Phase 5 core. Effort: XL, Priority: P2. Blocked by: dynamic relationships.
2. **Graph reacts to game events** — Node fades on death, colour shifts on morale change, edge pulses on relationship change. Effort: L, Priority: P3. Blocked by: dynamic relationships.
3. **Relationship-driven narrative events** — Level thresholds trigger confrontations, morale events, loyalty arcs. Effort: XL, Priority: P2. Blocked by: dynamic relationships.
4. **Depletion countdown in tooltip** — Show "Depletes in ~N turns" in ResourceBarUIComponent tooltip when net rate < 0. Simple math: `Math.ceil(current / Math.abs(netRate))`. Effort: S, Priority: P3.
5. **Crew event log in detail panel** — Timeline of significant events per crew member (transferred, appointed, morale shifts, relationship changes). Builds on backstory as living narrative. Effort: L, Priority: P3. Blocked by: dynamic relationships.
