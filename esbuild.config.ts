import { BuildOptions } from "esbuild/mod.js";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@~0.11.1";

export default {
  plugins: [...denoPlugins()],
  entryPoints: {
    background: "src/background/index.ts",
    content: "src/content/index.ts",
  },
  bundle: true,
  outdir: "dist",
  format: "esm",
  target: "es2022",
  sourcemap: true,
  minify: Deno.env.get("NODE_ENV") === "production",
  loader: {
    ".wasm": "file" as const,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(Deno.env.get("NODE_ENV") || "development"),
  },
  external: [], // Don't externalize any modules for web extension
} satisfies BuildOptions;
