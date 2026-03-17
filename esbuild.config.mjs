import esbuild from "esbuild";

const production = process.argv.includes("production");

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "main.js",
  format: "cjs",
  platform: "node",
  banner: {
    js: 'const __import_meta__ = { url: require("node:url").pathToFileURL(__filename).href };'
  },
  define: {
    "import.meta": "__import_meta__"
  },
  // Obsidian plugins ship `main.js` as the runtime artifact, so Codex SDK stays bundled.
  external: ["obsidian"],
  sourcemap: production ? false : "inline",
  minify: production
});
