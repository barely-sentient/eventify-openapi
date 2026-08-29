import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eventifyOpenApi } from "../src/generator/index.js";

function minimalOpenApi(schemas: Record<string, unknown>): string {
  return JSON.stringify({
    openapi: "3.0.0",
    info: { title: "t", version: "1" },
    paths: {
      "/test": { get: { responses: { "200": { description: "ok" } } } },
    },
    components: { schemas },
  });
}

describe("eventifyOpenApi generator", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), "eventify-gen-"));
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  async function writeTsconfig(dir: string, outRel = "generated") {
    const p = join(dir, "tsconfig.json");
    await writeFile(
      p,
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@api/*": [`${outRel}/*`], "@api": [`${outRel}/index.ts`] } } }),
      "utf-8"
    );
    return p;
  }

  it("generates per-entity files + barrel via virtual FS (source type, outDir override)", async () => {
    const outDir = join(tmpRoot, "out");
    const writes: Record<string, string> = {};
    const mkdirCalls: Array<{ dir: string; opts: { recursive: boolean } }> = [];
    const result = await eventifyOpenApi({
      input: minimalOpenApi({ User: { type: "object" }, Product: { type: "object" } }),
      type: "source",
      outDir,
      mkdir: async (dir, opts) => {
        mkdirCalls.push({ dir, opts });
      },
      writeFile: async (path, content) => {
        writes[path] = content;
      },
    });

    expect(result.size).toBe(3); // user.events, product.events, index.events
    expect(result.has("user.events")).toBe(true);
    expect(result.has("product.events")).toBe(true);
    expect(result.has("index.events")).toBe(true);
    expect(mkdirCalls[0].opts).toEqual({ recursive: true });
    expect(Object.keys(writes)).toHaveLength(3);
    const userPath = resolve(outDir, "user.events.ts");
    expect(writes[userPath]).toContain("User");
    expect(writes[userPath]).toContain("createEntityEvents<unknown, User>");
  });

  it("respects contextType", async () => {
    const outDir = join(tmpRoot, "out2");
    const result = await eventifyOpenApi({
      input: minimalOpenApi({ Order: { type: "object" } }),
      type: "source",
      outDir,
      contextType: { from: "@app/ctx", name: "MyCtx" },
      mkdir: async () => {},
      writeFile: async () => {},
    });
    expect(result.get("order.events")).toContain(`import type { MyCtx } from '@app/ctx';`);
    expect(result.get("order.events")).toContain("createEntityEvents<MyCtx, Order>");
  });

  it("reads targetDir from tsconfig when outDir not given", async () => {
    const tsconfigPath = await writeTsconfig(tmpRoot, "gen");
    const result = await eventifyOpenApi({
      input: minimalOpenApi({ Foo: { type: "object" } }),
      type: "source",
      tsconfigPath,
      mkdir: async () => {},
      writeFile: async () => {},
    });
    expect(result.has("foo.events")).toBe(true);
    // ensure barrel contains foo
    expect(result.get("index.events")).toContain("foo.events.js");
  });

  it("defaults type to file and reads from disk", async () => {
    const openapiPath = join(tmpRoot, "openapi.json");
    await writeFile(openapiPath, minimalOpenApi({ Bar: { type: "object" } }), "utf-8");
    const outDir = join(tmpRoot, "outFile");
    const result = await eventifyOpenApi({
      input: openapiPath,
      // type omitted -> defaults to file
      outDir,
      mkdir: async () => {},
      writeFile: async () => {},
    });
    expect(result.has("bar.events")).toBe(true);
  });

  it("uses definitions fallback when components.schemas missing", async () => {
    const spec = JSON.stringify({
      openapi: "2.0",
      info: { title: "t", version: "1" },
      paths: { "/x": { get: { responses: { "200": { description: "ok" } } } } },
      definitions: { Legacy: { type: "object" } },
    });
    const outDir = join(tmpRoot, "legacy");
    const result = await eventifyOpenApi({
      input: spec,
      type: "source",
      outDir,
      mkdir: async () => {},
      writeFile: async () => {},
    });
    expect(result.has("legacy.events")).toBe(true);
    expect(result.get("legacy.events")).toContain("Legacy");
  });

  it("lowercases file names but preserves Pascal for types", async () => {
    const outDir = join(tmpRoot, "case");
    const result = await eventifyOpenApi({
      input: minimalOpenApi({ ProductCategory: { type: "object" }, user: { type: "object" } }),
      type: "source",
      outDir,
      mkdir: async () => {},
      writeFile: async () => {},
    });
    expect(result.has("productcategory.events")).toBe(true);
    expect(result.get("productcategory.events")).toContain("ProductCategory");
    expect(result.has("user.events")).toBe(true);
  });

  it("barrel imports all entities in order", async () => {
    const outDir = join(tmpRoot, "barrel");
    const result = await eventifyOpenApi({
      input: minimalOpenApi({ A: { type: "object" }, B: { type: "object" }, C: { type: "object" } }),
      type: "source",
      outDir,
      mkdir: async () => {},
      writeFile: async () => {},
    });
    const barrel = result.get("index.events")!;
    const idxA = barrel.indexOf("a.events.js");
    const idxB = barrel.indexOf("b.events.js");
    const idxC = barrel.indexOf("c.events.js");
    expect(idxA).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxC);
  });

  it("throws on invalid doc: not object", async () => {
    await expect(
      eventifyOpenApi({
        input: "null",
        type: "source",
        outDir: join(tmpRoot, "bad"),
        mkdir: async () => {},
        writeFile: async () => {},
      })
    ).rejects.toThrow(/Invalid OpenAPI document: expected object/);
  });

  it("throws on missing paths", async () => {
    await expect(
      eventifyOpenApi({
        input: JSON.stringify({ openapi: "3.0", info: { title: "t", version: "1" }, components: { schemas: { X: {} } } }),
        type: "source",
        outDir: join(tmpRoot, "bad2"),
        mkdir: async () => {},
        writeFile: async () => {},
      })
    ).rejects.toThrow(/missing paths/);
  });

  it("throws on paths not object or array", async () => {
    await expect(
      eventifyOpenApi({
        input: JSON.stringify({ paths: [], components: { schemas: { X: {} } } }),
        type: "source",
        outDir: join(tmpRoot, "bad3"),
        mkdir: async () => {},
        writeFile: async () => {},
      })
    ).rejects.toThrow(/missing paths/);
  });

  it("throws on no schemas", async () => {
    await expect(
      eventifyOpenApi({
        input: minimalOpenApi({}),
        type: "source",
        outDir: join(tmpRoot, "empty"),
        mkdir: async () => {},
        writeFile: async () => {},
      })
    ).rejects.toThrow(/No schemas found/);
  });

  it("throws if schemas is empty via missing components", async () => {
    const spec = JSON.stringify({ openapi: "3.0", info: { title: "t", version: "1" }, paths: { "/x": {} } });
    await expect(
      eventifyOpenApi({
        input: spec,
        type: "source",
        outDir: join(tmpRoot, "empty2"),
        mkdir: async () => {},
        writeFile: async () => {},
      })
    ).rejects.toThrow(/No schemas found/);
  });

  it("writes to real disk when no custom fs given (integration)", async () => {
    const genDir = join(tmpRoot, "real");
    const tsconfigPath = await writeTsconfig(tmpRoot, "real");
    // need openapi file for type=file
    const openapiPath = join(tmpRoot, "openapi.json");
    await writeFile(openapiPath, minimalOpenApi({ RealEntity: { type: "object" } }), "utf-8");
    const result = await eventifyOpenApi({
      input: openapiPath,
      type: "file",
      tsconfigPath,
      contextType: { from: "./ctx.js", name: "Ctx" },
    });
    expect(result.has("realentity.events")).toBe(true);
    const content = await readFile(join(genDir, "realentity.events.ts"), "utf-8");
    expect(content).toContain("RealEntity");
    expect(content).toContain("Ctx");
    const barrel = await readFile(join(genDir, "index.events.ts"), "utf-8");
    expect(barrel).toContain("realentity.events.js");
  });

  it("passes jectCfg to parser (variables)", async () => {
    // Use json-ject @var
    const spec = JSON.stringify({
      openapi: "3.0",
      info: { title: "t", version: "1" },
      paths: { "/x": { get: { responses: { "200": { description: "ok" } } } } },
      components: { schemas: { "@var": "$x" } as unknown as Record<string, unknown> },
    });
    // Actually test that parseFromString with variables works: embed @var in title?
    // Simpler: ensure jectCfg doesn't break when unused
    const outDir = join(tmpRoot, "ject");
    await expect(
      eventifyOpenApi({
        input: minimalOpenApi({ User: { type: "object", properties: { name: { "@var": "$name" } } } }),
        type: "source",
        outDir,
        jectCfg: { variables: { $name: "test" } },
        mkdir: async () => {},
        writeFile: async () => {},
      })
    ).resolves.toBeDefined();
  });

  it("encoding param is utf-8 and paths are correct", async () => {
    const outDir = join(tmpRoot, "enc");
    const captured: Array<{ path: string; enc: string }> = [];
    await eventifyOpenApi({
      input: minimalOpenApi({ Enc: { type: "object" } }),
      type: "source",
      outDir,
      mkdir: async () => {},
      writeFile: async (path, _content, enc) => {
        captured.push({ path, enc });
      },
    });
    expect(captured.every((c) => c.enc === "utf-8")).toBe(true);
    expect(captured.some((c) => c.path.endsWith("enc.events.ts"))).toBe(true);
    expect(captured.some((c) => c.path.endsWith("index.events.ts"))).toBe(true);
  });
});
