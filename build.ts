import { build } from "esbuild";
import { exists } from "@std/fs";
import {
  buildWasm,
  cleanDist,
  copyPolyfill,
  copyRecursive,
  copyWasmFiles,
  processHTML,
  getBaseBuildConfig,
} from "./build-common.ts";

// Clean dist directory
await cleanDist();

// Build WASM first
console.log("Building WASM...");
if (!await buildWasm()) {
  Deno.exit(1);
}

// Copy static files
console.log("Copying static files...");

// Copy manifest and icons
await copyRecursive("manifest.json", "dist/manifest.json");
if (await exists("icons")) {
  await copyRecursive("icons", "dist/icons");
}

// Copy WASM files
await copyWasmFiles("src/wasm", "dist/wasm");

// Process HTML files
await processHTML("src/popup/index.html", "dist/popup.html", "popup");
await processHTML("src/options/index.html", "dist/options.html", "options");

// Download polyfill
await copyPolyfill();

// Build with esbuild
console.log("Building JavaScript...");
try {
  const buildConfig = getBaseBuildConfig(true); // Production build
  await build(buildConfig);
  console.log("Build completed successfully");
} catch (error) {
  console.error("Build failed:", error instanceof Error ? error.message : String(error));
  Deno.exit(1);
}
