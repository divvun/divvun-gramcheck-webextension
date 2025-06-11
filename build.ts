import { copy, ensureDir, exists } from "@std/fs";
import { join } from "@std/path";
import { build } from "esbuild";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.1";

// Clean dist directory
try {
  await Deno.remove("dist", { recursive: true });
} catch {
  // Directory doesn't exist, ignore
}
await ensureDir("dist");

// Build WASM first
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

// Copy static files
console.log("Copying static files...");

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

// Copy manifest and icons
await copyRecursive("manifest.json", "dist/manifest.json");
if (await exists("icons")) {
  await copyRecursive("icons", "dist/icons");
}

// Copy WASM files (excluding TypeScript files)
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

await copyWasmFiles("src/wasm", "dist/wasm");

// Process HTML files
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
  <script src="webextension-polyfill.js"></script>
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
    `<script src="webextension-polyfill.js"></script><script src="${scriptName}.js"></script>`,
  );

  // Remove any webpack-specific comments
  html = html.replace(/<!-- In Webpack.*?-->/s, "");
  html = html.replace(/<!-- If using Vite.*?-->/s, "");

  await Deno.writeTextFile(outputPath, html);
};

// Process HTML files
await processHTML("src/popup/index.html", "dist/popup.html", "popup");
await processHTML("src/options/index.html", "dist/options.html", "options");

// esbuild configuration
const buildConfig = {
  plugins: [...denoPlugins()],
  entryPoints: {
    background: "src/background/index.ts",
    content: "src/content/index.ts",
    popup: "src/popup/index.ts",
    options: "src/options/index.ts",
  },
  bundle: true,
  outdir: "dist",
  format: "esm",
  target: "es2018",
  sourcemap: true,
  minify: Deno.env.get("NODE_ENV") === "production",
  loader: {
    ".wasm": "file" as const,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(Deno.env.get("NODE_ENV") || "development"),
  },
  external: [], // Don't externalize any modules for web extension
};

// Download webextension-polyfill
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
