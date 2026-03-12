import { build } from "esbuild"

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/agent-runtime-sdk.js",
  format: "iife",
  globalName: "__agentSDK",
  target: "es2020",
  minify: true,
  sourcemap: true,
})

console.log("SDK built: dist/agent-runtime-sdk.js")
