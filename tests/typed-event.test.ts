import { jest } from "@jest/globals";
import { TypedEvent } from "../src/events/typed-event.js";

describe("TypedEvent", () => {
  describe("listener management", () => {
    it("starts with 0 listeners", () => {
      const ev = new TypedEvent<[unknown, number], number>();
      expect(ev.listenerCount).toBe(0);
    });

    it("addEventListener increments count and returns unsubscribe", () => {
      const ev = new TypedEvent<[unknown, { id: string }], { id: string }>();
      const fn = jest.fn((ctx, e) => e);
      const unsub = ev.addEventListener(fn);
      expect(ev.listenerCount).toBe(1);
      unsub();
      expect(ev.listenerCount).toBe(0);
    });

    it("removeEventListener removes exact reference", () => {
      const ev = new TypedEvent<[unknown, number], number>();
      const fn1 = jest.fn((_, n) => n + 1);
      const fn2 = jest.fn((_, n) => n + 2);
      ev.addEventListener(fn1);
      ev.addEventListener(fn2);
      expect(ev.listenerCount).toBe(2);
      ev.removeEventListener(fn1);
      expect(ev.listenerCount).toBe(1);
      ev.removeEventListener(fn2);
      expect(ev.listenerCount).toBe(0);
    });

    it("clear removes all listeners", () => {
      const ev = new TypedEvent<[unknown, number], number>();
      ev.addEventListener(() => 1);
      ev.addEventListener(() => 2);
      ev.addEventListener(() => 3);
      ev.clear();
      expect(ev.listenerCount).toBe(0);
    });

    it("removing non-existent handler is no-op", () => {
      const ev = new TypedEvent<[unknown, number], number>();
      const fn = jest.fn();
      expect(() => ev.removeEventListener(fn as never)).not.toThrow();
    });
  });

  describe("dispatch - 2-arg (ctx, entity) piping", () => {
    it("returns last arg when no listeners", async () => {
      const ev = new TypedEvent<[string, { id: string }], { id: string }>();
      const out = await ev.dispatch("ctx", { id: "1" });
      expect(out).toEqual({ id: "1" });
    });

    it("single listener transforms entity", async () => {
      const ev = new TypedEvent<[string, number], number>();
      ev.addEventListener(async (_ctx, n) => n + 10);
      expect(await ev.dispatch("ctx", 5)).toBe(15);
    });

    it("multiple listeners pipe sequentially in order", async () => {
      const ev = new TypedEvent<[string, number], number>();
      const order: number[] = [];
      ev.addEventListener(async (_ctx, n) => {
        order.push(1);
        return n + 1;
      });
      ev.addEventListener(async (_ctx, n) => {
        order.push(2);
        return n * 2;
      });
      ev.addEventListener(async (_ctx, n) => {
        order.push(3);
        return n - 3;
      });
      // 5 -> +1 =6 -> *2=12 -> -3=9
      expect(await ev.dispatch("ctx", 5)).toBe(9);
      expect(order).toEqual([1, 2, 3]);
    });

    it("listener returning undefined preserves current value", async () => {
      const ev = new TypedEvent<[string, { a: number }], { a: number }>();
      ev.addEventListener(async (_ctx, e) => {
        // mutate but return undefined
        e.a = 99;
        return undefined as unknown as { a: number };
      });
      ev.addEventListener(async (_ctx, e) => {
        // should receive mutated but piped value
        return { a: e.a + 1 };
      });
      const out = await ev.dispatch("ctx", { a: 1 });
      // first listener returned undefined, so result stays as mutated input? Implementation: result = original, then if out !== undefined result = out
      // So after first, result stays {a:1} but the object was mutated to {a:99}. Second sees {a:1} or mutated?
      // Our dispatch passes result variable, not original. First's undefined means result unchanged (still {a:1} reference). But mutation affected same object.
      // This is nitty gritty - we assert piped value preservation
      expect(out.a).toBe(100); // 99 mutated +1? Actually if result preserved as original object (which was mutated), then second gets {a:99}
      // If implementation clones, would be 2. But we mutated.
      // Alternative clean test:
      const ev2 = new TypedEvent<[string, number], number>();
      ev2.addEventListener(() => undefined as unknown as number);
      ev2.addEventListener((_ctx, n) => n + 5);
      expect(await ev2.dispatch("ctx", 10)).toBe(15);
    });

    it("returning null replaces value (null !== undefined)", async () => {
      const ev = new TypedEvent<[string, number | null], number | null>();
      ev.addEventListener(() => null);
      expect(await ev.dispatch("ctx", 5)).toBeNull();
    });

    it("async listeners are awaited sequentially", async () => {
      const ev = new TypedEvent<[string, number], number>();
      const timings: string[] = [];
      ev.addEventListener(async (_ctx, n) => {
        await new Promise((r) => setTimeout(r, 10));
        timings.push("first");
        return n + 1;
      });
      ev.addEventListener(async (_ctx, n) => {
        timings.push("second");
        return n + 1;
      });
      const out = await ev.dispatch("ctx", 0);
      expect(out).toBe(2);
      expect(timings).toEqual(["first", "second"]);
    });

    it("sync listener returning value is treated as resolved", async () => {
      const ev = new TypedEvent<[string, string], string>();
      ev.addEventListener((_ctx, s) => s.toUpperCase());
      expect(await ev.dispatch("ctx", "hello")).toBe("HELLO");
    });

    it("propagates thrown error", async () => {
      const ev = new TypedEvent<[string, number], number>();
      ev.addEventListener(() => {
        throw new Error("boom");
      });
      await expect(ev.dispatch("ctx", 1)).rejects.toThrow("boom");
    });

    it("propagates rejected promise", async () => {
      const ev = new TypedEvent<[string, number], number>();
      ev.addEventListener(async () => {
        throw new Error("async boom");
      });
      await expect(ev.dispatch("ctx", 1)).rejects.toThrow("async boom");
    });

    it("passes ctx unchanged through chain", async () => {
      const ev = new TypedEvent<[{ userId: string }, { val: number }], { val: number }>();
      const ctxs: string[] = [];
      ev.addEventListener((ctx, e) => {
        ctxs.push(ctx.userId);
        return e;
      });
      ev.addEventListener((ctx, e) => {
        ctxs.push(ctx.userId);
        return { val: e.val + 1 };
      });
      await ev.dispatch({ userId: "alice" }, { val: 1 });
      expect(ctxs).toEqual(["alice", "alice"]);
    });
  });

  describe("dispatch - 3-arg (ctx, before, after) piping", () => {
    it("returns after when no listeners", async () => {
      const ev = new TypedEvent<[string, number, number], number>();
      expect(await ev.dispatch("ctx", 1, 2)).toBe(2);
    });

    it("threads after while keeping ctx and before fixed", async () => {
      const ev = new TypedEvent<[string, { id: string }, { id: string; name: string }], { id: string; name: string }>();
      const befores: unknown[] = [];
      ev.addEventListener((ctx, before, after) => {
        befores.push(before);
        expect(ctx).toBe("ctx");
        return { ...after, name: after.name + "_1" };
      });
      ev.addEventListener((ctx, before, after) => {
        befores.push(before);
        return { ...after, name: after.name + "_2" };
      });
      const out = await ev.dispatch("ctx", { id: "1" }, { id: "1", name: "old" });
      expect(out).toEqual({ id: "1", name: "old_1_2" });
      expect(befores).toEqual([{ id: "1" }, { id: "1" }]);
    });

    it("undefined return preserves after", async () => {
      const ev = new TypedEvent<[string, number, number], number>();
      ev.addEventListener(() => undefined as unknown as number);
      ev.addEventListener((_ctx, _b, after) => after + 10);
      expect(await ev.dispatch("ctx", 1, 5)).toBe(15);
    });

    it("null replaces after", async () => {
      const ev = new TypedEvent<[string, number, number | null], number | null>();
      ev.addEventListener(() => null as unknown as number);
      expect(await ev.dispatch("ctx", 1, 5)).toBeNull();
    });
  });

  describe("dispatch - generic fallback (1-arg, 4-arg etc)", () => {
    it("1-arg threads last arg (only arg)", async () => {
      const ev = new TypedEvent<[number], number>();
      // With 1 arg, generic fallback threads last arg which is also first
      // Implementation: result = args[last], loop with ...args.slice(0,-1) -> empty + result
      // It will call fn(result) ? Let's see: for 1 arg, args.length=1, goes to generic fallback (not 2/3)
      // result = args[0]=5, then fn(...[], result) => fn(5)
      ev.addEventListener((n) => n + 1);
      expect(await ev.dispatch(5)).toBe(6);
    });

    it("4-arg threads last arg", async () => {
      const ev = new TypedEvent<[string, string, string, number], number>();
      ev.addEventListener((_a, _b, _c, n) => n + 2);
      ev.addEventListener((_a, _b, _c, n) => n * 3);
      // 5 -> +2=7 -> *3=21
      expect(await ev.dispatch("a", "b", "c", 5)).toBe(21);
    });
  });

  describe("dispatchSync", () => {
    it("returns last arg when no listeners", () => {
      const ev = new TypedEvent<[string, number], number>();
      expect(ev.dispatchSync("ctx", 42)).toBe(42);
    });

    it("sync piping for 2-arg", () => {
      const ev = new TypedEvent<[string, number], number>();
      ev.addEventListener((_ctx, n) => n + 1);
      ev.addEventListener((_ctx, n) => n * 2);
      expect(ev.dispatchSync("ctx", 5)).toBe(12);
    });

    it("ignores Promise returns in sync mode", () => {
      const ev = new TypedEvent<[string, number], number>();
      ev.addEventListener(async (_ctx, n) => n + 100); // async, should be ignored
      ev.addEventListener((_ctx, n) => n + 1);
      // first async returns Promise, dispatchSync checks instanceof Promise and ignores
      expect(ev.dispatchSync("ctx", 5)).toBe(6); // not 106
    });

    it("3-arg sync piping", () => {
      const ev = new TypedEvent<[string, number, number], number>();
      ev.addEventListener((_ctx, _b, after) => after + 1);
      ev.addEventListener((_ctx, _b, after) => after + 2);
      expect(ev.dispatchSync("ctx", 1, 10)).toBe(13);
    });

    it("sync ignores async in 3-arg", () => {
      const ev = new TypedEvent<[string, number, number], number>();
      ev.addEventListener(async (_ctx, _b, after) => after + 100);
      ev.addEventListener((_ctx, _b, after) => after + 1);
      expect(ev.dispatchSync("ctx", 1, 10)).toBe(11);
    });

    it("returns last arg for generic fallback sync", () => {
      const ev = new TypedEvent<[string, string, number], number>();
      expect(ev.dispatchSync("a", "b", 5)).toBe(5);
    });
  });

  describe("unsubscribe isolation and ordering", () => {
    it("unsubscribe during iteration does not affect current dispatch order copy? Set iteration is live", async () => {
      const ev = new TypedEvent<[string, number], number>();
      const fn1 = jest.fn((_, n) => n + 1);
      const fn2 = jest.fn((_, n) => {
        ev.removeEventListener(fn1);
        return n + 1;
      });
      ev.addEventListener(fn1);
      ev.addEventListener(fn2);
      // Dispatch: fn1 then fn2. fn2 removes fn1, but fn1 already executed. Next dispatch should only have fn2.
      expect(await ev.dispatch("ctx", 0)).toBe(2);
      expect(ev.listenerCount).toBe(1);
      expect(await ev.dispatch("ctx", 0)).toBe(1);
    });

    it("adding listener during dispatch is visited if Set live iteration (documented)", async () => {
      const ev = new TypedEvent<[string, number], number>();
      ev.addEventListener((_, n) => {
        ev.addEventListener((_, m) => m + 10);
        return n + 1;
      });
      // First dispatch: original listener + newly added? Set for..of will visit newly added at end
      const out = await ev.dispatch("ctx", 0);
      // 0 -> first =>1 -> second =>11
      expect(out).toBe(11);
      // Second dispatch should have 2 listeners from start
      ev.clear();
      const ev2 = new TypedEvent<[string, number], number>();
      let secondCallCount = 0;
      ev2.addEventListener((_, n) => {
        ev2.addEventListener(() => {
          secondCallCount++;
          return n + 10 as never;
        });
        return n + 1;
      });
      await ev2.dispatch("ctx", 0);
      expect(secondCallCount).toBe(1);
    });
  });
});
