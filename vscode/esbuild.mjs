/**
 * Bundles the VS Code extension into a single CommonJS file using esbuild.
 *
 * Uses a local `node_modules/esbuild` install if present, otherwise falls back
 * to the copy shipped with the model-renderer (which installs esbuild as a
 * transitive dependency of Vite).  Run `npm install` in the `vscode/` directory
 * to get the canonical local install.
 */

import { createRequire } from "module"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

/** Load esbuild from the first location that resolves. */
function loadEsbuild() {
    for (const candidate of [
        resolve(__dirname, "node_modules/esbuild"),
        resolve(__dirname, "model-renderer/node_modules/esbuild"),
    ]) {
        try {
            return require(candidate)
        } catch {
            /* try next */
        }
    }
    throw new Error("esbuild not found — run `npm install` inside vscode/")
}

const esbuild = loadEsbuild()
const production = process.argv.includes("--production")

await esbuild.build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "out/extension.js",
    // vscode is provided by the host at runtime — never bundle it.
    external: ["vscode"],
    format: "cjs",
    platform: "node",
    sourcemap: !production,
    minify: production,
    logLevel: "info",
})
