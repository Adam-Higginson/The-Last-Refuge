import { describe, it, expect, vi } from 'vitest';
import { RenderQueue } from '../RenderQueue';
import type { Renderable } from '../RenderQueue';

function makeItem(overrides: Partial<Renderable> = {}): Renderable {
    return {
        depth: 0,
        kind: 'building',
        screenX: 0,
        screenY: 0,
        draw: vi.fn(),
        ...overrides,
    };
}

describe('RenderQueue', () => {
    it('sorts by depth ascending', () => {
        const queue = new RenderQueue();
        const a = makeItem({ depth: 5, label: 'a' });
        const b = makeItem({ depth: 2, label: 'b' });
        const c = makeItem({ depth: 8, label: 'c' });
        queue.add(a);
        queue.add(b);
        queue.add(c);
        queue.sort();
        const items = queue.getItems();
        expect(items[0]).toBe(b);
        expect(items[1]).toBe(a);
        expect(items[2]).toBe(c);
    });

    it('tie-breaks same depth: building before colonist', () => {
        const queue = new RenderQueue();
        const colonist = makeItem({ depth: 5, kind: 'colonist', label: 'colonist' });
        const building = makeItem({ depth: 5, kind: 'building', label: 'building' });
        queue.add(colonist);
        queue.add(building);
        queue.sort();
        const items = queue.getItems();
        expect(items[0].kind).toBe('building');
        expect(items[1].kind).toBe('colonist');
    });

    it('tie-breaks: building < prop < empty-slot < colonist', () => {
        const queue = new RenderQueue();
        queue.add(makeItem({ depth: 3, kind: 'colonist' }));
        queue.add(makeItem({ depth: 3, kind: 'empty-slot' }));
        queue.add(makeItem({ depth: 3, kind: 'prop' }));
        queue.add(makeItem({ depth: 3, kind: 'building' }));
        queue.sort();
        const kinds = queue.getItems().map(i => i.kind);
        expect(kinds).toEqual(['building', 'prop', 'empty-slot', 'colonist']);
    });

    it('stable sort: same depth + kind preserves insertion order', () => {
        const queue = new RenderQueue();
        const first = makeItem({ depth: 3, kind: 'colonist', label: 'first' });
        const second = makeItem({ depth: 3, kind: 'colonist', label: 'second' });
        queue.add(first);
        queue.add(second);
        queue.sort();
        const items = queue.getItems();
        expect(items[0].label).toBe('first');
        expect(items[1].label).toBe('second');
    });

    it('drawAll calls draw() in sorted order', () => {
        const queue = new RenderQueue();
        const order: string[] = [];
        queue.add(makeItem({
            depth: 5,
            label: 'b',
            draw: () => { order.push('b'); },
        }));
        queue.add(makeItem({
            depth: 2,
            label: 'a',
            draw: () => { order.push('a'); },
        }));
        queue.sort();
        queue.drawAll({} as CanvasRenderingContext2D);
        expect(order).toEqual(['a', 'b']);
    });

    it('clear() empties the queue', () => {
        const queue = new RenderQueue();
        queue.add(makeItem());
        queue.add(makeItem());
        expect(queue.getItems().length).toBe(2);
        queue.clear();
        expect(queue.getItems().length).toBe(0);
    });

    it('empty queue: sort and drawAll are no-ops', () => {
        const queue = new RenderQueue();
        queue.sort();
        queue.drawAll({} as CanvasRenderingContext2D);
        expect(queue.getItems().length).toBe(0);
    });

    it('getItems returns items after sort', () => {
        const queue = new RenderQueue();
        queue.add(makeItem({ depth: 10 }));
        queue.add(makeItem({ depth: 1 }));
        queue.sort();
        const items = queue.getItems();
        expect(items[0].depth).toBe(1);
        expect(items[1].depth).toBe(10);
    });
});
