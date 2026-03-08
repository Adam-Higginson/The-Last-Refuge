// DateUIComponent.ts — Tracks the in-game calendar date.
// Starts at January 1, 2700. Each turn advances the date by 9 days.
// Derived from orbital mechanics: 2π / 0.15 ≈ 42 turns per orbit,
// 365 / 42 ≈ 9 days per turn for an Earth-like orbital period.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

const MONTH_NAMES = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

/** Standard month lengths (no leap years in deep space) */
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Days that pass per turn, derived from New Terra's orbital period */
const DAYS_PER_TURN = 9;

export class DateUIComponent extends Component {
    year: number;
    /** Month index 0–11 */
    month: number;
    /** Day of month 1–31 */
    day: number;
    readonly daysPerTurn: number;

    private eventQueue: EventQueue | null = null;
    private turnEndHandler: EventHandler | null = null;

    constructor(year = 2700, month = 0, day = 1) {
        super();
        this.year = year;
        this.month = month;
        this.day = day;
        this.daysPerTurn = DAYS_PER_TURN;
    }

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.turnEndHandler = (): void => {
            this.advanceDays(this.daysPerTurn);
        };

        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
    }

    /** Advance the date by the given number of days, rolling months and years */
    advanceDays(days: number): void {
        this.day += days;

        while (this.day > MONTH_DAYS[this.month]) {
            this.day -= MONTH_DAYS[this.month];
            this.month++;

            if (this.month > 11) {
                this.month = 0;
                this.year++;
            }
        }
    }

    /** Format the current date as "JAN 01, 2700" */
    getFormattedDate(): string {
        const monthStr = MONTH_NAMES[this.month];
        const dayStr = String(this.day).padStart(2, '0');
        return `${monthStr} ${dayStr}, ${this.year}`;
    }

    destroy(): void {
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
        }
    }
}
