/**
 * Core event management and type definitions.
 */
export { TypedEvent } from "./events/typed-event.js";
export type { EventHandler } from "./events/typed-event.js";
export type {
    CreateHandler,
    UpdateHandler,
    DeleteHandler,
    EntityEvents,
    EventifyOpenApiEventCollection,
    EventifyOpenApiEvents,
} from "./events/types.js";
export {
    createEntityEvents,
    Events,
    registerEntityEvents,
    getEventsBySchema,
    getEventsByName,
} from "./events/registry.js";

/**
 * Event generation engine and file emitters.
 */
export { eventifyOpenApi } from "./generator/index.js";
export type { EventifyConfig, CustomMkdir, CustomWriteFile } from "./generator/index.js";
export { emitEntityEventsFile, emitIndexEventsFile } from "./generator/emitter.js";

/**
 * File system and string formatting utilities.
 */
export { readTargetDir } from "./utils/tsconfig.js";
export { toPascalCase, toCamelCase } from "./utils/casing.js";