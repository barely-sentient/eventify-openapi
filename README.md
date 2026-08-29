# eventify-openapi

Generate a fully-typed, pipelined domain event catalog directly from an OpenAPI specification — seamlessly layered on top of [`tsify-openapi`](https://github.com/barely-sentient/tsify-openapi).

## Playground
[View playground](https://barely-sentient.github.io/tsify-openapi-playground/)

In the topbar, next to security is a checkbox **Generate Events** upon enabling
this, you'll be able to see the generated event catalog files. 

`eventify-openapi` reads your `openapi.json` alongside `tsconfig.json`, reuses generated schemas and types from `tsify-openapi`, and emits per-entity event files (`<entity>.events.ts`) and a central barrel registry (`index.events.ts`).

Every schema automatically receives strongly-typed lifecycle hooks: `BeforeCreate`, `AfterCreate`, `BeforeUpdate`, `AfterUpdate`, `BeforeDelete`, and `AfterDelete`, with end-to-end `SessionCtx` and entity type inference.

---

## Architecture & Integration

`eventify-openapi` relies on `tsify-openapi` running first to establish your core type models and schema references.

```
                  ┌───────────────────────────────┐
                  │         openapi.json          │
                  └───────────────┬───────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌─────────────────┐                               ┌──────────────────┐
│ tsifyOpenApi()  │                               │ eventifyOpenApi()│
└────────┬────────┘                               └────────┬─────────┘
         │                                                 │
         │ Generates types & @api/* alias                  │ Reads @api/* alias
         ▼                                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                       outDir/ (e.g., src/generated)                │
│ ├─ user.ts           (User type, UserSchema, UserApi)              │
│ ├─ product.ts        (Product type, ProductSchema, ProductApi)    │
│ ├─ user.events.ts    (User lifecycle events & typed hooks)  ◄──────┤
│ ├─ product.events.ts (Product lifecycle events & typed hooks) ◄───┤
│ └─ index.events.ts   (Central registration barrel)            ◄────┘
└────────────────────────────────────────────────────────────────────┘

```

### Build Sequence

1. **`tsify-openapi`**:
* Parses `openapi.json` schemas via `json-ject`.
* Outputs entity models (`user.ts`, `product.ts`, etc.) into `outDir`.
* Configures `tsconfig.json` path mapping:
```json
{
  "compilerOptions": {
    "paths": {
      "@api/*": ["./src/generated/*"],
      "@api": ["./src/generated/index.ts"]
    }
  }
}

```




2. **`eventify-openapi`**:
* Resolves target output directory directly from `tsconfig.json` (`compilerOptions.paths["@api/*"]`).
* Generates matching `<entity>.events.ts` modules that import entities directly from `@api/<entity>`.
* Registers typed event bundles on the global `Events` proxy object.



---

## Installation

```bash
npm install eventify-openapi tsify-openapi json-ject

```

* **Node.js**: `>= 18.0.0`
* **TypeScript**: `>= 5.9.0`

---

## Quick Start

### 1. Generate Models via `tsify-openapi`

```typescript
import { tsifyOpenApi } from "tsify-openapi";

await tsifyOpenApi({
  input: "openapi.json",
  type: "file",
  outDir: "src/generated",
  tsconfigPath: "tsconfig.json"
});

```

### 2. Generate Event Catalog via `eventify-openapi`

```typescript
import { eventifyOpenApi } from "eventify-openapi";

await eventifyOpenApi({
  input: "openapi.json",
  type: "file",
  tsconfigPath: "tsconfig.json",
  contextType: { from: "./ctx.js", name: "SessionCtx" }
});

```

### 3. Register Event Catalog at Startup

Import the barrel module early in your application lifecycle (e.g., `src/app.ts` or `src/index.ts`):

```typescript
import "@api/index.events";

```

### 4. Wire Lifecycle Hooks into Repositories

```typescript
import { Events } from "eventify-openapi";
import { UserSchema, type User } from "@api/user";
import type { SessionCtx } from "./ctx.js";

export class FrameworkRepository<T> {
  constructor(private readonly schema: unknown) {}

  async create(ctx: SessionCtx, data: T): Promise<T> {
    const payload = await Events.For(this.schema).BeforeCreate.dispatch(ctx, data);
    // await db.insert(payload);
    return Events.For(this.schema).AfterCreate.dispatch(ctx, payload);
  }

  async update(ctx: SessionCtx, before: T, after: T): Promise<T> {
    const payload = await Events.For(this.schema).BeforeUpdate.dispatch(ctx, before, after);
    // await db.update(payload);
    return Events.For(this.schema).AfterUpdate.dispatch(ctx, before, payload);
  }

  async delete(ctx: SessionCtx, entity: T): Promise<T> {
    const target = await Events.For(this.schema).BeforeDelete.dispatch(ctx, entity);
    // await db.delete(target);
    await Events.For(this.schema).AfterDelete.dispatch(ctx, target);
    return target;
  }
}

export class UserRepository extends FrameworkRepository<User> {
  constructor() {
    super(UserSchema);
  }
}

```

### 5. Attach Strongly-Typed Event Handlers

```typescript
import { Events } from "eventify-openapi";

// Handlers infer context and entity payload types automatically
Events.User.BeforeCreate.addEventListener(async (ctx, user) => {
  if (!user.createdAt) {
    return { ...user, createdAt: new Date().toISOString() };
  }
  return user;
});

Events.User.BeforeUpdate.addEventListener(async (ctx, before, after) => {
  // Audit or mutate state before persisting changes
  return after;
});

```

---

## Lifecycle Event Specifications

Each schema generates 6 default lifecycle hooks:

| Event Name | Listener Signature | Threaded Parameter |
| --- | --- | --- |
| **`BeforeCreate`** | `(ctx: Ctx, entity: E) => E | Promise<E>` | `entity` |
| **`AfterCreate`** | `(ctx: Ctx, entity: E) => E | Promise<E>` | `entity` |
| **`BeforeUpdate`** | `(ctx: Ctx, before: E, after: E) => E | Promise<E>` | `after` (`before` is immutable) |
| **`AfterUpdate`** | `(ctx: Ctx, before: E, after: E) => E | Promise<E>` | `after` |
| **`BeforeDelete`** | `(ctx: Ctx, entity: E) => E | Promise<E>` | `entity` |
| **`AfterDelete`** | `(ctx: Ctx, entity: E) => E | Promise<E>` | `entity` |

### Pipelined Execution Behavior

* **Waterfall Delivery**: Listeners execute sequentially in registration order. The return value of listener $N$ becomes the target payload for listener $N+1$.
* **Value Preservation**: Returning `undefined` from a listener preserves the existing payload without modifying it.
* **Synchronous Dispatch**: `dispatchSync()` executes synchronous listeners sequentially while bypassing promises returned by asynchronous handlers.

---

## Extending Generated Events

Generated files are overwritten during regeneration. Append custom events in separate source files to preserve changes.

```typescript
// src/generated/user.custom.events.ts
import { Events, TypedEvent } from "eventify-openapi";
import type { SessionCtx } from "../ctx.js";
import type { User } from "@api/user";

// Attach custom typed event instance to registered entity
Events.User.OnPasswordReset = new TypedEvent<[SessionCtx, User], User>();

```

---

## Configuration Reference

```typescript
export type EventifyConfig = {
  /** OpenAPI input - file path, URL, or raw JSON string. */
  input: string;
  /** Interpretation strategy for input. Defaults to "file". */
  type?: "file" | "source" | "url";
  /** Path to tsconfig.json defining @api/* path mapping. Defaults to "./tsconfig.json". */
  tsconfigPath?: string;
  /** Direct output directory path override. */
  outDir?: string;
  /** Type import specification for injection into event signatures. */
  contextType?: { from: string; name: string };
  /** json-ject parsing configuration for modular OpenAPI specifications. */
  jectCfg?: JectOptions;
  /** Custom directory creation hook for virtual or in-memory file systems. */
  mkdir?: CustomMkdir;
  /** Custom file writing hook for virtual or in-memory file systems. */
  writeFile?: CustomWriteFile;
};

```

---

## License
MIT