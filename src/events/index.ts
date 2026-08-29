/**
 * Core event management and type definitions module.
 *
 * @packageDocumentation
 */

/**
 * Emits and manages strongly-typed domain events.
 *
 * @see {@link EventHandler} for subscribing to instances of this event.
 */
export { TypedEvent } from "./typed-event.js";

/**
 * Callback signature for handling incoming typed events.
 *
 * @typeParam T - The event payload structure.
 * @param event - The emitted event payload.
 */
export type { EventHandler } from "./typed-event.js";

/**
 * Callback signature for entity creation events.
 *
 * @typeParam TEntity - The shape of the created entity.
 */
export type { CreateHandler } from "./types.js";

/**
 * Callback signature for entity modification events.
 *
 * @typeParam TEntity - The shape of the updated entity.
 */
export type { UpdateHandler } from "./types.js";

/**
 * Callback signature for entity removal events.
 *
 * @typeParam TEntity - The shape of the deleted entity.
 */
export type { DeleteHandler } from "./types.js";

/**
 * Map of standard lifecycle event handlers (`create`, `update`, `delete`) for a domain entity.
 *
 * @typeParam TEntity - The target entity interface.
 */
export type { EntityEvents } from "./types.js";

/**
 * Map of OpenAPI schema names to their associated event collections.
 */
export type { EventifyOpenApiEventCollection } from "./types.js";

/**
 * Registry of all available OpenAPI event contracts across the application.
 */
export type { EventifyOpenApiEvents } from "./types.js";

/**
 * Creates a standard lifecycle event bundle (`create`, `update`, `delete`) for an entity type.
 *
 * @typeParam TEntity - The entity type to generate events for.
 * @returns An object containing typed lifecycle events.
 */
export { createEntityEvents } from "./registry.js";

/**
 * Global registry instance containing all active application events.
 */
export { Events } from "./registry.js";

/**
 * Registers an entity lifecycle event bundle into the central event registry.
 *
 * @param schemaName - The unique key matching the entity schema.
 * @param events - The entity event bundle to register.
 */
export { registerEntityEvents } from "./registry.js";

/**
 * Looks up registered events by their associated entity schema key.
 *
 * @param schemaName - The target schema identifier.
 * @returns The matching event bundle, or `undefined` if unregistered.
 */
export { getEventsBySchema } from "./registry.js";

/**
 * Looks up a specific registered event by its full name.
 *
 * @param eventName - The unique event identifier string.
 * @returns The matching typed event instance, or `undefined` if unregistered.
 */
export { getEventsByName } from "./registry.js";