// Fails when the first-load JS grows more than ALLOWED_GROWTH above RECORDED_GZIP_BYTES.
//
// First-load JS = the entry chunk plus everything it imports statically, read from Vite's build manifest. Lazy
// screens (`dynamicImports`) are not counted. CSS is outside the budget: only each record's `file` is counted.
// Each file is gzipped at level 9 (fixed, so the number does not move with Node's default).
//
// Usage: node scripts/check-bundle-budget.mjs [path/to/manifest.json]   (default dist/.vite/manifest.json)
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Gzipped first-load JS in the CI environment (the `env` of web-typecheck.yml). Update deliberately. */
export const RECORDED_GZIP_BYTES = 211710;
export const ALLOWED_GROWTH = 0.1;

/** Files of the entry and its static imports, in the order reached. */
export function firstLoadFiles(manifest) {
  const entry = Object.keys(manifest).find((key) => manifest[key].isEntry);
  if (!entry) throw new Error("the manifest has no record with isEntry: true");
  const seen = new Set();
  const files = [];
  const walk = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    const record = manifest[key];
    if (!record) throw new Error(`the manifest has no record for "${key}"`);
    files.push(record.file);
    for (const child of record.imports ?? []) walk(child);
  };
  walk(entry);
  return files;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const manifestPath = path.resolve(process.argv[2] ?? path.join(root, "dist/.vite/manifest.json"));
  let files;
  try {
    files = firstLoadFiles(JSON.parse(readFileSync(manifestPath, "utf8")));
  } catch (error) {
    console.error(
      `Bundle budget: ${error.message}\n` +
        `Run "npm run build" first, and keep build.manifest: true in vite.config.ts.`,
    );
    process.exit(1);
  }
  const outDir = path.dirname(path.dirname(manifestPath));
  const sizes = files
    .map((file) => ({ file, bytes: gzipSync(readFileSync(path.join(outDir, file)), { level: 9 }).length }))
    .sort((a, b) => b.bytes - a.bytes);
  const measured = sizes.reduce((sum, { bytes }) => sum + bytes, 0);
  const budget = Math.floor(RECORDED_GZIP_BYTES * (1 + ALLOWED_GROWTH));
  if (measured > budget) {
    console.error(
      `First-load JS is ${measured} bytes gzipped, over the budget of ${budget} bytes ` +
        `(${RECORDED_GZIP_BYTES} recorded + ${ALLOWED_GROWTH * 100}%).\nFiles counted, largest first:\n` +
        sizes.map(({ file, bytes }) => `  ${bytes}  ${file}`).join("\n") +
        `\nIf the growth is intended, set RECORDED_GZIP_BYTES in web/scripts/check-bundle-budget.mjs to ${measured} ` +
        `in the same pull request and say why in its description. The constant may also go down after a size win.`,
    );
    process.exit(1);
  }
  console.log(`First-load JS ${measured} bytes gzipped, budget ${budget}, headroom ${budget - measured}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
