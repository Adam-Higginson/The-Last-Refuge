// colourUtils.ts — Shared colour mapping for relationship levels.
// Used by CrewDetailUIComponent and RelationshipGraphComponent.

/** Returns a CSS colour string for a relationship level (0–100). */
export function getRelationshipColour(level: number): string {
    if (level <= 25) return '#cc4444';   // red — hostile
    if (level <= 50) return '#cc8844';   // orange — tense
    if (level <= 75) return '#ccaa44';   // yellow — neutral/warm
    return '#44cc66';                     // green — strong/loving
}
