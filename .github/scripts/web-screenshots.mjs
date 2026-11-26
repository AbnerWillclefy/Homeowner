// Turns what the web app's design-pairs capture wrote (web/e2e/pairs/pairs.capture.ts) into the pull request description:
// one App / Design table under "### pt-BR". Fails when a screen scrolls sideways or has a serious or critical axe violation and is not exempt.
// Usage: BODY=<description> PAIRS_RESULTS=<dir of the capture's JSON files> node web-screenshots.mjs <image url prefix>
// The PNGs are already in the screenshots worktree: the capture wrote them there (PAIRS_OUT).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { pairsMarkdown } from "./artboards.mjs";
import { withScreenshots } from "./bedrock-screenshots.mjs";

/** The rows of the table, in artboard order (each with its measured differences, which never fail the check), and the overflow messages that are not exempt. `results` are the capture's rows. */
export function rowsFrom(results, prefix) {
  const sorted = [...results].sort((a, b) => a.artboard.localeCompare(b.artboard));
  const rows = sorted.map((r) => ({ route: `${r.route} · ${r.artboard}`, app: `${prefix}${r.app}`, design: `${prefix}${r.design}`, measure: r.measure }));
  const overflowing = sorted.filter((r) => r.overflow && !r.exempt).map((r) => r.overflow);
  for (const r of sorted) if (r.overflow && r.exempt) console.error(`warning (exempt): ${r.overflow}`);
  return { rows, overflowing };
}

/** One message per serious or critical axe violation of a screen that is not exempt; an exempt screen with none left is told to leave the list. `results` are the capture's rows. */
export function axeFailures(results) {
  const failing = (r) => (r.axe ?? []).filter((v) => v.impact === "serious" || v.impact === "critical");
  return results.flatMap((r) => {
    const found = failing(r);
    if (r.axeExempt) return found.length ? [] : [`remove ${r.artboard} from AXE_EXEMPT`];
    return found.map((v) => `${r.artboard}: ${v.id} (${v.impact}) at ${v.targets[0]}`);
  });
}

function main([prefix]) {
  const dir = process.env.PAIRS_RESULTS;
  const results = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  if (!results.length) throw new Error(`The capture wrote no result in ${dir}`);
  const { rows, overflowing } = rowsFrom(results, prefix);
  if (overflowing.length) throw new Error(`Horizontal overflow at 390px:\n${overflowing.join("\n")}`);
  const axe = axeFailures(results);
  if (axe.length) throw new Error(`Accessibility violations (axe):\n${axe.join("\n")}`);
  process.stdout.write(withScreenshots(process.env.BODY, prefix, pairsMarkdown({ "pt-BR": rows }), `${prefix}auto-web-`));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
