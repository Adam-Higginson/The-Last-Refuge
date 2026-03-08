// ServiceLocator.ts — Global access to services without hardcoded dependencies.
// Services are registered by key and retrieved by consumers who only know the key.
// Keeps systems decoupled from the concrete providers of canvas, input, events, etc.

const services: Map<string, unknown> = new Map();

/** Register a service by key */
function register<T>(key: string, service: T): void {
    services.set(key, service);
}

/** Retrieve a service by key. Throws if not registered. */
function get<T>(key: string): T {
    const service = services.get(key);
    if (service === undefined) {
        throw new Error(`Service '${key}' not registered. Did you forget to call ServiceLocator.register()?`);
    }
    return service as T;
}

/** Check if a service is registered */
function has(key: string): boolean {
    return services.has(key);
}

/** Remove all registered services */
function clear(): void {
    services.clear();
}

export const ServiceLocator = { register, get, has, clear };
