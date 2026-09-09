import { parseFromString, parseFromUri } from "json-ject";
import type { JectOptions } from "json-ject";
import { resolve, join } from "node:path";
import { readTargetDir } from "../utils/tsconfig.js";
import { toPascalCase } from "../utils/casing.js";
import { emitEntityEventsFile, emitIndexEventsFile } from "./emitter.js";

/**
 * Custom file write function signature for virtual or browser-based file systems.
 *
 * @param filePath - The target path where the file should be saved.
 * @param content - The UTF-8 text content to write.
 * @param encoding - File encoding, strictly `"utf-8"`.
 * @returns A Promise that resolves once writing completes.
 */
export type CustomWriteFile = (filePath: string, content: string, encoding: "utf-8") => Promise<void>;

/**
 * Custom file read function for virtual or browser-based file systems.
 */
export type CustomReadFile = (filePath: string, encoding: "utf-8") => Promise<string>;

/**
 * Custom directory creation function signature for virtual or browser-based file systems.
 *
 * @param dirPath - The target directory path to create.
 * @param options - Configuration options, including recursive directory creation.
 * @returns A Promise resolving when creation succeeds.
 */
export type CustomMkdir = (dirPath: string, options: { recursive: boolean }) => Promise<void | string>;

/**
 * Configuration options for orchestrating OpenAPI event generation.
 */
export type EventifyConfig = {
    /** OpenAPI document source — file path, URL, or raw JSON string depending on `type`. */
    input: string;
    /** Format interpretation strategy for the provided `input`. Defaults to `"file"`. */
    type?: "file" | "source" | "url";
    /** Path to `tsconfig.json` defining `@api/*` path aliases. Required if `outDir` is unspecified. */
    tsconfigPath?: string;
    /** Explicit target output directory, overriding `tsconfigPath` path resolution. */
    outDir?: string;
    /** Context type configuration for typed event handlers. */
    contextType?: { from: string; name: string };
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
export async function eventifyOpenApi(cfg: EventifyConfig): Promise<Map<string, string>> {
    const type = cfg.type ?? "file";

    // 1. Resolve targetDir
    let targetDir: string;
    if (cfg.outDir) {
        targetDir = resolve(cfg.outDir);
    } else {
        const tsconfigPath = cfg.tsconfigPath ?? "./tsconfig.json";
        targetDir = await readTargetDir(tsconfigPath);
    }

    // 2. Load OpenAPI document
    const raw: unknown = await (type === "source"
        ? parseFromString(cfg.input, cfg.jectCfg ?? {})
        : parseFromUri(cfg.input, cfg.jectCfg ?? {}));

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("Invalid OpenAPI document: expected object");
    }

    const doc = raw as {
        components?: { schemas?: Record<string, unknown> };
        definitions?: Record<string, unknown>;
        paths?: unknown;
    };

    // Validate minimally
    if (!doc.paths || typeof doc.paths !== "object" || Array.isArray(doc.paths)) {
        throw new Error("Invalid OpenAPI document: missing paths");
    }

    const schemas = (doc.components?.schemas ?? doc.definitions ?? {}) as Record<string, unknown>;
    const schemaKeys = Object.keys(schemas);

    if (schemaKeys.length === 0) {
        throw new Error("No schemas found in OpenAPI document (components.schemas / definitions empty) - nothing to generate");
    }

    // 3. Generate per-entity
    const result = new Map<string, string>();
    const lowerNames: string[] = [];

    for (const rawName of schemaKeys) {
        const pascal = toPascalCase(rawName);
        const lower = rawName.toLowerCase();
        lowerNames.push(lower);
        const code = emitEntityEventsFile(pascal, lower, cfg.contextType);
        result.set(`${lower}.events`, code);
    }

    // 4. Generate barrel
    const barrel = emitIndexEventsFile(lowerNames);
    result.set("index.events", barrel);

    // 5. Write to disk
    let mkdirImpl = cfg.mkdir;
    let writeFileImpl = cfg.writeFile;
    let readFileImpl = cfg.readFile;
    if (!mkdirImpl || !writeFileImpl || !readFileImpl) {
        const nodeFs = await import("node:fs/promises");
        mkdirImpl = mkdirImpl ?? (nodeFs.mkdir as unknown as CustomMkdir);
        writeFileImpl = writeFileImpl ?? (nodeFs.writeFile as unknown as CustomWriteFile);
        readFileImpl = readFileImpl ?? (nodeFs.readFile as unknown as CustomReadFile);
    }

    const outDirResolved = resolve(targetDir);
    await mkdirImpl(outDirResolved, { recursive: true });

    for (const [fileName, code] of result.entries()) {
        const filePath = join(outDirResolved, `${fileName}.ts`);
        await writeFileImpl(filePath, code, "utf-8");
    }

    // Link each existing tsify entity to its event module without creating an
    // eager ESM cycle during entity module initialization.
    for (const lowerName of lowerNames) {
        const entityPath = join(outDirResolved, `${lowerName}.ts`);
        try {
            const entityCode = await readFileImpl!(entityPath, "utf-8");
            const eventImport = `void import("./${lowerName}.events.js");`;
            if (!entityCode.includes(eventImport)) {
                await writeFileImpl(entityPath, `${entityCode.trimEnd()}\n\n${eventImport}\n`, "utf-8");
            }
        } catch (error) {
            if ((error as { code?: string }).code !== "ENOENT") throw error;
        }
    }

    return result;
}

export { emitEntityEventsFile, emitIndexEventsFile };