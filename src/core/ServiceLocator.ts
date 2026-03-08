// ServiceLocator.ts — Global access to services without hardcoded dependencies.
// Services are registered by key and retrieved by consumers who only know the key.
// Keeps systems decoupled from the concrete providers of canvas, input, events, etc.

export class ServiceLocator {
    private static services: Map<string, unknown> = new Map();

    /** Register a service by key */
    static register<T>(key: string, service: T): void {
        ServiceLocator.services.set(key, service);
    }

    /** Retrieve a service by key. Throws if not registered. */
    static get<T>(key: string): T {
        const service = ServiceLocator.services.get(key);
        if (service === undefined) {
            throw new Error(`Service '${key}' not registered. Did you forget to call ServiceLocator.register()?`);
        }
        return service as T;
    }

    /** Check if a service is registered */
    static has(key: string): boolean {
        return ServiceLocator.services.has(key);
    }

    /** Remove all registered services */
    static clear(): void {
        ServiceLocator.services.clear();
    }
}
