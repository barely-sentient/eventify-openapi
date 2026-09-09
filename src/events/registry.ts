import { TypedEvent } from "./typed-event.js";
import type { EntityEvents, EventifyOpenApiEvents } from "./types.js";

/**
 * Weak reference storage mapping schema objects to their entity event bundles.
 * Prevents memory leaks by allowing unreferenced schema objects to be garbage collected.
 * 
 * @internal
 */
const schemaToEvents = new WeakMap<object, EntityEvents<unknown, unknown>>();

/**
 * Global map storing entity event collections keyed by their string names.
 * 
 * @internal
 */
const nameToEvents = new Map<string, EntityEvents<unknown, unknown>>();

/**
 * Creates and initializes a standard set of lifecycle events for a given entity schema.
 * 
 * Instantiates hooks for `BeforeCreate`, `AfterCreate`, `BeforeUpdate`, `AfterUpdate`, 
 * `BeforeDelete`, and `AfterDelete`, while automatically indexing the collection 
 * in the internal schema lookup registry.
 *
 * @typeParam C - The context type passed during event dispatch.
 * @typeParam E - The entity instance type processed by the events.
 * 
 * @param schema - The reference schema object used as a lookup key.
 * @param extra - Optional custom named events to append to the standard collection.
 * 
 * @returns Combined entity lifecycle events alongside any supplementary custom events.
 * 
 * @example
 * ```ts
 * const userEvents = createEntityEvents<UserContext, UserEntity>(UserSchema, {
 *   OnPasswordReset: new TypedEvent()
 * });
 * ```
 */
export function createEntityEvents<C, E>(
    schema: object,
    extra?: Record<string, TypedEvent<unknown[], unknown>>,
): EntityEvents<C, E> & Record<string, TypedEvent<unknown[], unknown>> {
    const collection: EntityEvents<C, E> & Record<string, TypedEvent<unknown[], unknown>> = {
        BeforeCreate: new TypedEvent<[C, E], E>(),
        AfterCreate: new TypedEvent<[C, E], E>(),
        BeforeUpdate: new TypedEvent<[C, E, E], E>(),
        AfterUpdate: new TypedEvent<[C, E, E], E>(),
        BeforeDelete: new TypedEvent<[C, E], E>(),
        AfterDelete: new TypedEvent<[C, E], E>(),
        ...extra,
    } as EntityEvents<C, E> & Record<string, TypedEvent<unknown[], unknown>>;

    if (schema && typeof schema === "object") {
        schemaToEvents.set(schema as object, collection as unknown as EntityEvents<unknown, unknown>);
    }

    return collection;
}

/**
 * Registers an entity event collection by its string name into the global lookup registry.
 * 
 * Typically invoked by generated code files to expose entity events by schema name.
 *
 * @param name - The unique string key matching the entity definition.
 * @param collection - The event collection bundle to register.
 * 
 * @internal
 */
export function registerEntityEvents(name: string, collection: EntityEvents<unknown, unknown>): void {
    nameToEvents.set(name, collection);
}

/**
 * Retrieves a registered event collection using a reference schema object.
 *
 * @param schema - The schema object to look up.
 * @returns The matching {@link EntityEvents} collection, or `undefined` if unregistered or invalid.
 */
export function getEventsBySchema(schema: unknown): EntityEvents<unknown, unknown> | undefined {
    if (schema && typeof schema === "object") {
        return schemaToEvents.get(schema as object);
    }
    return undefined;
}

/**
 * Retrieves a registered event collection using its string name identifier.
 *
 * @param name - The unique name key of the entity event collection.
 * @returns The matching {@link EntityEvents} collection, or `undefined` if not found.
 */
export function getEventsByName(name: string): EntityEvents<unknown, unknown> | undefined {
    return nameToEvents.get(name);
}

/**
 * Dynamic Proxy registry providing global access to all registered entity lifecycle events.
 * 
 * Allows accessing events by entity name dynamically as properties, or retrieving events
 * safely via the built-in `.For(schema)` lookup method.
 *
 * @remarks
 * If a requested schema is unregistered, `.For(schema)` returns a fallback fallback set of 
 * no-op event handlers to prevent runtime execution errors in repository flows.
 *
 * @example
 * ```ts
 * // Property access by registered name
 * Events.User.BeforeCreate.addEventListener(handler);
 * 
 * // Lookup by schema instance with safe fallback
 * Events.For(UserSchema).AfterUpdate.dispatch(ctx, oldUser, newUser);
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Events: EventifyOpenApiEvents & {
    For<TCtx = unknown, TType = unknown>(schema: unknown): EntityEvents<TCtx, TType>;
} = new Proxy({} as EventifyOpenApiEvents & { For<TCtx = unknown, TType = unknown>(schema: unknown): EntityEvents<TCtx, TType> }, {
    get(target, prop, receiver) {
        if (prop === "For") {
            return (schema: unknown) => {
                const found = getEventsBySchema(schema);
                if (found) return found;
                // Return a no-op collection that just pipes through, so FrameworkRepository doesn't crash
                // if schema not registered yet.
                return {
                    BeforeCreate: { dispatch: async (_ctx: unknown, e: unknown) => e, addEventListener: () => () => {} } as unknown as TypedEvent<[unknown, unknown], unknown>,
                    AfterCreate: { dispatch: async (_ctx: unknown, e: unknown) => e, addEventListener: () => () => {} } as unknown as TypedEvent<[unknown, unknown], unknown>,
                    BeforeUpdate: { dispatch: async (_ctx: unknown, _b: unknown, a: unknown) => a, addEventListener: () => () => {} } as unknown as TypedEvent<[unknown, unknown, unknown], unknown>,
                    AfterUpdate: { dispatch: async (_ctx: unknown, _b: unknown, a: unknown) => a, addEventListener: () => () => {} } as unknown as TypedEvent<[unknown, unknown, unknown], unknown>,
                    BeforeDelete: { dispatch: async (_ctx: unknown, e: unknown) => e, addEventListener: () => () => {} } as unknown as TypedEvent<[unknown, unknown], unknown>,
                    AfterDelete: { dispatch: async (_ctx: unknown, e: unknown) => e, addEventListener: () => () => {} } as unknown as TypedEvent<[unknown, unknown], unknown>,
                } as unknown as EntityEvents<unknown, unknown>;
            };
        }
        if (typeof prop === "string" && nameToEvents.has(prop)) {
            return nameToEvents.get(prop);
        }
        return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value) {
        if (typeof prop === "string") {
            nameToEvents.set(prop, value as unknown as EntityEvents<unknown, unknown>);
            return true;
        }
        return Reflect.set(target, prop, value);
    },
    has(target, prop) {
        if (typeof prop === "string" && nameToEvents.has(prop)) return true;
        return Reflect.has(target, prop);
    },
    ownKeys(target) {
        const keys = new Set<string | symbol>([...Reflect.ownKeys(target), ...nameToEvents.keys()]);
        return [...keys];
    },
    getOwnPropertyDescriptor(target, prop) {
        if (typeof prop === "string" && nameToEvents.has(prop)) {
            return { configurable: true, enumerable: true, value: nameToEvents.get(prop), writable: true };
        }
        const desc = Reflect.getOwnPropertyDescriptor(target, prop);
        if (desc) return desc;
        return undefined;
    },
}) as EventifyOpenApiEvents & { For<TCtx, TType>(schema: unknown): EntityEvents<TCtx, TType> };