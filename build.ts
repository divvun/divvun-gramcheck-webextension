import { copy, ensureDir, expandGlob } from "@std/fs";
import { join } from "@std/path";
import { build, context } from "esbuild";
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
  const isWatch = Deno.args.includes("--watch") || Deno.args.includes("-w");
  const isProd = Deno.args.includes("--prod") || Deno.args.includes("-p");

  // Set environment for config
  if (isProd) {
    Deno.env.set("NODE_ENV", "production");
  }

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

  if (isWatch) {
    console.log("Setting up watch mode...");
    const ctx = await context(buildConfig);
    await ctx.watch();
    console.log("Watching for changes... (Press Ctrl+C to stop)");
  } else {
    console.log("Building with esbuild...");
    try {
      await build(buildConfig);
      console.log("Build completed successfully!");
    } catch (error) {
      console.error("Build failed:", error);
      Deno.exit(1);
    } finally {
      Deno.exit(0);
    }
  }
}

if (import.meta.main) {
  await main();
}
