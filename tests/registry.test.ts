import { TypedEvent } from "../src/events/typed-event.js";
import {
  createEntityEvents,
  getEventsByName,
  getEventsBySchema,
  registerEntityEvents,
  Events,
} from "../src/events/registry.js";
import type { EntityEvents } from "../src/events/types.js";

describe("registry", () => {
  describe("createEntityEvents", () => {
    it("creates 6 base events as TypedEvent instances", () => {
      const schema = { type: "object" };
      const ev = createEntityEvents<unknown, { id: string }>(schema);
      expect(ev.BeforeCreate).toBeInstanceOf(TypedEvent);
      expect(ev.AfterCreate).toBeInstanceOf(TypedEvent);
      expect(ev.BeforeUpdate).toBeInstanceOf(TypedEvent);
      expect(ev.AfterUpdate).toBeInstanceOf(TypedEvent);
      expect(ev.BeforeDelete).toBeInstanceOf(TypedEvent);
      expect(ev.AfterDelete).toBeInstanceOf(TypedEvent);
      expect(Object.keys(ev)).toEqual(
        expect.arrayContaining([
          "BeforeCreate",
          "AfterCreate",
          "BeforeUpdate",
          "AfterUpdate",
          "BeforeDelete",
          "AfterDelete",
        ])
      );
    });

    it("registers WeakMap for For(schema) lookup", () => {
      const schema = { x: 1 };
      const ev = createEntityEvents(schema);
      expect(getEventsBySchema(schema)).toBe(ev);
      expect(getEventsBySchema({ x: 1 })).toBeUndefined(); // different identity
    });

    it("supports extra custom events", () => {
      const schema = {};
      const custom = new TypedEvent<[unknown, number], number>();
      const ev = createEntityEvents(schema, { MyCustom: custom as unknown as TypedEvent<unknown[], unknown> });
      expect((ev as Record<string, unknown>).MyCustom).toBe(custom);
      expect(ev.BeforeCreate).toBeInstanceOf(TypedEvent);
    });

    it("extra can override base key (spread order)", () => {
      const schema = {};
      const override = new TypedEvent<[unknown, string], string>();
      const ev = createEntityEvents(schema, { BeforeCreate: override as unknown as TypedEvent<unknown[], unknown> });
      expect(ev.BeforeCreate).toBe(override);
    });

    it("handles null/undefined schema gracefully", () => {
      expect(() => createEntityEvents(null as unknown as object)).not.toThrow();
      expect(() => createEntityEvents(undefined as unknown as object)).not.toThrow();
      const ev = createEntityEvents(null as unknown as object);
      expect(ev.BeforeCreate).toBeInstanceOf(TypedEvent);
      expect(getEventsBySchema(null)).toBeUndefined();
    });
  });

  describe("getEventsBySchema / getEventsByName", () => {
    it("returns undefined for non-object schema", () => {
      expect(getEventsBySchema(null)).toBeUndefined();
      expect(getEventsBySchema(undefined)).toBeUndefined();
      expect(getEventsBySchema("string" as unknown as object)).toBeUndefined();
      expect(getEventsBySchema(42 as unknown as object)).toBeUndefined();
    });

    it("getEventsByName returns undefined for unknown name", () => {
      expect(getEventsByName("__nonexistent_" + Math.random())).toBeUndefined();
    });

    it("registerEntityEvents stores and retrieves", () => {
      const name = "RegTest_" + Date.now() + "_" + Math.random();
      const col = createEntityEvents({});
      registerEntityEvents(name, col as unknown as EntityEvents<unknown, unknown>);
      expect(getEventsByName(name)).toBe(col);
    });
  });

  describe("Events proxy", () => {
    const unique = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    it("For(unregistered) returns no-op that pipes through", async () => {
      const unreg = { id: "unreg_schema_" + Math.random() };
      const noOp = Events.For(unreg);
      expect(noOp.BeforeCreate).toBeDefined();
      expect(noOp.AfterCreate).toBeDefined();
      expect(noOp.BeforeUpdate).toBeDefined();
      // dispatch should return input
      expect(await noOp.BeforeCreate.dispatch({} as never, { id: "1" } as never)).toEqual({ id: "1" });
      expect(await noOp.BeforeUpdate.dispatch({} as never, { id: "1" } as never, { id: "2" } as never)).toEqual({ id: "2" });
      expect(await noOp.BeforeDelete.dispatch({} as never, { id: "3" } as never)).toEqual({ id: "3" });
      // addEventListener on no-op should be no-op function
      expect(() => noOp.BeforeCreate.addEventListener(() => ({} as never))).not.toThrow();
    });

    it("For(registered schema) returns same collection", async () => {
      const schema = { _t: unique("schema") };
      const ev = createEntityEvents(schema);
      ev.BeforeCreate.addEventListener(async (_ctx, e: { v: number }) => ({ v: e.v + 1 }));
      const viaFor = Events.For(schema);
      expect(viaFor).toBe(ev);
      expect(await viaFor.BeforeCreate.dispatch({} as never, { v: 1 } as never)).toEqual({ v: 2 });
    });

    it("For(null) returns no-op", async () => {
      const noOp = Events.For(null);
      expect(await noOp.BeforeCreate.dispatch({} as never, { id: 1 } as never)).toEqual({ id: 1 });
    });

    it("assignment via Events.<Name> = collection and retrieval", async () => {
      const name = unique("ProxyAssign");
      const schema = {};
      const col = createEntityEvents(schema);
      (Events as unknown as Record<string, unknown>)[name] = col;
      expect((Events as unknown as Record<string, unknown>)[name]).toBe(col);
      expect(getEventsByName(name)).toBe(col);
      // Proxy get should return same
      expect((Events as unknown as Record<string, EntityEvents<unknown, unknown>>)[name]).toBe(col);
    });

    it("has trap: 'X' in Events", () => {
      const name = unique("HasTrap");
      const col = createEntityEvents({});
      (Events as unknown as Record<string, unknown>)[name] = col;
      expect(name in Events).toBe(true);
      expect("___never_" + Math.random() in Events).toBe(false);
    });

    it("ownKeys includes registered names", () => {
      const n1 = unique("OwnKeys1");
      const n2 = unique("OwnKeys2");
      (Events as unknown as Record<string, unknown>)[n1] = createEntityEvents({});
      (Events as unknown as Record<string, unknown>)[n2] = createEntityEvents({});
      const keys = Reflect.ownKeys(Events) as string[];
      expect(keys).toEqual(expect.arrayContaining([n1, n2]));
    });

    it("getOwnPropertyDescriptor returns enumerable descriptor", () => {
      const name = unique("Desc");
      const col = createEntityEvents({});
      (Events as unknown as Record<string, unknown>)[name] = col;
      const desc = Object.getOwnPropertyDescriptor(Events, name);
      expect(desc).toBeDefined();
      expect(desc?.enumerable).toBe(true);
      expect(desc?.value).toBe(col);
      expect(desc?.configurable).toBe(true);
    });

    it("supports overwriting existing name", () => {
      const name = unique("Overwrite");
      const c1 = createEntityEvents({});
      const c2 = createEntityEvents({});
      (Events as unknown as Record<string, unknown>)[name] = c1;
      expect((Events as unknown as Record<string, unknown>)[name]).toBe(c1);
      (Events as unknown as Record<string, unknown>)[name] = c2;
      expect((Events as unknown as Record<string, unknown>)[name]).toBe(c2);
      expect(getEventsByName(name)).toBe(c2);
    });

    it("For returns no-op with addEventListener being no-op function", async () => {
      const col = Events.For({ never: 1 });
      const off = col.BeforeCreate.addEventListener(() => ({ id: 1 } as never));
      expect(typeof off).toBe("function");
      expect(() => off()).not.toThrow();
    });
  });
});
