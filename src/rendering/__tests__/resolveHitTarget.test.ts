import { describe, it, expect } from 'vitest';
import { resolveHitTarget } from '../colonyGridRenderer';
import type { HitTestItem } from '../RenderQueue';

function makeBuilding(depth: number, rect: { x: number; y: number; width: number; height: number }, slotIndex = 0): HitTestItem {
    return {
        kind: 'building',
        depth,
        screenX: rect.x + rect.width / 2,
        screenY: rect.y + rect.height / 2,
        slotIndex,
        hitRect: rect,
    };
}

function makeColonist(depth: number, screenX: number, screenY: number, entityId: number, hitRadius = 12): HitTestItem {
    return {
        kind: 'colonist',
        depth,
        screenX,
        screenY,
        entityId,
        hitRadius,
    };
}

describe('resolveHitTarget', () => {
    it('colonist always wins over empty-slot at same screen position', () => {
        const items: HitTestItem[] = [
            makeColonist(3, 100, 100, 42),
            { kind: 'empty-slot', depth: 8, screenX: 100, screenY: 100, slotIndex: 1,
              hitRect: { x: 80, y: 80, width: 40, height: 40 } },
        ];
        const result = resolveHitTarget(items, 100, 100);
        expect(result).not.toBeNull();
        expect(result?.kind).toBe('colonist');
        expect(result?.entityId).toBe(42);
    });

    it('colonist at higher depth wins over building at same screen position', () => {
        const items: HitTestItem[] = [
            makeBuilding(3, { x: 80, y: 80, width: 40, height: 40 }, 1),
            makeColonist(5, 100, 100, 42),
        ];
        const result = resolveHitTarget(items, 100, 100);
        expect(result).not.toBeNull();
        expect(result?.kind).toBe('colonist');
        expect(result?.entityId).toBe(42);
    });

    it('no items at click position returns null', () => {
        const items: HitTestItem[] = [
            makeBuilding(3, { x: 80, y: 80, width: 40, height: 40 }, 1),
            makeColonist(5, 100, 100, 42),
        ];
        const result = resolveHitTarget(items, 500, 500);
        expect(result).toBeNull();
    });

    it('multiple colonists — highest depth wins', () => {
        const items: HitTestItem[] = [
            makeColonist(2, 100, 100, 10),
            makeColonist(5, 103, 100, 20),
            makeColonist(8, 97, 100, 30),
        ];
        const result = resolveHitTarget(items, 100, 100);
        expect(result).not.toBeNull();
        expect(result?.kind).toBe('colonist');
        expect(result?.entityId).toBe(30);
    });

    it('empty items list returns null', () => {
        const result = resolveHitTarget([], 100, 100);
        expect(result).toBeNull();
    });

    it('props are skipped during hit-testing', () => {
        const items: HitTestItem[] = [
            {
                kind: 'prop',
                depth: 10,
                screenX: 100,
                screenY: 100,
                hitRect: { x: 80, y: 80, width: 40, height: 40 },
            },
        ];
        const result = resolveHitTarget(items, 100, 100);
        expect(result).toBeNull();
    });
});
