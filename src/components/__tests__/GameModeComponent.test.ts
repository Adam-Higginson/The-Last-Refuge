import { describe, it, expect } from 'vitest';
import { GameModeComponent } from '../GameModeComponent';

describe('GameModeComponent', () => {
    it('defaults to system mode', () => {
        const gm = new GameModeComponent();
        expect(gm.mode).toBe('system');
    });

    it('defaults transitionProgress to 0', () => {
        const gm = new GameModeComponent();
        expect(gm.transitionProgress).toBe(0);
    });

    it('defaults transitionDuration to 1.5', () => {
        const gm = new GameModeComponent();
        expect(gm.transitionDuration).toBe(1.5);
    });

    it('defaults planetEntityId to null', () => {
        const gm = new GameModeComponent();
        expect(gm.planetEntityId).toBeNull();
    });

    it('allows mode to be set', () => {
        const gm = new GameModeComponent();
        gm.mode = 'planet';
        expect(gm.mode).toBe('planet');
        gm.mode = 'transitioning-to-planet';
        expect(gm.mode).toBe('transitioning-to-planet');
    });
});
