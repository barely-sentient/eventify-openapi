import { JectOptions } from 'json-ject';

/**
 * Callback function signature for event listeners.
 *
 * Supports both synchronous and asynchronous return values.
 *
 * @typeParam Args - Tuple type defining the arguments passed to the handler.
 * @typeParam R - The expected return value type after processing.
 *
 * @param args - The arguments passed by the event dispatcher.
 * @returns A result of type `R` or a Promise resolving to `R`.
 */
type EventHandler<Args extends unknown[], R> = (...args: Args) => R | Promise<R>;
/**
 * Manages strongly-typed event subscriptions and handles sequential event dispatching.
 *
 * Features piped event execution where each listener can transform the target payload
 * before passing it along to the next subscriber in line.
 *
 * @typeParam Args - Tuple type representing the expected event argument list.
 * @typeParam R - The return payload type that threads through listeners.
 *
 * @example
 * ```ts
 * const userEvent = new TypedEvent<[Context, User], User>();
 *
 * const unsubscribe = userEvent.addEventListener((ctx, user) => {
 *   return { ...user, updated: true };
 * });
 *
 * const finalUser = await userEvent.dispatch(context, initialUser);
 * ```
 */
declare class TypedEvent<Args extends unknown[], R> {
    /**
     * Active listeners registered for this event.
     *
     * @internal
     */
    private listeners;
    /**
     * Registers a listener callback to handle event dispatches.
     *
     * @param handler - The callback function to execute when the event fires.
     * @returns An unsubscribe function to remove the listener.
     */
    addEventListener(handler: EventHandler<Args, R>): () => void;
    /**
     * Removes a previously registered listener callback.
     *
     * @param handler - The exact function reference to detach.
     */
    removeEventListener(handler: EventHandler<Args, R>): void;
    /**
     * Removes all attached listeners from this event instance.
     */
    clear(): void;
    /**
     * Gets the total number of active listeners subscribed to this event.
     */
    get listenerCount(): number;
    /**
     * Dispatches the event asynchronously, executing listeners sequentially in order.
     *
     * Performs piped parameter threading:
     * - **2 Arguments (`[Ctx, Entity]`)**: The entity (2nd arg) is piped through each listener.
     * - **3 Arguments (`[Ctx, Before, After]`)**: The `after` entity (3rd arg) is piped, while `ctx` and `before` remain static.
     * - **Generic Fallback**: The final argument is piped through each listener.
     *
     * Listener return values replace the threaded payload for subsequent handlers. If a listener returns `undefined`, the current payload value is preserved.
     *
     * @param args - Arguments matching the event signature.
     * @returns The final transformed payload object.
     */
    dispatch(...args: Args): Promise<R>;
    /**
     * Dispatches the event synchronously, ignoring promises returned by async handlers.
     *
     * Performs sequential value threading across synchronous handlers only. Returns returned Promises are ignored to prevent blocking execution.
     *
     * @param args - Arguments matching the event signature.
     * @returns The final transformed payload object after all sync handlers execute.
     */
    dispatchSync(...args: Args): R;
}

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
type CreateHandler<C, E> = (ctx: C, entity: E) => E | Promise<E>;
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
type UpdateHandler<C, E> = (ctx: C, before: E, after: E) => E | Promise<E>;
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
type DeleteHandler<C, E> = (ctx: C, entity: E) => E | Promise<E>;
/**
 * Collection structure containing all standard lifecycle event hooks for a single entity type.
 *
 * @typeParam C - The execution context type passed during event dispatch.
 * @typeParam E - The entity payload type processed by each lifecycle hook.
 */
type EntityEvents<C, E> = {
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
type EventifyOpenApiEventCollection<C = unknown, E = unknown> = EntityEvents<C, E> & Record<string, TypedEvent<unknown[], unknown>>;
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
interface EventifyOpenApiEvents {
}

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
declare function createEntityEvents<C, E>(schema: object, extra?: Record<string, TypedEvent<unknown[], unknown>>): EntityEvents<C, E> & Record<string, TypedEvent<unknown[], unknown>>;
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
declare function registerEntityEvents(name: string, collection: EntityEvents<unknown, unknown>): void;
/**
 * Retrieves a registered event collection using a reference schema object.
 *
 * @param schema - The schema object to look up.
 * @returns The matching {@link EntityEvents} collection, or `undefined` if unregistered or invalid.
 */
declare function getEventsBySchema(schema: unknown): EntityEvents<unknown, unknown> | undefined;
/**
 * Retrieves a registered event collection using its string name identifier.
 *
 * @param name - The unique name key of the entity event collection.
 * @returns The matching {@link EntityEvents} collection, or `undefined` if not found.
 */
declare function getEventsByName(name: string): EntityEvents<unknown, unknown> | undefined;
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
declare const Events: EventifyOpenApiEvents & {
    For<TCtx = unknown, TType = unknown>(schema: unknown): EntityEvents<TCtx, TType>;
};

/**
 * Configuration options specifying context type imports for event emission.
 */
type EmitterContextType = {
    from: string;
    name: string;
} | undefined;
/**
 * Generates TypeScript source code for a specific entity's event registration file.
 *
 * Produces a self-registering event module that initializes standard lifecycle events
 * (`BeforeCreate`, `AfterCreate`, etc.) for an OpenAPI schema, attaches them to the
 * global `Events` registry, and augments `EventifyOpenApiEvents` for type safety.
 *
 * @param pascalName - The PascalCase entity name (e.g., `"UserProfile"`).
 * @param lowerName - The lower-case or kebab-case entity identifier (e.g., `"user-profile"`).
 * @param contextType - Optional context import metadata specifying module path and type name.
 *
 * @returns The formatted TypeScript file contents as a string.
 *
 * @example
 * ```ts
 * const code = emitEntityEventsFile("User", "user", { name: "AppContext", from: "./context.js" });
 * ```
 */
declare function emitEntityEventsFile(pascalName: string, lowerName: string, contextType: EmitterContextType): string;
/**
 * Generates a barrel module that automatically registers all entity events on application startup.
 *
 * Produces side-effect imports for each generated entity event file, ensuring all event
 * definitions and global type declarations load in the runtime registry.
 *
 * @param lowerNames - List of entity file identifiers (e.g., `["user", "order", "product"]`).
 *
 * @returns The formatted TypeScript barrel file contents as a string.
 *
 * @example
 * ```ts
 * const indexCode = emitIndexEventsFile(["user", "product"]);
 * ```
 */
declare function emitIndexEventsFile(lowerNames: string[]): string;

/**
 * Custom file write function signature for virtual or browser-based file systems.
 *
 * @param filePath - The target path where the file should be saved.
 * @param content - The UTF-8 text content to write.
 * @param encoding - File encoding, strictly `"utf-8"`.
 * @returns A Promise that resolves once writing completes.
 */
type CustomWriteFile = (filePath: string, content: string, encoding: "utf-8") => Promise<void>;
/**
 * Custom file read function for virtual or browser-based file systems.
 */
type CustomReadFile = (filePath: string, encoding: "utf-8") => Promise<string>;
/**
 * Custom directory creation function signature for virtual or browser-based file systems.
 *
 * @param dirPath - The target directory path to create.
 * @param options - Configuration options, including recursive directory creation.
 * @returns A Promise resolving when creation succeeds.
 */
type CustomMkdir = (dirPath: string, options: {
    recursive: boolean;
}) => Promise<void | string>;
/**
 * Configuration options for orchestrating OpenAPI event generation.
 */
type EventifyConfig = {
    /** OpenAPI document source — file path, URL, or raw JSON string depending on `type`. */
    input: string;
    /** Format interpretation strategy for the provided `input`. Defaults to `"file"`. */
    type?: "file" | "source" | "url";
    /** Path to `tsconfig.json` defining `@api/*` path aliases. Required if `outDir` is unspecified. */
    tsconfigPath?: string;
    /** Explicit target output directory, overriding `tsconfigPath` path resolution. */
    outDir?: string;
    /** Context type configuration for typed event handlers. */
    contextType?: {
        from: string;
        name: string;
    };
    /** Configuration options passed to `json-ject` when parsing modular specs. */
    jectCfg?: JectOptions;
    /** Custom directory creation hook for virtual file systems or non-Node environments. */
    mkdir?: CustomMkdir;
    /** Custom file writing hook for virtual file systems or non-Node environments. */
    writeFile?: CustomWriteFile;
    /** Custom file reading hook used to link generated entities to their event modules. */
    readFile?: CustomReadFile;
};
/**
 * Parses an OpenAPI specification and generates typed entity lifecycle event files.
 *
 * Discovers schemas within the input document (`components.schemas` or `definitions`),
 * generates individual event files (`[entity].events.ts`) and a barrel registration
 * file (`index.events.ts`), and writes them to the target output directory.
 *
 * @param cfg - Configuration options controlling input loading, generation, and file output.
 * @returns A Map linking generated relative filenames (without extension) to their code content.
 *
 * @throws {@link Error} If the OpenAPI document is malformed, missing `paths`, or lacks entity schemas.
 *
 * @example
 * ```ts
 * const fileMap = await eventifyOpenApi({
 *   input: "./openapi.json",
 *   type: "file",
 *   outDir: "./src/generated/events",
 *   contextType: { name: "AppContext", from: "../context.js" }
 * });
 * ```
 */
declare function eventifyOpenApi(cfg: EventifyConfig): Promise<Map<string, string>>;

/**
 * Resolves the target generation directory from a project's `tsconfig.json`.
 *
 * Inspects `compilerOptions.paths` for the `"@api/*"` path alias and resolves its
 * absolute target directory relative to the `tsconfig.json` file location.
 *
 * @param tsconfigPath - Relative or absolute path to the target `tsconfig.json` file.
 * @returns A Promise that resolves to the absolute path of the target directory.
 *
 * @throws {@link Error} If the file does not exist, contains unparseable JSON, or lacks the `"@api/*"` path alias.
 *
 * @example
 * ```ts
 * const targetDir = await readTargetDir("./tsconfig.json");
 * // Returns: "/project/src/generated"
 * ```
 */
declare function readTargetDir(tsconfigPath: string): Promise<string>;

/**
 * Converts an arbitrary string into PascalCase (upper camel case).
 *
 * Removes leading non-alphanumeric characters, splits by non-alphanumeric delimiters,
 * and capitalizes the first letter of each word segment.
 *
 * @param s - The input string to transform.
 * @returns The formatted PascalCase string, or `"Anonymous"` if no valid word characters are present.
 *
 * @example
 * ```ts
 * toPascalCase("user-profile"); // "UserProfile"
 * toPascalCase("123_user_name"); // "UserName"
 * toPascalCase("!!!"); // "Anonymous"
 * ```
 */
declare const toPascalCase: (s: string) => string;
/**
 * Converts an arbitrary string into camelCase (lower camel case).
 *
 * Leverages {@link toPascalCase} internally and lowers the initial character.
 *
 * @param s - The input string to transform.
 * @returns The formatted camelCase string.
 *
 * @example
 * ```ts
 * toCamelCase("user-profile"); // "userProfile"
 * toCamelCase("User_Name"); // "userName"
 * ```
 */
declare const toCamelCase: (s: string) => string;

export { type CreateHandler, type CustomMkdir, type CustomReadFile, type CustomWriteFile, type DeleteHandler, type EntityEvents, type EventHandler, type EventifyConfig, type EventifyOpenApiEventCollection, type EventifyOpenApiEvents, Events, TypedEvent, type UpdateHandler, createEntityEvents, emitEntityEventsFile, emitIndexEventsFile, eventifyOpenApi, getEventsByName, getEventsBySchema, readTargetDir, registerEntityEvents, toCamelCase, toPascalCase };
