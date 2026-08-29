import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { readTargetDir, stripJsonComments, relativePosix } from "../src/utils/tsconfig.js";

describe("tsconfig utils", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), "eventify-tsconfig-"));
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  describe("stripJsonComments", () => {
    it("strips // single line", () => {
      const raw = `{"a": 1 // comment\n, "b": 2}`;
      expect(stripJsonComments(raw)).toBe(`{"a": 1 \n, "b": 2}`);
    });
    it("strips /* block */", () => {
      const raw = `{"a": /* hi */1, "b": 2}`;
      expect(stripJsonComments(raw)).not.toContain("hi");
      expect(JSON.parse(stripJsonComments(raw))).toEqual({ a: 1, b: 2 });
    });
    it("strips multiple", () => {
      const raw = `// header\n{\n  /* block \n   comment */\n  "x": 1 // trailing\n}`;
      expect(JSON.parse(stripJsonComments(raw))).toEqual({ x: 1 });
    });
  });

  describe("relativePosix", () => {
    it("converts backslashes to forward slashes", () => {
      // On Windows this will actually contain backslashes; on posix it still replaces
      expect(relativePosix("a\\b", "a\\b\\c")).toBeDefined();
      // Use real paths
      const from = resolve(tmpRoot, "a");
      const to = resolve(tmpRoot, "a", "b", "c");
      const rel = relativePosix(from, to);
      expect(rel).toBe("b/c");
      expect(rel).not.toContain("\\");
    });
  });

  describe("readTargetDir", () => {
    async function writeTsconfig(content: string, subdir = ""): Promise<string> {
      const dir = subdir ? join(tmpRoot, subdir) : tmpRoot;
      await mkdir(dir, { recursive: true });
      const p = join(dir, "tsconfig.json");
      await writeFile(p, content, "utf-8");
      return p;
    }

    it("throws if file not found", async () => {
      await expect(readTargetDir(join(tmpRoot, "missing.json"))).rejects.toThrow(/tsconfig not found/);
    });

    it("throws if no compilerOptions.paths", async () => {
      const p = await writeTsconfig(JSON.stringify({ compilerOptions: {} }));
      await expect(readTargetDir(p)).rejects.toThrow(/No compilerOptions\.paths/);
    });

    it("throws if @api/* missing", async () => {
      const p = await writeTsconfig(JSON.stringify({ compilerOptions: { paths: { "@other/*": ["x/*"] } } }));
      await expect(readTargetDir(p)).rejects.toThrow(/No "@api\/\*"/);
    });

    it("resolves @api/* with /* suffix", async () => {
      const p = await writeTsconfig(JSON.stringify({ compilerOptions: { paths: { "@api/*": ["generated/*"] } } }));
      const out = await readTargetDir(p);
      expect(out).toBe(resolve(tmpRoot, "generated"));
    });

    it("resolves @api/* without star", async () => {
      const p = await writeTsconfig(JSON.stringify({ compilerOptions: { paths: { "@api/*": ["generated"] } } }));
      expect(await readTargetDir(p)).toBe(resolve(tmpRoot, "generated"));
    });

    it("resolves relative to tsconfig dir (nested)", async () => {
      const p = await writeTsconfig(
        JSON.stringify({ compilerOptions: { paths: { "@api/*": ["../generated/*"] } } }),
        "sub"
      );
      expect(await readTargetDir(p)).toBe(resolve(tmpRoot, "generated"));
    });

    it("picks first entry of array", async () => {
      const p = await writeTsconfig(
        JSON.stringify({ compilerOptions: { paths: { "@api/*": ["first/*", "second/*"] } } })
      );
      expect(await readTargetDir(p)).toBe(resolve(tmpRoot, "first"));
    });

    it("handles absolute out path via relative", async () => {
      const p = await writeTsconfig(JSON.stringify({ compilerOptions: { paths: { "@api/*": ["./src/api/*"] } } }));
      expect(await readTargetDir(p)).toBe(resolve(tmpRoot, "src/api"));
    });

    it("parses JSONC with // and /* */", async () => {
      const raw = `
      // comment header
      {
        /* block comment */
        "compilerOptions": {
          // inline
          "paths": {
            "@api/*": ["generated/*"] /* trailing */
          }
        }
      }
      `;
      const p = await writeTsconfig(raw);
      expect(await readTargetDir(p)).toBe(resolve(tmpRoot, "generated"));
    });

    it("throws on unparseable JSON even after stripping", async () => {
      const p = await writeTsconfig(`{ invalid json,,`);
      await expect(readTargetDir(p)).rejects.toThrow(/Failed to parse/);
    });

    it("handles @api/* = 'generated/*' with baseUrl '.'", async () => {
      const p = await writeTsconfig(
        JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@api/*": ["generated/*"], "@api": ["generated/index.ts"] } } })
      );
      expect(await readTargetDir(p)).toBe(resolve(tmpRoot, "generated"));
    });
  });
});
