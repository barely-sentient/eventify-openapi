// src/events/typed-event.ts
var TypedEvent = class {
  /**
   * Active listeners registered for this event.
   *
   * @internal
   */
  listeners = /* @__PURE__ */ new Set();
  /**
   * Registers a listener callback to handle event dispatches.
   *
   * @param handler - The callback function to execute when the event fires.
   * @returns An unsubscribe function to remove the listener.
   */
  addEventListener(handler) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }
  /**
   * Removes a previously registered listener callback.
   *
   * @param handler - The exact function reference to detach.
   */
  removeEventListener(handler) {
    this.listeners.delete(handler);
  }
  /**
   * Removes all attached listeners from this event instance.
   */
  clear() {
    this.listeners.clear();
  }
  /**
   * Gets the total number of active listeners subscribed to this event.
   */
  get listenerCount() {
    return this.listeners.size;
  }
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
  async dispatch(...args) {
    if (this.listeners.size === 0) {
      return args[args.length - 1];
    }
    if (args.length === 2) {
      let result2 = args[1];
      for (const fn of this.listeners) {
        const out = await fn(args[0], result2);
        if (out !== void 0) result2 = out;
      }
      return result2;
    }
    if (args.length === 3) {
      let after = args[2];
      const before = args[1];
      const ctx = args[0];
      for (const fn of this.listeners) {
        const out = await fn(ctx, before, after);
        if (out !== void 0) after = out;
      }
      return after;
    }
    let result = args[args.length - 1];
    for (const fn of this.listeners) {
      const out = await fn(...args.slice(0, -1), result);
      if (out !== void 0) result = out;
    }
    return result;
  }
  /**
   * Dispatches the event synchronously, ignoring promises returned by async handlers.
   *
   * Performs sequential value threading across synchronous handlers only. Returns returned Promises are ignored to prevent blocking execution.
   *
   * @param args - Arguments matching the event signature.
   * @returns The final transformed payload object after all sync handlers execute.
   */
  dispatchSync(...args) {
    if (this.listeners.size === 0) return args[args.length - 1];
    if (args.length === 2) {
      let result = args[1];
      for (const fn of this.listeners) {
        const out = fn(args[0], result);
        if (out !== void 0 && !(out instanceof Promise)) result = out;
      }
      return result;
    }
    if (args.length === 3) {
      let after = args[2];
      for (const fn of this.listeners) {
        const out = fn(args[0], args[1], after);
        if (out !== void 0 && !(out instanceof Promise)) after = out;
      }
      return after;
    }
    return args[args.length - 1];
  }
};

// src/events/registry.ts
var schemaToEvents = /* @__PURE__ */ new WeakMap();
var nameToEvents = /* @__PURE__ */ new Map();
function createEntityEvents(schema, extra) {
  const collection = {
    BeforeCreate: new TypedEvent(),
    AfterCreate: new TypedEvent(),
    BeforeUpdate: new TypedEvent(),
    AfterUpdate: new TypedEvent(),
    BeforeDelete: new TypedEvent(),
    AfterDelete: new TypedEvent(),
    ...extra
  };
  if (schema && typeof schema === "object") {
    schemaToEvents.set(schema, collection);
  }
  return collection;
}
function registerEntityEvents(name, collection) {
  nameToEvents.set(name, collection);
}
function getEventsBySchema(schema) {
  if (schema && typeof schema === "object") {
    return schemaToEvents.get(schema);
  }
  return void 0;
}
function getEventsByName(name) {
  return nameToEvents.get(name);
}
var Events = new Proxy({}, {
  get(target, prop, receiver) {
    if (prop === "For") {
      return (schema) => {
        const found = getEventsBySchema(schema);
        if (found) return found;
        return {
          BeforeCreate: { dispatch: async (_ctx, e) => e, addEventListener: () => () => {
          } },
          AfterCreate: { dispatch: async (_ctx, e) => e, addEventListener: () => () => {
          } },
          BeforeUpdate: { dispatch: async (_ctx, _b, a) => a, addEventListener: () => () => {
          } },
          AfterUpdate: { dispatch: async (_ctx, _b, a) => a, addEventListener: () => () => {
          } },
          BeforeDelete: { dispatch: async (_ctx, e) => e, addEventListener: () => () => {
          } },
          AfterDelete: { dispatch: async (_ctx, e) => e, addEventListener: () => () => {
          } }
        };
      };
    }
    if (typeof prop === "string" && nameToEvents.has(prop)) {
      return nameToEvents.get(prop);
    }
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value) {
    if (typeof prop === "string") {
      nameToEvents.set(prop, value);
      return true;
    }
    return Reflect.set(target, prop, value);
  },
  has(target, prop) {
    if (typeof prop === "string" && nameToEvents.has(prop)) return true;
    return Reflect.has(target, prop);
  },
  ownKeys(target) {
    const keys = /* @__PURE__ */ new Set([...Reflect.ownKeys(target), ...nameToEvents.keys()]);
    return [...keys];
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop === "string" && nameToEvents.has(prop)) {
      return { configurable: true, enumerable: true, value: nameToEvents.get(prop), writable: true };
    }
    const desc = Reflect.getOwnPropertyDescriptor(target, prop);
    if (desc) return desc;
    return void 0;
  }
});

// src/generator/index.ts
import { parseFromString, parseFromUri } from "json-ject";
import { resolve as resolve2, join } from "path";

// src/utils/tsconfig.ts
import { readFile, access } from "fs/promises";
import { resolve, dirname, relative } from "path";
async function readTargetDir(tsconfigPath) {
  const resolvedTsconfig = resolve(tsconfigPath);
  let raw;
  try {
    await access(resolvedTsconfig);
    raw = await readFile(resolvedTsconfig, "utf-8");
  } catch {
    throw new Error(`tsconfig not found at ${resolvedTsconfig}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const stripped = stripJsonComments(raw);
    try {
      parsed = JSON.parse(stripped);
    } catch (e) {
      throw new Error(`Failed to parse tsconfig at ${resolvedTsconfig}: ${e.message}`);
    }
  }
  const compilerOptions = parsed.compilerOptions;
  if (!compilerOptions?.paths) {
    throw new Error(`No compilerOptions.paths found in ${resolvedTsconfig} - run tsify-openapi first to generate @api/* alias`);
  }
  const apiPattern = compilerOptions.paths["@api/*"];
  if (!apiPattern || !Array.isArray(apiPattern) || apiPattern.length === 0) {
    throw new Error(`No "@api/*" path found in ${resolvedTsconfig} compilerOptions.paths - run tsify-openapi first`);
  }
  const first = apiPattern[0];
  const cleaned = first.replace(/\/\*$/, "").replace(/\*$/, "");
  const tsconfigDir = dirname(resolvedTsconfig);
  const targetDir = resolve(tsconfigDir, cleaned);
  return targetDir;
}
function stripJsonComments(raw) {
  let out = "";
  let inString = false;
  let inBlock = false;
  let inLine = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    const next = raw[i + 1];
    if (inLine) {
      if (c === "\n") {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === "*" && next === "/") {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (escaped) {
        escaped = false;
      } else if (c === "\\") {
        escaped = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
    } else if (c === "/" && next === "/") {
      inLine = true;
      i++;
    } else if (c === "/" && next === "*") {
      inBlock = true;
      i++;
    } else {
      out += c;
    }
  }
  return out;
}

// src/utils/casing.ts
var toPascalCase = (s) => {
  return s.replace(/^[^a-zA-Z]+/, "").split(/[^a-zA-Z0-9]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("") || "Anonymous";
};
var toCamelCase = (s) => {
  const pascal = toPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

// src/generator/emitter.ts
function emitEntityEventsFile(pascalName, lowerName, contextType) {
  const hasCtx = !!contextType;
  const ctxImport = hasCtx ? `import type { ${contextType.name} } from '${contextType.from}';
` : "";
  const ctxGeneric = hasCtx ? contextType.name : "unknown";
  return `// Generated by eventify-openapi - do not edit. Changes will be overwritten.
// For custom events create a separate file e.g. ${lowerName}.custom.events.ts and follow:
//   import { Events } from 'eventify-openapi';
//   Events.${pascalName}.MyCustomEvent = new TypedEvent<[${ctxGeneric}, ${pascalName}], ${pascalName}>();

import { ${pascalName}, ${pascalName}Schema } from '@api/${lowerName}';
import { Events, createEntityEvents } from 'eventify-openapi';
${ctxImport}
// 6 base events are created with correct signatures:
// - BeforeCreate: TypedEvent<[${ctxGeneric}, ${pascalName}], ${pascalName}> (ctx, entity) => ${pascalName}
// - AfterCreate: TypedEvent<[${ctxGeneric}, ${pascalName}], ${pascalName}> (ctx, entity) => ${pascalName}
// - BeforeUpdate: TypedEvent<[${ctxGeneric}, ${pascalName}, ${pascalName}], ${pascalName}> (ctx, before, after) => ${pascalName}
// - AfterUpdate: TypedEvent<[${ctxGeneric}, ${pascalName}, ${pascalName}], ${pascalName}> (ctx, before, after) => ${pascalName}
// - BeforeDelete: TypedEvent<[${ctxGeneric}, ${pascalName}], ${pascalName}> (ctx, entity) => ${pascalName}
// - AfterDelete: TypedEvent<[${ctxGeneric}, ${pascalName}], ${pascalName}> (ctx, entity) => ${pascalName}
export const ${pascalName}Events = createEntityEvents<${ctxGeneric}, ${pascalName}>(${pascalName}Schema);

(Events as unknown as Record<string, unknown>).${pascalName} = ${pascalName}Events;

declare module "eventify-openapi" {
  interface EventifyOpenApiEvents {
    ${pascalName}: typeof ${pascalName}Events;
  }
  var Events: EventifyOpenApiEvents;
}
`;
}
function emitIndexEventsFile(lowerNames) {
  const imports = lowerNames.map((n) => `import './${n}.events.js';`).join("\n");
  return `// Generated by eventify-openapi - do not edit. Changes will be overwritten.
// Barrel file - import this once at startup to register all entity events.
//   import '@api/index.events';

${imports}
export {};
`;
}

// src/generator/index.ts
async function eventifyOpenApi(cfg) {
  const type = cfg.type ?? "file";
  let targetDir;
  if (cfg.outDir) {
    targetDir = resolve2(cfg.outDir);
  } else {
    const tsconfigPath = cfg.tsconfigPath ?? "./tsconfig.json";
    targetDir = await readTargetDir(tsconfigPath);
  }
  const raw = await (type === "source" ? parseFromString(cfg.input, cfg.jectCfg ?? {}) : parseFromUri(cfg.input, cfg.jectCfg ?? {}));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid OpenAPI document: expected object");
  }
  const doc = raw;
  if (!doc.paths || typeof doc.paths !== "object" || Array.isArray(doc.paths)) {
    throw new Error("Invalid OpenAPI document: missing paths");
  }
  const schemas = doc.components?.schemas ?? doc.definitions ?? {};
  const schemaKeys = Object.keys(schemas);
  if (schemaKeys.length === 0) {
    throw new Error("No schemas found in OpenAPI document (components.schemas / definitions empty) - nothing to generate");
  }
  const result = /* @__PURE__ */ new Map();
  const lowerNames = [];
  for (const rawName of schemaKeys) {
    const pascal = toPascalCase(rawName);
    const lower = rawName.toLowerCase();
    lowerNames.push(lower);
    const code = emitEntityEventsFile(pascal, lower, cfg.contextType);
    result.set(`${lower}.events`, code);
  }
  const barrel = emitIndexEventsFile(lowerNames);
  result.set("index.events", barrel);
  let mkdirImpl = cfg.mkdir;
  let writeFileImpl = cfg.writeFile;
  let readFileImpl = cfg.readFile;
  if (!mkdirImpl || !writeFileImpl || !readFileImpl) {
    const nodeFs = await import("fs/promises");
    mkdirImpl = mkdirImpl ?? nodeFs.mkdir;
    writeFileImpl = writeFileImpl ?? nodeFs.writeFile;
    readFileImpl = readFileImpl ?? nodeFs.readFile;
  }
  const outDirResolved = resolve2(targetDir);
  await mkdirImpl(outDirResolved, { recursive: true });
  for (const [fileName, code] of result.entries()) {
    const filePath = join(outDirResolved, `${fileName}.ts`);
    await writeFileImpl(filePath, code, "utf-8");
  }
  for (const lowerName of lowerNames) {
    const entityPath = join(outDirResolved, `${lowerName}.ts`);
    try {
      const entityCode = await readFileImpl(entityPath, "utf-8");
      const eventImport = `void import("./${lowerName}.events.js");`;
      if (!entityCode.includes(eventImport)) {
        await writeFileImpl(entityPath, `${entityCode.trimEnd()}

${eventImport}
`, "utf-8");
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return result;
}
export {
  Events,
  TypedEvent,
  createEntityEvents,
  emitEntityEventsFile,
  emitIndexEventsFile,
  eventifyOpenApi,
  getEventsByName,
  getEventsBySchema,
  readTargetDir,
  registerEntityEvents,
  toCamelCase,
  toPascalCase
};
