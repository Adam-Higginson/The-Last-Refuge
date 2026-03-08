import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceLocator } from '../ServiceLocator';

describe('ServiceLocator', () => {
    beforeEach(() => {
        ServiceLocator.clear();
    });

    it('registers and retrieves a service by key', () => {
        const service = { name: 'test' };
        ServiceLocator.register('myService', service);

        expect(ServiceLocator.get('myService')).toBe(service);
    });

    it('throws for unregistered service', () => {
        expect(() => ServiceLocator.get('missing')).toThrow(
            "Service 'missing' not registered",
        );
    });

    it('checks existence with has()', () => {
        expect(ServiceLocator.has('thing')).toBe(false);

        ServiceLocator.register('thing', 42);
        expect(ServiceLocator.has('thing')).toBe(true);
    });

    it('clears all services', () => {
        ServiceLocator.register('a', 1);
        ServiceLocator.register('b', 2);
        ServiceLocator.clear();

        expect(ServiceLocator.has('a')).toBe(false);
        expect(ServiceLocator.has('b')).toBe(false);
    });

    it('overwrites a service with the same key', () => {
        ServiceLocator.register('svc', 'old');
        ServiceLocator.register('svc', 'new');

        expect(ServiceLocator.get('svc')).toBe('new');
    });
});
