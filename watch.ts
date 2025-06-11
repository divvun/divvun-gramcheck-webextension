import { context } from "esbuild";
import {
  buildWasm,
  cleanDist,
  copyPolyfill,
  copyStaticFiles,
  getBaseBuildConfig,
} from "./build-common.ts";

// Clean dist directory
await cleanDist();

// Build WASM first
if (!await buildWasm()) {
  Deno.exit(1);
}

// Copy static files
await copyStaticFiles();

// Download polyfill
await copyPolyfill();

// Set up watch context
console.log("Setting up watch mode...");
try {
  const ctx = await context({
    ...getBaseBuildConfig(false), // Development build
  });

  await ctx.watch();
  console.log("Watching for changes...");
} catch (error) {
  console.error("Watch setup failed:", error instanceof Error ? error.message : String(error));
  Deno.exit(1);
}
