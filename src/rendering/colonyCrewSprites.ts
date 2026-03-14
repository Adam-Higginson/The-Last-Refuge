// colonyCrewSprites.ts — Crew sprite figures for the colony scene.
// Small humanoid figures that walk between buildings on dirt paths,
// idle bob when stationary, and head to shelter at dusk/night.

import { getDayNightState } from './colonyDayNight';
import type { ColonySlotRect } from './drawColonyScene';

const ROLE_COLOURS: Record<string, string> = {
    Soldier: '#4fa8ff',
    Civilian: '#66bb6a',
    Engineer: '#c0c8d8',
    Medic: '#ef5350',
    Scientist: '#ffca28',
};

interface CrewSprite {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    colour: string;
    isLeader: boolean;
    speed: number;
    walkPhase: number;
    idleTimer: number;
    /** Index of the slot they're heading toward. */
    targetSlotIdx: number;
    /** Whether they've arrived at shelter for the night. */
    sheltered: boolean;
}

const sprites: Map<number, CrewSprite> = new Map();

/** Reset sprites when leaving colony view. */
export function resetCrewSprites(): void {
    sprites.clear();
}

/**
 * Update and draw crew sprites.
 * Call each frame with the crew data and slot positions.
 */
export function drawCrewSprites(
    ctx: CanvasRenderingContext2D,
    crewData: { id: number; role: string; isLeader: boolean }[],
    slotRects: ColonySlotRect[],
    t: number,
    dtSeconds: number,
): void {
    const dayNight = getDayNightState();
    const isNight = dayNight.phase === 'night';
    const isDusk = dayNight.phase === 'dusk' && dayNight.phaseProgress > 0.6;
    const shouldShelter = isNight || isDusk;

    const occupiedSlots = slotRects.filter(s => s.occupied);
    if (occupiedSlots.length === 0) return;

    // Find the shelter slot (slotIndex 0 is always the auto-shelter)
    const shelterSlot = slotRects.find(s => s.slotIndex === 0 && s.occupied);

    // Limit visible crew to 2-4 on the surface (rest are "inside")
    const visibleCount = Math.min(crewData.length, isNight ? 0 : 4);

    for (let i = 0; i < crewData.length; i++) {
        const crew = crewData[i];
        let sprite = sprites.get(crew.id);

        if (!sprite) {
            // Initialise sprite near a random building
            const startSlot = occupiedSlots[i % occupiedSlots.length];
            const sx = startSlot.x + startSlot.width / 2 + (Math.random() - 0.5) * 20;
            const sy = startSlot.y + startSlot.height * 0.6 + 15;
            sprite = {
                x: sx, y: sy,
                targetX: sx, targetY: sy,
                colour: ROLE_COLOURS[crew.role] ?? '#c0c8d8',
                isLeader: crew.isLeader,
                speed: 15 + Math.random() * 10,
                walkPhase: Math.random() * Math.PI * 2,
                idleTimer: 2 + Math.random() * 5,
                targetSlotIdx: startSlot.slotIndex,
                sheltered: false,
            };
            sprites.set(crew.id, sprite);
        }

        // Don't draw if night (sheltered) or beyond visible limit
        if (i >= visibleCount) {
            sprite.sheltered = true;
            continue;
        }

        // At dusk, head to shelter
        if (shouldShelter && shelterSlot && !sprite.sheltered) {
            sprite.targetX = shelterSlot.x + shelterSlot.width / 2 + (Math.random() - 0.5) * 10;
            sprite.targetY = shelterSlot.y + shelterSlot.height * 0.6 + 10;
            sprite.targetSlotIdx = shelterSlot.slotIndex;

            // Check if arrived at shelter
            const dxS = sprite.targetX - sprite.x;
            const dyS = sprite.targetY - sprite.y;
            if (Math.sqrt(dxS * dxS + dyS * dyS) < 5) {
                sprite.sheltered = true;
                continue;
            }
        }

        // At dawn, unshelter
        if (!shouldShelter && sprite.sheltered) {
            sprite.sheltered = false;
            sprite.idleTimer = 0; // Immediately pick a new target
        }

        if (sprite.sheltered) continue;

        // Movement logic
        const dx = sprite.targetX - sprite.x;
        const dy = sprite.targetY - sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 2) {
            // Walk toward target
            const moveSpeed = sprite.speed * dtSeconds;
            sprite.x += (dx / dist) * Math.min(moveSpeed, dist);
            sprite.y += (dy / dist) * Math.min(moveSpeed, dist);
            sprite.walkPhase += dtSeconds * 8;
        } else {
            // Arrived — idle, then pick new target
            sprite.idleTimer -= dtSeconds;
            if (sprite.idleTimer <= 0) {
                // Pick a random occupied building to walk to
                const nextSlot = occupiedSlots[Math.floor(Math.random() * occupiedSlots.length)];
                sprite.targetX = nextSlot.x + nextSlot.width / 2 + (Math.random() - 0.5) * 30;
                sprite.targetY = nextSlot.y + nextSlot.height * 0.6 + 10 + Math.random() * 10;
                sprite.targetSlotIdx = nextSlot.slotIndex;
                sprite.idleTimer = 3 + Math.random() * 6;
            }
        }

        // Draw the sprite figure
        drawFigure(ctx, sprite, t, dist > 2);
    }
}

function drawFigure(
    ctx: CanvasRenderingContext2D,
    sprite: CrewSprite,
    t: number,
    isWalking: boolean,
): void {
    const x = sprite.x;
    const y = sprite.y;

    // Idle bob when stationary
    const bob = isWalking ? 0 : Math.sin(t / 600 + sprite.walkPhase) * 1;

    // Walk animation — legs alternate
    const legSwing = isWalking ? Math.sin(sprite.walkPhase) * 2.5 : 0;

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 3, 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = sprite.colour;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    // Left leg
    ctx.beginPath();
    ctx.moveTo(x - 1, y - 3 + bob);
    ctx.lineTo(x - 1 - legSwing * 0.5, y);
    ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 3 + bob);
    ctx.lineTo(x + 1 + legSwing * 0.5, y);
    ctx.stroke();

    // Body
    ctx.fillStyle = sprite.colour;
    ctx.beginPath();
    ctx.ellipse(x, y - 5 + bob, 2.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#d8c8b0';
    ctx.beginPath();
    ctx.arc(x, y - 9.5 + bob, 2, 0, Math.PI * 2);
    ctx.fill();

    // Arms (swing when walking)
    const armSwing = isWalking ? Math.sin(sprite.walkPhase + Math.PI) * 2 : 0;
    ctx.strokeStyle = sprite.colour;
    ctx.lineWidth = 1;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 6 + bob);
    ctx.lineTo(x - 3.5 - armSwing * 0.3, y - 3 + bob);
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 6 + bob);
    ctx.lineTo(x + 3.5 + armSwing * 0.3, y - 3 + bob);
    ctx.stroke();

    // Leader crown
    if (sprite.isLeader) {
        ctx.fillStyle = '#d4a020';
        ctx.font = '7px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.fillText('★', x, y - 13 + bob);
    }

    ctx.restore();
}
