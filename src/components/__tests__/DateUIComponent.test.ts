import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { DateUIComponent } from '../DateUIComponent';

describe('DateUIComponent', () => {
    let world: World;
    let eventQueue: EventQueue;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        ServiceLocator.register('eventQueue', eventQueue);
        world = new World();
    });

    function createDateEntity(year = 2700, month = 0, day = 1): DateUIComponent {
        const entity = world.createEntity('hud');
        const date = entity.addComponent(new DateUIComponent(year, month, day));
        date.init();
        return date;
    }

    it('starts at January 1, 2700 by default', () => {
        const date = createDateEntity();
        expect(date.getFormattedDate()).toBe('JAN 01, 2700');
    });

    it('advances 9 days on TURN_END', () => {
        const date = createDateEntity();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(date.getFormattedDate()).toBe('JAN 10, 2700');
    });

    it('advances multiple turns correctly', () => {
        const date = createDateEntity();

        // 3 turns = 27 days
        for (let i = 0; i < 3; i++) {
            eventQueue.emit({ type: GameEvents.TURN_END, turn: i + 2 });
            eventQueue.drain();
        }

        expect(date.getFormattedDate()).toBe('JAN 28, 2700');
    });

    it('rolls over months correctly (Jan 28 + 9 = Feb 6)', () => {
        const date = createDateEntity(2700, 0, 28); // Jan 28

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(date.getFormattedDate()).toBe('FEB 06, 2700');
    });

    it('rolls over from short month (Feb 25 + 9 = Mar 6)', () => {
        const date = createDateEntity(2700, 1, 25); // Feb 25

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(date.getFormattedDate()).toBe('MAR 06, 2700');
    });

    it('rolls over years correctly (Dec 28 + 9 = Jan 6 next year)', () => {
        const date = createDateEntity(2700, 11, 28); // Dec 28

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(date.getFormattedDate()).toBe('JAN 06, 2701');
    });

    it('formats single-digit days with zero padding', () => {
        const date = createDateEntity(2700, 2, 3); // Mar 3
        expect(date.getFormattedDate()).toBe('MAR 03, 2700');
    });

    it('handles large advances spanning multiple months', () => {
        const date = createDateEntity(2700, 0, 1); // Jan 1

        // Manually advance 70 days (spans Jan + Feb + into Mar)
        date.advanceDays(70);

        // Jan has 31 days, Feb has 28 → 70 - 31 - 28 = 11 → Mar 11
        expect(date.getFormattedDate()).toBe('MAR 12, 2700');
    });

    it('unsubscribes from TURN_END on destroy', () => {
        const date = createDateEntity();

        date.destroy();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        // Date should not have advanced
        expect(date.getFormattedDate()).toBe('JAN 01, 2700');
    });
});
