import { resolve } from "node:path";
import { tsifyOpenApi } from "tsify-openapi";
import { eventifyOpenApi } from "../dist/index.js";

const root = resolve(import.meta.dirname, "..");
const playgroundDir = resolve(root, "playground");
const openapiPath = resolve(playgroundDir, "openapi.json");
const outDir = resolve(playgroundDir, "generated");
const tsconfigPath = resolve(playgroundDir, "tsconfig.json");

console.log("▶ tsify-openapi: generating TS types + APIs...");
console.log(`  input: ${openapiPath}`);
console.log(`  outDir: ${outDir}`);
console.log(`  tsconfig: ${tsconfigPath}`);

const tsifyResult = await tsifyOpenApi({
  jectCfg: {},
  input: openapiPath,
  type: "file",
  outDir,
  headers: { Authorization: "Bearer playground-token" },
  tsconfigPath,
});

console.log(`  ✔ generated ${tsifyResult.size} files: ${[...tsifyResult.keys()].join(", ")}`);

console.log("\n▶ eventify-openapi: generating event catalog...");
console.log(`  reading @api/* from ${tsconfigPath}`);

const eventResult = await eventifyOpenApi({
  input: openapiPath,
  type: "file",
  tsconfigPath,
  contextType: { from: "./../ctx", name: "SessionCtx" },
});

console.log(`  ✔ generated ${eventResult.size} files: ${[...eventResult.keys()].join(", ")}`);

console.log("\nGenerated files on disk:");
for (const name of eventResult.keys()) {
  console.log(`  - playground/generated/${name}.ts`);
}
for (const name of tsifyResult.keys()) {
  if (!name.endsWith(".events")) {
    console.log(`  - playground/generated/${name}.ts (from tsify)`);
  }
}

console.log("\nDone. Examine playground/generated/ :");
console.log("  - user.ts / product.ts        -> types + schemas + Apis (tsify)");
console.log("  - user.events.ts              -> Events.User catalog (eventify)");
console.log("  - product.events.ts");
console.log("  - index.events.ts             -> barrel, import once at startup: import '@api/index.events'");
console.log("\nExample usage:");
console.log("  import '@api/index.events';");
console.log("  import { Events } from 'eventify-openapi';");
console.log("  Events.User.BeforeCreate.addEventListener(async (ctx, user) => {");
console.log("    if (!user.createdAt) user.createdAt = Date.now();");
console.log("    return user;");
console.log("  });");
