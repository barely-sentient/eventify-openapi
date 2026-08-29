import { JectOptions } from 'json-ject';

type EventHandler<Args extends unknown[], R> = (...args: Args) => R | Promise<R>;
declare class TypedEvent<Args extends unknown[], R> {
    private listeners;
    addEventListener(handler: EventHandler<Args, R>): () => void;
    removeEventListener(handler: EventHandler<Args, R>): void;
    clear(): void;
    get listenerCount(): number;
    /**
     * Dispatches sequentially, piping the return value through each listener.
     * For 2-arg events (ctx, entity) the entity is threaded.
     * For 3-arg events (ctx, before, after) the `after` value is threaded while `before` is fixed.
     */
    dispatch(...args: Args): Promise<R>;
    /**
     * Synchronous dispatch - only calls sync handlers, ignores async returns
     */
    dispatchSync(...args: Args): R;
}

type CreateHandler<C, E> = (ctx: C, entity: E) => E | Promise<E>;
type UpdateHandler<C, E> = (ctx: C, before: E, after: E) => E | Promise<E>;
type DeleteHandler<C, E> = (ctx: C, entity: E) => E | Promise<E>;
type EntityEvents<C, E> = {
    BeforeCreate: TypedEvent<[C, E], E>;
    AfterCreate: TypedEvent<[C, E], E>;
    BeforeUpdate: TypedEvent<[C, E, E], E>;
    AfterUpdate: TypedEvent<[C, E, E], E>;
    BeforeDelete: TypedEvent<[C, E], E>;
    AfterDelete: TypedEvent<[C, E], E>;
};
type EventifyOpenApiEventCollection<C = unknown, E = unknown> = EntityEvents<C, E> & Record<string, TypedEvent<unknown[], unknown>>;
interface EventifyOpenApiEvents {
}

declare function createEntityEvents<C, E>(schema: object, extra?: Record<string, TypedEvent<unknown[], unknown>>): EntityEvents<C, E> & Record<string, TypedEvent<unknown[], unknown>>;
/**
 * Internal helper for generated files to register by name.
 */
declare function registerEntityEvents(name: string, collection: EntityEvents<unknown, unknown>): void;
declare function getEventsBySchema(schema: unknown): EntityEvents<unknown, unknown> | undefined;
declare function getEventsByName(name: string): EntityEvents<unknown, unknown> | undefined;
declare const Events: EventifyOpenApiEvents & {
    For(schema: unknown): EntityEvents<unknown, unknown>;
};

type EmitterContextType = {
    from: string;
    name: string;
} | undefined;
declare function emitEntityEventsFile(pascalName: string, lowerName: string, contextType: EmitterContextType): string;
declare function emitIndexEventsFile(lowerNames: string[]): string;

type CustomWriteFile = (filePath: string, content: string, encoding: "utf-8") => Promise<void>;
type CustomMkdir = (dirPath: string, options: {
    recursive: boolean;
}) => Promise<void | string>;
type EventifyConfig = {
    /** OpenAPI input - file path, URL, or raw JSON string depending on type */
    input: string;
    /** How to interpret input */
    type?: "file" | "source" | "url";
    /** Path to tsconfig.json that holds @api/* alias. Required unless outDir given */
    tsconfigPath?: string;
    /** Explicit output dir - overrides tsconfig @api/* resolution */
    outDir?: string;
    /** Optional context type to make events typed with your session */
    contextType?: {
        from: string;
        name: string;
    };
    /** Options passed to json-ject for parsing modular specs */
    jectCfg?: JectOptions;
    /** Custom mkdir for virtual FS / browser */
    mkdir?: CustomMkdir;
    /** Custom writeFile for virtual FS / browser */
    writeFile?: CustomWriteFile;
};
declare function eventifyOpenApi(cfg: EventifyConfig): Promise<Map<string, string>>;

declare function readTargetDir(tsconfigPath: string): Promise<string>;

declare const toPascalCase: (s: string) => string;
declare const toCamelCase: (s: string) => string;

export { type CreateHandler, type CustomMkdir, type CustomWriteFile, type DeleteHandler, type EntityEvents, type EventHandler, type EventifyConfig, type EventifyOpenApiEventCollection, type EventifyOpenApiEvents, Events, TypedEvent, type UpdateHandler, createEntityEvents, emitEntityEventsFile, emitIndexEventsFile, eventifyOpenApi, getEventsByName, getEventsBySchema, readTargetDir, registerEntityEvents, toCamelCase, toPascalCase };
