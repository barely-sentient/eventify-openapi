// src/events/typed-event.ts
var TypedEvent = class {
  listeners = /* @__PURE__ */ new Set();
  addEventListener(handler) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }
  removeEventListener(handler) {
    this.listeners.delete(handler);
  }
  clear() {
    this.listeners.clear();
  }
  get listenerCount() {
    return this.listeners.size;
  }
  /**
   * Dispatches sequentially, piping the return value through each listener.
   * For 2-arg events (ctx, entity) the entity is threaded.
   * For 3-arg events (ctx, before, after) the `after` value is threaded while `before` is fixed.
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
   * Synchronous dispatch - only calls sync handlers, ignores async returns
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
  set(target, prop, value, receiver) {
    if (typeof prop === "string") {
      nameToEvents.set(prop, value);
    }
    return Reflect.set(target, prop, value, receiver);
  },
  has(target, prop) {
    if (typeof prop === "string" && nameToEvents.has(prop)) return true;
    return Reflect.has(target, prop);
  },
  ownKeys(target) {
    return [...Reflect.ownKeys(target), ...nameToEvents.keys()];
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop === "string" && nameToEvents.has(prop)) {
      return { configurable: true, enumerable: true, value: nameToEvents.get(prop), writable: true };
    }
    return Reflect.getOwnPropertyDescriptor(target, prop);
  }
});

// node_modules/json-ject/dist/index.js
var WebLoader = async (url, jectOptions) => {
  if (jectOptions.customUrlLoader) {
    return jectOptions.customUrlLoader(url);
  }
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (e) {
    console.error("JECT", { e, url });
  }
  return void 0;
};
var FileLoader = async (path, jectOptions) => {
  if (jectOptions.customFileLoader) {
    return jectOptions.customFileLoader(path);
  }
  const fs = await import("fs/promises");
  try {
    await fs.access(path);
    return JSON.parse(
      await fs.readFile(path, {
        encoding: "utf-8"
      })
    );
  } catch (e) {
    console.error("JECT", { e, path });
    return void 0;
  }
};
var LoadJson = async (path, jectOptions) => {
  const isNode = typeof process !== "undefined" && typeof process.versions?.node === "string";
  return isNode ? FileLoader(path, jectOptions) : WebLoader(path, jectOptions);
};
var requireDirective = {
  /**
   * The node name that activates the directive.
   */
  targetNodeName: "@require",
  /**
   * Resolves one or more resource paths into a JSON object.
   *
   * When `input` is a string, the referenced resource is loaded directly.
   *
   * When `input` is an array, all resources are loaded concurrently and
   * their resulting objects are merged from left to right. Later resources
   * override properties defined by earlier resources.
   *
   * @param input - A resource path or an ordered collection of resource
   * paths to load.
   *
   * @returns A promise resolving to the loaded JSON object, or `undefined`
   * if the resource or resources could not be loaded.
   */
  transform: async (input, jectOptions) => {
    if (typeof input === "string") {
      return LoadJson(input, jectOptions);
    }
    const results = await Promise.all(
      input.map((path) => LoadJson(path, jectOptions))
    );
    if (results.some((result) => result === void 0)) {
      return void 0;
    }
    return Object.assign({}, ...results);
  }
};
var createVariablesDirective = (variables) => ({
  /**
   * The node name that activates the variable directive.
   */
  targetNodeName: "@var",
  /**
   * Resolves the supplied variable name against the configured variables.
   *
   * @param variableName - The name of the variable to resolve.
   *
   * @returns The value associated with the variable, or `undefined` when
   * the variable has not been defined.
   */
  transform: async (variableName) => {
    if (!Object.prototype.hasOwnProperty.call(variables, variableName)) {
      console.warn(`JECT: Unknown variable "${variableName}"`);
      return void 0;
    }
    return variables[variableName];
  }
});
var defaultDirective = {
  /**
   * The node name that activates the default directive.
   */
  targetNodeName: "@default",
  /**
   * Resolves a value and falls back to the configured default when the
   * value is undefined.
   *
   * @param input - The value and fallback configuration.
   *
   * @returns The supplied value when defined; otherwise the default value.
   */
  transform: async (input, jectConfig, resolve3) => {
    let value;
    if ("value" in input) {
      value = input.value;
    } else if (resolve3) {
      const keys = Object.keys(input).filter((k) => k !== "default");
      if (keys.length > 0) {
        value = await resolve3({ [keys[0]]: input[keys[0]] });
      }
    }
    return value !== void 0 ? value : input.default;
  },
  /**
   * Resolve the `value` property before the transform is invoked so that
   * nested directives such as `@env` are evaluated first.
   */
  resolveInput: true
};
var envDirective = {
  /**
   * The node name that activates the environment directive.
   */
  targetNodeName: "@env",
  /**
   * Resolves the supplied environment variable name against
   * `process.env`.
   *
   * @param envName - The name of the environment variable to resolve.
   *
   * @returns A promise resolving to the environment variable's value,
   * or `undefined` when the specified variable is not defined.
   */
  transform: async (envName) => {
    return process.env[envName];
  }
};
var createDirectives = (options) => {
  const directives = [
    {
      ...requireDirective,
      transformOutput: async (value) => {
        return handleNode(value, directives, options);
      }
    },
    ...options.directives ?? [],
    envDirective,
    defaultDirective,
    // always last, as this injects variables.
    createVariablesDirective(options.variables ?? {})
  ];
  return directives;
};
var parseFromString = async (source, options = {}) => {
  const result = JSON.parse(source);
  if (result === null || result === void 0) {
    return result;
  }
  const directives = createDirectives(options);
  return await handleNode(result, directives, options);
};
var parseFromUri = async (path, options = {}) => {
  const resolved = await LoadJson(path, options);
  if (resolved === void 0) {
    return void 0;
  }
  const directives = createDirectives(options);
  const result = await handleNode(resolved, directives, options);
  return result;
};
var handleNode = async (node, directives, jectOptions) => {
  if (node === null || typeof node !== "object") {
    return node;
  }
  if (Array.isArray(node)) {
    return Promise.all(
      node.map((entry) => handleNode(entry, directives, jectOptions))
    );
  }
  const object = node;
  const directive = directives.find(
    (entry) => Object.prototype.hasOwnProperty.call(
      object,
      entry.targetNodeName
    )
  );
  if (directive) {
    let input = object[directive.targetNodeName];
    if (directive.resolveInput && typeof input === "object" && input !== null) {
      const resolved = { ...input };
      const keys = directive.resolveInput === true ? Object.keys(resolved) : directive.resolveInput;
      for (const key of keys) {
        if (key in resolved) {
          resolved[key] = await handleNode(resolved[key], directives, jectOptions);
        }
      }
      input = resolved;
    }
    const result = await directive.transform(input, jectOptions, (node2) => handleNode(node2, directives, jectOptions));
    const output = directive.transformOutput ? await directive.transformOutput(result) : result;
    return handleNode(output, directives, jectOptions);
  }
  const entries = await Promise.all(
    Object.entries(object).map(async ([key, value]) => {
      return [
        key,
        await handleNode(value, directives, jectOptions)
      ];
    })
  );
  return Object.fromEntries(entries);
};

// src/generator/index.ts
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
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
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
// - BeforeCreate: TypedEvent<[${ctxGeneric}, ${pascalName}], ${pascalName}>  (ctx, entity) => ${pascalName}
// - AfterCreate:  TypedEvent<[${ctxGeneric}, ${pascalName}], ${pascalName}>  (ctx, entity) => ${pascalName}
// - BeforeUpdate: TypedEvent<[${ctxGeneric}, ${pascalName}, ${pascalName}], ${pascalName}>  (ctx, before, after) => ${pascalName}
// - AfterUpdate:  TypedEvent<[${ctxGeneric}, ${pascalName}, ${pascalName}], ${pascalName}>  (ctx, before, after) => ${pascalName}
// - BeforeDelete: TypedEvent<[${ctxGeneric}, ${pascalName}], ${pascalName}>  (ctx, entity) => ${pascalName}
// - AfterDelete:  TypedEvent<[${ctxGeneric}, ${pascalName}], ${pascalName}>  (ctx, entity) => ${pascalName}
export const ${pascalName}Events = createEntityEvents<${ctxGeneric}, ${pascalName}>(${pascalName}Schema);

(Events as unknown as Record<string, unknown>).${pascalName} = ${pascalName}Events;

declare global {
  interface EventifyOpenApiEvents {
    ${pascalName}: typeof ${pascalName}Events;
  }
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
  if (!mkdirImpl || !writeFileImpl) {
    const nodeFs = await import("fs/promises");
    mkdirImpl = mkdirImpl ?? nodeFs.mkdir;
    writeFileImpl = writeFileImpl ?? nodeFs.writeFile;
  }
  const outDirResolved = resolve2(targetDir);
  await mkdirImpl(outDirResolved, { recursive: true });
  for (const [fileName, code] of result.entries()) {
    const filePath = join(outDirResolved, `${fileName}.ts`);
    await writeFileImpl(filePath, code, "utf-8");
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
