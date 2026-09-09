import type { TypedEvent } from "./typed-event.js";

/**
 * Handler signature for entity creation events.
 *
 * Receives the execution context and the entity target payload.
 *
 * @typeParam C - The execution context type.
 * @typeParam E - The entity payload type.
 *
 * @param ctx - The current context instance.
 * @param entity - The entity payload being created.
 * @returns The original or modified entity payload, or a promise resolving to it.
 */
export type CreateHandler<C, E> = (ctx: C, entity: E) => E | Promise<E>;

/**
 * Handler signature for entity modification events.
 *
 * Receives the execution context, the original state, and the target state.
 *
 * @typeParam C - The execution context type.
 * @typeParam E - The entity payload type.
 *
 * @param ctx - The current context instance.
 * @param before - The state of the entity prior to modification.
 * @param after - The proposed state of the entity after modification.
 * @returns The modified entity payload, or a promise resolving to it.
 */
export type UpdateHandler<C, E> = (ctx: C, before: E, after: E) => E | Promise<E>;

/**
 * Handler signature for entity removal events.
 *
 * Receives the execution context and the entity target payload scheduled for deletion.
 *
 * @typeParam C - The execution context type.
 * @typeParam E - The entity payload type.
 *
 * @param ctx - The current context instance.
 * @param entity - The entity payload marked for removal.
 * @returns The original or updated entity payload, or a promise resolving to it.
 */
export type DeleteHandler<C, E> = (ctx: C, entity: E) => E | Promise<E>;

/**
 * Collection structure containing all standard lifecycle event hooks for a single entity type.
 *
 * @typeParam C - The execution context type passed during event dispatch.
 * @typeParam E - The entity payload type processed by each lifecycle hook.
 */
export type EntityEvents<C, E> = {
    /** Fired prior to persisting a new entity. Allows pre-creation validation or mutation. */
    BeforeCreate: TypedEvent<[C, E], E>;
    /** Fired immediately after creating a new entity. Allows post-creation side effects. */
    AfterCreate: TypedEvent<[C, E], E>;
    /** Fired prior to applying modifications to an entity. Allows diff inspection or pre-update mutation. */
    BeforeUpdate: TypedEvent<[C, E, E], E>;
    /** Fired immediately after an entity update is applied. Allows audit logging or downstream sync. */
    AfterUpdate: TypedEvent<[C, E, E], E>;
    /** Fired prior to removing an entity. Allows cleanup or pre-deletion validation. */
    BeforeDelete: TypedEvent<[C, E], E>;
    /** Fired immediately after an entity is deleted. */
    AfterDelete: TypedEvent<[C, E], E>;
};

/**
 * Extended collection interface combining standard entity lifecycle events with arbitrary custom event keys.
 *
 * @typeParam C - The execution context type (defaults to `unknown`).
 * @typeParam E - The entity target payload type (defaults to `unknown`).
 */
export type EventifyOpenApiEventCollection<C = unknown, E = unknown> = EntityEvents<C, E> & Record<string, TypedEvent<unknown[], unknown>>;

/**
 * Global registry interface designed for declaration merging.
 *
 * Generated code files augment this interface to register strongly-typed event maps by schema name.
 *
 * @example
 * ```ts
 * declare module "./types.js" {
 *   interface EventifyOpenApiEvents {
 *     User: EntityEvents<UserContext, UserEntity>;
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EventifyOpenApiEvents {}