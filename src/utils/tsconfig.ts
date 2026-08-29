import { readFile, access } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";

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
export async function readTargetDir(tsconfigPath: string): Promise<string> {
    const resolvedTsconfig = resolve(tsconfigPath);
    let raw: string;
    try {
        await access(resolvedTsconfig);
        raw = await readFile(resolvedTsconfig, "utf-8");
    } catch {
        throw new Error(`tsconfig not found at ${resolvedTsconfig}`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        try {
            parsed = JSON.parse(stripped);
        } catch (e) {
            throw new Error(`Failed to parse tsconfig at ${resolvedTsconfig}: ${(e as Error).message}`);
        }
    }

    const compilerOptions = (parsed as { compilerOptions?: { paths?: Record<string, string[]> } }).compilerOptions;
    if (!compilerOptions?.paths) {
        throw new Error(`No compilerOptions.paths found in ${resolvedTsconfig} - run tsify-openapi first to generate @api/* alias`);
    }

    const apiPattern = compilerOptions.paths["@api/*"];
    if (!apiPattern || !Array.isArray(apiPattern) || apiPattern.length === 0) {
        throw new Error(`No "@api/*" path found in ${resolvedTsconfig} compilerOptions.paths - run tsify-openapi first`);
    }

    const first = apiPattern[0] as string;
    // first is like "playground/generated/*" or "./src/generated/*"
    const cleaned = first.replace(/\/\*$/, "").replace(/\*$/, "");
    const tsconfigDir = dirname(resolvedTsconfig);
    const targetDir = resolve(tsconfigDir, cleaned);
    return targetDir;
}

/**
 * Strips single-line (`//`) and multi-line (`/* ... *\/`) comments from a JSON string.
 *
 * Useful for parsing non-standard JSON files like `tsconfig.json` that include comments.
 *
 * @param raw - The raw JSON string containing comments.
 * @returns The cleaned JSON string with all comments removed.
 */
export function stripJsonComments(raw: string): string {
    return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * Computes a relative path between two absolute paths using POSIX forward slashes.
 *
 * Normalizes Windows-style backslashes (`\`) to forward slashes (`/`) for standard cross-platform module imports.
 *
 * @param from - The base source path.
 * @param to - The target path.
 * @returns The POSIX-formatted relative path string.
 *
 * @example
 * ```ts
 * relativePosix("C:\\project\\src", "C:\\project\\src\\utils\\file.ts");
 * // Returns: "utils/file.ts"
 * ```
 */
export function relativePosix(from: string, to: string): string {
    return relative(from, to).replace(/\\/g, "/");
}