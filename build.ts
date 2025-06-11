import { copy, ensureDir, exists } from "@std/fs";
import { join } from "@std/path";
import { build, context, BuildOptions, PluginBuild } from "esbuild";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.1";

const isWatch = Deno.args.includes("--watch") || Deno.args.includes("-w");
const isProduction = !isWatch && (Deno.args.includes("--prod") || Deno.args.includes("-p"));

console.log(`Starting ${isWatch ? "watch" : "build"} mode...`);

// Base esbuild configuration
const getBaseBuildConfig = (isProduction = false): BuildOptions => ({
  plugins: [...denoPlugins()],
  entryPoints: {
    background: "src/background/index.ts",
    content: "src/content/index.ts",
  },
  bundle: true,
  outdir: "dist",
  format: isProduction ? "esm" : "iife",
  target: "es2018",
  sourcemap: true,
  minify: isProduction,
  loader: {
    ".wasm": "file" as const,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(isProduction ? "production" : "development"),
  },
  external: [], // Don't externalize any modules for web extension
});

// Build WASM and return success status
const buildWasm = async (): Promise<boolean> => {
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
    return true;
  } catch (error) {
    console.error("WASM build failed:", error instanceof Error ? error.message : String(error));
    return false;
  }
};

const cleanDist = async () => {
  try {
    await Deno.remove("dist", { recursive: true });
  } catch {
    // Directory doesn't exist, ignore
  }
  await ensureDir("dist");
};

const copyPolyfill = async () => {
  console.log("Downloading webextension-polyfill...");
  try {
    const response = await fetch(
      "https://unpkg.com/webextension-polyfill@0.12.0/dist/browser-polyfill.min.js",
    );
    if (!response.ok) {
      throw new Error(`Failed to download webextension-polyfill: ${response.status}`);
    }
    const polyfillContent = await response.text();
    await Deno.writeTextFile("dist/webextension-polyfill.js", polyfillContent);
    console.log("webextension-polyfill downloaded successfully");
  } catch (error) {
    console.error(
      "Failed to download webextension-polyfill:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
};


const copyWasmFiles = async (src: string, dest: string) => {
  if (!(await exists(src))) return;

  await ensureDir(dest);

  for await (const entry of Deno.readDir(src)) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory) {
      await copyWasmFiles(srcPath, destPath);
    } else if (
      !entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".gitignore") &&
      entry.name !== "package.json"
    ) {
      await Deno.copyFile(srcPath, destPath);
    }
  }
};


const copyStaticFiles = async () => {
  console.log("Copying static files...");

  // Copy manifest and icons
  await Deno.copyFile("manifest.json", "dist/manifest.json");
  if (await exists("icons")) {
    await copy("icons", "dist/icons", { overwrite: true });
  }

  // Copy WASM files
  await copyWasmFiles("src/wasm", "dist/wasm");
};

// Clean dist directory
await cleanDist();

// Build WASM first
console.log("Building WASM...");
if (!await buildWasm()) {
  Deno.exit(1);
}

// Copy static files
await copyStaticFiles();

// Download polyfill
await copyPolyfill();

// Build or watch with esbuild
try {
  const buildConfig = getBaseBuildConfig(isProduction);
  
  if (isWatch) {
    console.log("Setting up watch mode...");
    
    // Add a plugin to log rebuild events
    const watchConfig = {
      ...buildConfig,
      plugins: [
        ...buildConfig.plugins || [],
        {
          name: 'watch-logger',
          setup(build: PluginBuild) {
            let startTime: number;
            build.onStart(() => {
              startTime = Date.now();
              console.log('Build started...');
            });
            build.onEnd((result) => {
              const duration = Date.now() - startTime;
              if (result.errors.length > 0) {
                console.error(`Build failed (${duration}ms):`, result.errors);
              } else {
                console.log(`Build succeeded (${duration}ms)`);
                if (result.warnings.length > 0) {
                  console.warn('Warnings:', result.warnings);
                }
              }
            });
          },
        },
      ],
    };

    const ctx = await context(watchConfig);
    await ctx.watch();
    console.log("Watching for changes... (Press Ctrl+C to stop)");
  } else {
    console.log("Building JavaScript...");
    const result = await build({
      ...buildConfig,
      metafile: true,
    });

    if (result.warnings.length > 0) {
      console.warn("Build warnings:", result.warnings);
    }
    
    console.log("Build completed successfully");
    Deno.exit(0);
  }
} catch (error) {
  console.error(`${isWatch ? "Watch" : "Build"} failed:`, error instanceof Error ? error.message : String(error));
  Deno.exit(1);
}