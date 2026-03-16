import { describe, it, expect, beforeEach } from 'vitest';
import { AIService } from '../AIService';
import type { ExtirisStatePayload } from '../AIService';

function makePayload(overrides?: Partial<ExtirisStatePayload>): ExtirisStatePayload {
    return {
        turn: 5,
        self: { x: 1000, y: 1000, movementBudget: 1000, sensorRadius: 1500 },
        visibleEntities: [],
        memory: {
            lastSeenPlayerPos: null,
            visitedPositions: [],
            knownPlanets: [],
            previousReasoning: '',
        },
        worldBounds: { min: -5000, max: 5000 },
        ...overrides,
    };
}

describe('AIService', () => {
    let service: AIService;

    beforeEach(() => {
        service = new AIService();
    });

    it('defaults to deterministic mode', () => {
        expect(service.useDeterministic).toBe(true);
    });

    it('switches to LLM mode after configuring API key', () => {
        service.configure({ apiKey: 'test-key' });
        expect(service.useDeterministic).toBe(false);
    });

    it('switches back to deterministic on empty API key', () => {
        service.configure({ apiKey: 'test-key' });
        service.configure({ apiKey: '' });
        expect(service.useDeterministic).toBe(true);
    });

    describe('deterministicMove', () => {
        it('pursues visible player ship', () => {
            const payload = makePayload({
                visibleEntities: [
                    { type: 'ship', name: 'arkSalvage', x: 2000, y: 1000, distance: 1000 },
                ],
            });
            const result = service.deterministicMove(payload);

            expect(result.action).toBe('move');
            expect(result.target.x).toBeCloseTo(2000);
            expect(result.target.y).toBeCloseTo(1000);
            expect(result.reasoning).toContain('Pursuing');
        });

        it('clamps pursuit to movement budget', () => {
            const payload = makePayload({
                self: { x: 0, y: 0, movementBudget: 500, sensorRadius: 1500 },
                visibleEntities: [
                    { type: 'ship', name: 'arkSalvage', x: 2000, y: 0, distance: 2000 },
                ],
            });
            const result = service.deterministicMove(payload);

            // Should move 500 toward target at (2000, 0), ending at (500, 0)
            expect(result.target.x).toBeCloseTo(500);
            expect(result.target.y).toBeCloseTo(0);
        });

        it('searches last known player position', () => {
            const payload = makePayload({
                memory: {
                    lastSeenPlayerPos: { x: 3000, y: 3000, turnsSinceLastSeen: 2 },
                    visitedPositions: [],
                    knownPlanets: [],
                    previousReasoning: '',
                },
            });
            const result = service.deterministicMove(payload);
            expect(result.reasoning).toContain('Searching');
        });

        it('ignores stale last known position (>= 5 turns)', () => {
            const payload = makePayload({
                memory: {
                    lastSeenPlayerPos: { x: 3000, y: 3000, turnsSinceLastSeen: 5 },
                    visitedPositions: [],
                    knownPlanets: [{ name: 'newTerra', x: 1500, y: 0 }],
                    previousReasoning: '',
                },
            });
            const result = service.deterministicMove(payload);
            // Should patrol toward planet instead
            expect(result.reasoning).toContain('Patrolling');
        });

        it('patrols toward nearest unvisited planet', () => {
            const payload = makePayload({
                memory: {
                    lastSeenPlayerPos: null,
                    visitedPositions: [],
                    knownPlanets: [
                        { name: 'farPlanet', x: 4000, y: 4000 },
                        { name: 'nearPlanet', x: 1200, y: 1200 },
                    ],
                    previousReasoning: '',
                },
            });
            const result = service.deterministicMove(payload);
            expect(result.reasoning).toContain('nearPlanet');
        });

        it('falls back to random patrol when no leads', () => {
            const payload = makePayload();
            const result = service.deterministicMove(payload);
            expect(result.action).toBe('move');
            expect(result.reasoning).toContain('Random patrol');
        });

        it('clamps target to world bounds', () => {
            const payload = makePayload({
                self: { x: 4800, y: 4800, movementBudget: 1000, sensorRadius: 1500 },
                visibleEntities: [
                    { type: 'ship', name: 'arkSalvage', x: 6000, y: 6000, distance: 1700 },
                ],
            });
            const result = service.deterministicMove(payload);
            expect(result.target.x).toBeLessThanOrEqual(5000);
            expect(result.target.y).toBeLessThanOrEqual(5000);
        });
    });

    describe('requestMove', () => {
        it('returns deterministic result when no API key', async () => {
            const payload = makePayload({
                visibleEntities: [
                    { type: 'ship', name: 'arkSalvage', x: 2000, y: 1000, distance: 1000 },
                ],
            });
            const result = await service.requestMove(payload);
            expect(result.action).toBe('move');
            expect(result.reasoning).toContain('Pursuing');
        });
    });
});
