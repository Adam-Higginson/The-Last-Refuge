// colonyColonistRenderer.ts — Colonist figure and sub-activity rendering for colony view.
// Extracted from colonyGridRenderer.ts for sub-activity visual variety.
// Hierarchical dispatch: drawActivityVisual → drawWorkingVisual, drawIdleVisual, etc.

import { gridToScreen } from './isometric';
import type { ColonistVisualState } from '../colony/ColonistState';
import type { ColonistScreenPos } from './colonyGridRenderer';

/** Colonist figure scale — larger for visibility on isometric grid. */
const FIGURE_SCALE = 1.8;

/** Draw all colonist figures. Returns screen positions for hit-testing. */
export function drawColonistFigures(
    ctx: CanvasRenderingContext2D,
    colonists: ColonistVisualState[],
    centreX: number,
    centreY: number,
    t: number,
    selectedColonistId: number | null = null,
): ColonistScreenPos[] {
    const positions: ColonistScreenPos[] = [];
    for (const colonist of colonists) {
        const screen = gridToScreen(colonist.gridX, colonist.gridY, centreX, centreY);
        const isWalking = colonist.activity === 'walking' || colonist.activity === 'patrolling';
        const isSelected = colonist.entityId === selectedColonistId;
        drawFigure(ctx, screen.x, screen.y, colonist, t, isWalking, isSelected);
        positions.push({ entityId: colonist.entityId, screenX: screen.x, screenY: screen.y });
    }
    return positions;
}

/** Draw a single colonist figure at screen coordinates. */
export function drawFigure(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colonist: ColonistVisualState,
    t: number,
    isWalking: boolean,
    isSelected: boolean = false,
    nearbyBuildingPos?: { x: number; y: number },
): void {
    const s = FIGURE_SCALE;

    // Sub-activity pose adjustments
    const isSitting = colonist.subActivity === 'sitting' ||
        colonist.subActivity === 'sitting_together' ||
        colonist.subActivity === 'sitting_eating';
    const isStretching = colonist.subActivity === 'stretching';
    const yOffset = isSitting ? 3 * s : 0;

    // Idle bob when stationary
    const bob = isWalking ? 0 : Math.sin(t / 600 + colonist.walkPhase) * 1 * s;

    // Walk animation — legs alternate
    const legSwing = isWalking ? Math.sin(colonist.walkPhase) * 2.5 * s : 0;

    ctx.save();

    // Selection highlight ring
    if (isSelected) {
        const pulseAlpha = 0.3 + 0.2 * Math.sin(t / 400);
        ctx.fillStyle = `rgba(100, 200, 255, ${pulseAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(x, y + 1 * s, 5 * s, 2 * s, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Shadow
    const baseShadowRx = 3 * s;
    let shadowRx = baseShadowRx;
    if (nearbyBuildingPos) {
        const dx = nearbyBuildingPos.x - x;
        const dist = Math.abs(dx);
        const stretch = Math.max(0, 1 - dist / 100) * 0.5;
        shadowRx = baseShadowRx * (1 + stretch);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * s, shadowRx, 1 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sitting: draw legs folded forward
    if (isSitting) {
        ctx.strokeStyle = colonist.skinTone;
        ctx.lineWidth = 1.2 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 1 * s, y - 3 * s + bob + yOffset);
        ctx.lineTo(x - 2 * s, y + yOffset);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 1 * s, y - 3 * s + bob + yOffset);
        ctx.lineTo(x + 2 * s, y + yOffset);
        ctx.stroke();
    } else {
        // Legs — skin-toned
        ctx.strokeStyle = colonist.skinTone;
        ctx.lineWidth = 1.2 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 1 * s, y - 3 * s + bob);
        ctx.lineTo(x - 1 * s - legSwing * 0.5, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 1 * s, y - 3 * s + bob);
        ctx.lineTo(x + 1 * s + legSwing * 0.5, y);
        ctx.stroke();
    }

    // Body — role-coloured clothing
    ctx.fillStyle = colonist.colour;
    ctx.beginPath();
    ctx.ellipse(x, y - 5 * s + bob + yOffset, 2.5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Arms — sub-activity aware
    const armSwing = isWalking ? Math.sin(colonist.walkPhase + Math.PI) * 2 * s : 0;
    drawArms(ctx, x, y + yOffset, colonist, t, s, bob, armSwing, isStretching);

    // Head — skin tone (shifted when looking_around)
    const headShift = colonist.subActivity === 'looking_around'
        ? Math.sin(t / 800 + colonist.walkPhase) * 1.5 * s
        : 0;
    ctx.fillStyle = colonist.skinTone;
    ctx.beginPath();
    ctx.arc(x + headShift, y - 9.5 * s + bob + yOffset, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = colonist.hairColour;
    ctx.beginPath();
    ctx.arc(x + headShift, y - 10 * s + bob + yOffset, 2 * s, Math.PI * 0.85, Math.PI * 0.15, true);
    ctx.fill();

    // Name label
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(5 * s)}px "Share Tech Mono", "Courier New", monospace`;
    ctx.textAlign = 'center';
    const firstName = colonist.name.split(' ')[0];
    ctx.fillText(firstName, x, y - 14 * s + bob + yOffset);
    ctx.globalAlpha = 1;

    // Leader star
    if (colonist.isLeader) {
        ctx.fillStyle = '#d4a020';
        ctx.font = `${Math.round(6 * s)}px "Share Tech Mono"`;
        ctx.textAlign = 'center';
        ctx.fillText('\u2605', x, y - 17 * s + bob + yOffset);
    }

    // Activity icon / sub-activity visual
    const iconBaseY = y - (colonist.isLeader ? 20 : 17) * s + bob + yOffset;
    drawActivityVisual(ctx, x, iconBaseY, colonist, t, s);

    ctx.restore();
}

/** Draw arms with sub-activity awareness. */
function drawArms(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    colonist: ColonistVisualState,
    t: number, s: number, bob: number, armSwing: number,
    isStretching: boolean,
): void {
    ctx.strokeStyle = colonist.skinTone;
    ctx.lineWidth = 1 * s;

    if (isStretching) {
        // Arms raised above head
        ctx.beginPath();
        ctx.moveTo(x - 2 * s, y - 6 * s + bob);
        ctx.lineTo(x - 3 * s, y - 11 * s + bob);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 2 * s, y - 6 * s + bob);
        ctx.lineTo(x + 3 * s, y - 11 * s + bob);
        ctx.stroke();
    } else if (colonist.subActivity === 'hammering') {
        // Right arm raised for hammering, left at side
        const hammerPhase = Math.sin(t / 200 + colonist.walkPhase) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.moveTo(x - 2 * s, y - 6 * s + bob);
        ctx.lineTo(x - 3.5 * s, y - 3 * s + bob);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 2 * s, y - 6 * s + bob);
        ctx.lineTo(x + 2 * s, y - (8 + hammerPhase * 3) * s + bob);
        ctx.stroke();
    } else if (colonist.subActivity === 'watering' || colonist.subActivity === 'checking_patient') {
        // Arm forward
        ctx.beginPath();
        ctx.moveTo(x - 2 * s, y - 6 * s + bob);
        ctx.lineTo(x - 3.5 * s, y - 3 * s + bob);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 2 * s, y - 6 * s + bob);
        ctx.lineTo(x + 4.5 * s, y - 5 * s + bob);
        ctx.stroke();
    } else if (colonist.subActivity === 'carrying') {
        // Both arms raised to shoulder level (carrying box)
        ctx.beginPath();
        ctx.moveTo(x - 2 * s, y - 6 * s + bob);
        ctx.lineTo(x - 1.5 * s, y - 8 * s + bob);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 2 * s, y - 6 * s + bob);
        ctx.lineTo(x + 1.5 * s, y - 8 * s + bob);
        ctx.stroke();
        // Small box
        ctx.fillStyle = '#8b7355';
        ctx.fillRect(x - 2 * s, y - 10 * s + bob, 4 * s, 2.5 * s);
    } else if (colonist.subActivity === 'gesturing') {
        // Wide arm swing
        const gesturePhase = Math.sin(t / 300 + colonist.walkPhase);
        ctx.beginPath();
        ctx.moveTo(x - 2 * s, y - 6 * s + bob);
        ctx.lineTo(x - (4 + gesturePhase) * s, y - 4 * s + bob);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 2 * s, y - 6 * s + bob);
        ctx.lineTo(x + (4 - gesturePhase) * s, y - 7 * s + bob);
        ctx.stroke();
    } else if (colonist.subActivity === 'sitting_eating' || colonist.subActivity === 'eating_standing') {
        // Arm to mouth motion
        const eatPhase = Math.sin(t / 500 + colonist.walkPhase) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.moveTo(x - 2 * s, y - 6 * s + bob);
        ctx.lineTo(x - 3.5 * s, y - 3 * s + bob);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 2 * s, y - 6 * s + bob);
        ctx.lineTo(x + 1 * s, y - (6 + eatPhase * 3) * s + bob);
        ctx.stroke();
    } else {
        // Default arm positions
        ctx.beginPath();
        ctx.moveTo(x - 2 * s, y - 6 * s + bob);
        ctx.lineTo(x - 3.5 * s - armSwing * 0.3, y - 3 * s + bob);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 2 * s, y - 6 * s + bob);
        ctx.lineTo(x + 3.5 * s + armSwing * 0.3, y - 3 * s + bob);
        ctx.stroke();
    }
}

/** Hierarchical dispatch for activity/sub-activity visual effects. */
function drawActivityVisual(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    colonist: ColonistVisualState,
    t: number, s: number,
): void {
    const { activity, subActivity } = colonist;

    // No icon for walking
    if (activity === 'walking') return;

    // Intermittent display — staggered per colonist
    const gate = Math.sin(t / 1500 + colonist.walkPhase);
    if (gate <= 0.3) return;

    const iconY = y - 4 * s;

    ctx.save();
    ctx.globalAlpha = 0.8;

    switch (activity) {
        case 'working':
            drawWorkingVisual(ctx, x, iconY, subActivity, t, s, colonist);
            break;
        case 'socializing':
            drawSocializingVisual(ctx, x, iconY, subActivity, t, s, colonist);
            break;
        case 'eating':
            drawEatingVisual(ctx, x, iconY, s);
            break;
        case 'idle':
            // No overhead icon for idle — pose changes are enough
            break;
        case 'patrolling':
            drawPatrollingVisual(ctx, x, iconY, s);
            break;
        case 'resting':
            drawRestingVisual(ctx, x, iconY, s);
            break;
    }

    ctx.restore();
}

function drawWorkingVisual(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    subActivity: ColonistVisualState['subActivity'],
    t: number, s: number,
    colonist: ColonistVisualState,
): void {
    if (subActivity === 'hammering') {
        // Sparks
        ctx.fillStyle = '#ffcc44';
        const sparkPhase = (t / 200 + colonist.walkPhase) % (Math.PI * 2);
        for (let i = 0; i < 3; i++) {
            const angle = sparkPhase + i * 2.1;
            const sparkX = x + Math.cos(angle) * 3 * s;
            const sparkY = y + Math.sin(angle) * 2 * s;
            ctx.beginPath();
            ctx.arc(sparkX, sparkY, 0.5 * s, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (subActivity === 'watering') {
        // Water drips
        ctx.fillStyle = 'rgba(100, 180, 255, 0.6)';
        const dripPhase = (t / 300) % 1;
        ctx.beginPath();
        ctx.arc(x + 4.5 * s, y - 3 * s + dripPhase * 4 * s, 0.6 * s, 0, Math.PI * 2);
        ctx.fill();
    } else if (subActivity === 'calibrating') {
        // Gear icon
        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 0.8 * s;
        const gearAngle = t / 1000;
        ctx.beginPath();
        ctx.arc(x, y - 2 * s, 2 * s, gearAngle, gearAngle + Math.PI * 1.5);
        ctx.stroke();
    } else {
        // Default wrench
        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 1 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 1.5 * s, y - 5 * s);
        ctx.lineTo(x + 1 * s, y - 1.5 * s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 1 * s, y - 1.5 * s);
        ctx.lineTo(x + 2.5 * s, y - 3 * s);
        ctx.stroke();
    }
}

function drawSocializingVisual(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    subActivity: ColonistVisualState['subActivity'],
    t: number, s: number,
    colonist: ColonistVisualState,
): void {
    if (subActivity === 'laughing') {
        // Body shake + "ha"
        const shakeX = Math.sin(t / 100 + colonist.walkPhase) * 0.5 * s;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = `bold ${Math.round(4 * s)}px "Share Tech Mono"`;
        ctx.textAlign = 'center';
        ctx.fillText('ha!', x + shakeX, y - 1 * s);
    } else if (subActivity === 'chatting') {
        // Alternating speech indicators
        const chatPhase = Math.floor(t / 800) % 2;
        const bw = 8 * s;
        const bh = 5 * s;
        const bx = x - bw / 2;
        const by = y - bh;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.moveTo(bx + 1.5 * s, by);
        ctx.lineTo(bx + bw - 1.5 * s, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 1.5 * s);
        ctx.lineTo(bx + bw, by + bh - 1.5 * s);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 1.5 * s, by + bh);
        ctx.lineTo(bx + 3 * s, by + bh);
        ctx.lineTo(bx + 1.5 * s, by + bh + 1.5 * s);
        ctx.lineTo(bx + 2 * s, by + bh);
        ctx.lineTo(bx + 1.5 * s, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 1.5 * s);
        ctx.lineTo(bx, by + 1.5 * s);
        ctx.quadraticCurveTo(bx, by, bx + 1.5 * s, by);
        ctx.fill();

        ctx.fillStyle = '#333333';
        ctx.font = `bold ${Math.round(4 * s)}px "Share Tech Mono"`;
        ctx.textAlign = 'center';
        ctx.fillText(chatPhase === 0 ? '...' : '!', x, y - 1 * s);
    } else {
        // Default speech bubble
        const bw = 8 * s;
        const bh = 5 * s;
        const bx = x - bw / 2;
        const by = y - bh;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.moveTo(bx + 1.5 * s, by);
        ctx.lineTo(bx + bw - 1.5 * s, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 1.5 * s);
        ctx.lineTo(bx + bw, by + bh - 1.5 * s);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 1.5 * s, by + bh);
        ctx.lineTo(bx + 3 * s, by + bh);
        ctx.lineTo(bx + 1.5 * s, by + bh + 1.5 * s);
        ctx.lineTo(bx + 2 * s, by + bh);
        ctx.lineTo(bx + 1.5 * s, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 1.5 * s);
        ctx.lineTo(bx, by + 1.5 * s);
        ctx.quadraticCurveTo(bx, by, bx + 1.5 * s, by);
        ctx.fill();

        ctx.fillStyle = '#333333';
        ctx.font = `bold ${Math.round(4 * s)}px "Share Tech Mono"`;
        ctx.textAlign = 'center';
        ctx.fillText('...', x, y - 1 * s);
    }
}

function drawEatingVisual(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, s: number,
): void {
    // Plate circle with fork
    ctx.fillStyle = '#d4b896';
    ctx.beginPath();
    ctx.arc(x, y - 2 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x + 1.5 * s, y - 4.5 * s);
    ctx.lineTo(x + 1.5 * s, y - 0.5 * s);
    ctx.stroke();
}

function drawPatrollingVisual(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, s: number,
): void {
    // Shield diamond
    ctx.strokeStyle = '#4fa8ff';
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x, y - 5 * s);
    ctx.lineTo(x + 2.5 * s, y - 2.5 * s);
    ctx.lineTo(x, y);
    ctx.lineTo(x - 2.5 * s, y - 2.5 * s);
    ctx.closePath();
    ctx.stroke();
}

function drawRestingVisual(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, s: number,
): void {
    ctx.fillStyle = 'rgba(200, 200, 255, 0.7)';
    ctx.font = `${Math.round(4 * s)}px "Share Tech Mono"`;
    ctx.textAlign = 'center';
    ctx.fillText('Zzz', x, y - 1 * s);
}

/** Draw firefly particles near campfire during evening hours. */
export function drawFireflies(
    ctx: CanvasRenderingContext2D,
    campfireScreenX: number,
    campfireScreenY: number,
    gameHour: number,
    t: number,
): void {
    // Only show during evening (17:00 - 22:00)
    if (gameHour < 17 || gameHour >= 22) return;

    // Fade in/out at boundaries
    let alpha = 1.0;
    if (gameHour < 18) alpha = gameHour - 17;
    if (gameHour >= 21) alpha = 22 - gameHour;

    ctx.save();
    ctx.globalAlpha = alpha * 0.7;

    const fireflyCount = 8;
    for (let i = 0; i < fireflyCount; i++) {
        const angle = (t / (2000 + i * 300)) + i * 1.7;
        const radius = 20 + Math.sin(t / (1500 + i * 200) + i) * 15;
        const fx = campfireScreenX + Math.cos(angle) * radius;
        const fy = campfireScreenY - 20 + Math.sin(angle * 0.7 + i) * radius * 0.5;

        const flicker = 0.5 + Math.sin(t / (100 + i * 30) + i * 2.5) * 0.5;
        const size = 1.5 + flicker;

        const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, size * 2);
        grad.addColorStop(0, `rgba(255, 240, 150, ${(0.8 * flicker).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(255, 240, 150, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(fx, fy, size * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}
