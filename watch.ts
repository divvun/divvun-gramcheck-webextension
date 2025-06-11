import { copy, ensureDir, exists } from "@std/fs";
import { join } from "@std/path";
import { context } from "esbuild";

// Copy static files function
const copyRecursive = async (src: string, dest: string) => {
  try {
    await copy(src, dest, { overwrite: true });
  } catch (error) {
    console.warn(
      `Failed to copy ${src} to ${dest}:`,
      error instanceof Error ? error.message : String(error),
    );
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

const processHTML = async (templatePath: string, outputPath: string, scriptName: string) => {
  if (!(await exists(templatePath))) {
    console.warn(`Template ${templatePath} not found, creating basic HTML`);
    const basicHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extension Page</title>
</head>
<body>
  <div id="app"></div>
  <script src="${scriptName}.js"></script>
</body>
</html>`;
    await Deno.writeTextFile(outputPath, basicHTML);
    return;
  }

  let html = await Deno.readTextFile(templatePath);

  // Replace the module script with the built JavaScript
  html = html.replace(
    /<script src="\.\/index\.ts" type="module"><\/script>/,
    `<script src="${scriptName}.js"></script>`,
  );

  // Remove any webpack-specific comments
  html = html.replace(/<!-- In Webpack.*?-->/s, "");
  html = html.replace(/<!-- If using Vite.*?-->/s, "");

  await Deno.writeTextFile(outputPath, html);
};

const copyStaticFiles = async () => {
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
};

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

// Initial setup
console.log("Setting up watch mode...");

// Clean dist directory
try {
  await Deno.remove("dist", { recursive: true });
} catch {
  // Directory doesn't exist, ignore
}
await ensureDir("dist");

// Build WASM initially
if (!(await buildWasm())) {
  Deno.exit(1);
}

// Copy static files initially
await copyStaticFiles();

// esbuild context for watching
const buildConfig = {
  entryPoints: {
    background: "src/background/index.ts",
    content: "src/content/index.ts",
    popup: "src/popup/index.ts",
    options: "src/options/index.ts",
  },
  bundle: true,
  outdir: "dist",
  format: "iife" as const,
  target: "es2018",
  sourcemap: true,
  loader: {
    ".wasm": "file" as const,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
  external: [],
};

// Start esbuild watch
try {
  const ctx = await context(buildConfig);
  await ctx.watch();
  console.log("👀 Watching for TypeScript changes...");

  // Watch for changes to static files using Deno's file watcher
  const watcher = Deno.watchFs([
    "manifest.json",
    "icons",
    "src/popup/index.html",
    "src/options/index.html",
    "rust",
  ], { recursive: true });

  console.log("🚀 Watch mode started! Make changes to see them rebuild automatically.");
  console.log("Press Ctrl+C to stop watching...");

  for await (const event of watcher) {
    if (event.kind === "modify" || event.kind === "create") {
      for (const path of event.paths) {
        if (path.endsWith("manifest.json")) {
          console.log("📄 Manifest changed, copying...");
          await copyRecursive("manifest.json", "dist/manifest.json");
        } else if (path.includes("icons")) {
          console.log("🎨 Icons changed, copying...");
          if (await exists("icons")) {
            await copyRecursive("icons", "dist/icons");
          }
        } else if (path.endsWith("src/popup/index.html")) {
          console.log("📱 Popup HTML changed, processing...");
          await processHTML("src/popup/index.html", "dist/popup.html", "popup");
        } else if (path.endsWith("src/options/index.html")) {
          console.log("⚙️ Options HTML changed, processing...");
          await processHTML("src/options/index.html", "dist/options.html", "options");
        } else if (path.endsWith(".rs")) {
          console.log("🦀 Rust files changed, rebuilding WASM...");
          if (await buildWasm()) {
            await copyWasmFiles("src/wasm", "dist/wasm");
          }
        }
      }
    }
  }
} catch (error) {
  console.error("Failed to start watch mode:", error);
  Deno.exit(1);
}
