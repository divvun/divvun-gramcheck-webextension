import { copy, ensureDir, expandGlob } from "@std/fs";
import { join } from "@std/path";
import { build } from "esbuild";
import buildConfig from "./esbuild.config.ts";

const copyWasmFiles = async (src: string, dest: string) => {
  await ensureDir(dest);

  const files = await expandGlob(join(src, "**/*.js"));
  for await (const file of files) {
    await copy(file.path, join(dest, file.name));
  }

  const wasmFiles = await expandGlob(join(src, "**/*.wasm"));
  for await (const file of wasmFiles) {
    await copy(file.path, join(dest, file.name));
  }
};

async function buildWasm() {
  console.log("Building WASM...");
  try {
    const wasmCmd = new Deno.Command("wasm-pack", {
      args: ["build", "--target", "web", "--out-dir", "../src/wasm"],
      cwd: "./rust",
      stdout: "inherit",
      stderr: "inherit",
    });

    const wasmProcess = wasmCmd.spawn();
    const wasmStatus = await wasmProcess.status;

    if (!wasmStatus.success) {
      throw new Error(`WASM build failed with code ${wasmStatus.code}`);
    }

    console.log("WASM build completed");
  } catch (error) {
    console.error("WASM build failed:", error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

async function main() {
  try {
    await Deno.remove("dist", { recursive: true });
  } catch {
    // Directory doesn't exist, ignore
  }
  await ensureDir("dist");
  await buildWasm();

  console.log("Copying static files...");
  await copy("manifest.json", "dist/manifest.json");
  await copy("icons", "dist/icons");
  await copyWasmFiles("src/wasm", "dist/wasm");

  // Build with esbuild
  console.log("Building with esbuild...");
  try {
    await build(buildConfig);
    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    Deno.exit(1);
  } finally {
    // Stop esbuild's service
    Deno.exit(0);
  }
}

if (import.meta.main) {
  await main();
}
