// Fails a pull request that adds an off-grid spacing class under web/, revenue/ or bedrock/ (the 8px grid, docs/development.md "Spacing grid").
// Usage: UI_FILES=<one path per line> node spacing-grid.mjs < <the pull request files API's JSON, paged or flat>
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** The lines a unified diff adds, with their line number in the new file. */
export function addedLines(patch) {
  const added = [];
  let n = 0;
  for (const text of patch.split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(text);
    if (hunk) n = Number(hunk[1]);
    else if (text.startsWith("+")) added.push({ line: n++, text: text.slice(1) });
    else if (text.startsWith(" ")) n++;
  }
  return added;
}

const SPACING = /^-?(p[xytrblse]?|m[xytrblse]?|gap(-[xy])?|space-[xy]|inset(-[xy])?|start|end|top|right|bottom|left)-(.+)$/;

/** Drops the variant prefix: everything up to the last ":" outside brackets. */
function withoutVariants(token) {
  let depth = 0;
  let cut = 0;
  for (let i = 0; i < token.length; i++) {
    if (token[i] === "[") depth++;
    else if (token[i] === "]") depth--;
    else if (token[i] === ":" && depth === 0) cut = i + 1;
  }
  return token.slice(cut);
}

function stepOffGrid(step) {
  if (/^\d+$/.test(step)) return Number(step) % 2 !== 0 && step !== "1";
  if (/^\d*\.\d+$/.test(step)) return true;
  const px = /^\[(\d+(?:\.\d+)?)px\]$/.exec(step);
  // shortcut: rem and calc() values pass, the rule only reads px; extend when rem spacing shows up.
  return px ? !(Number(px[1]) % 8 === 0 || px[1] === "4") : false;
}

/** The off-grid spacing classes on one line, as written (variants included). */
export function offGrid(text) {
  return text
    .split(/[\s"'`]+/)
    .filter((token) => {
      const m = SPACING.exec(withoutVariants(token).replace(/^!|!$/g, ""));
      return m && stepOffGrid(m[m.length - 1]);
    });
}

/** The error lines for the files of a pull request. `files` is the files API's list, `uiFiles` the paths to check. */
export function errorsFor(files, uiFiles) {
  const errors = [];
  for (const { filename, status, changes, patch } of files) {
    if (!uiFiles.includes(filename) || status === "removed") continue;
    // The files API leaves the patch out of very large diffs; the check is required, so a silent skip would be a hole.
    if (patch === undefined) {
      if (changes > 0) errors.push(`::error file=${filename}::GitHub gave no diff for this file, so its spacing classes cannot be checked; split the change`);
      continue;
    }
    for (const { line, text } of addedLines(patch))
      for (const cls of offGrid(text)) errors.push(`::error file=${filename},line=${line}::${cls} is off the 8px grid`);
  }
  return errors;
}

function main() {
  const uiFiles = (process.env.UI_FILES ?? "").split("\n").filter(Boolean);
  const errors = errorsFor(JSON.parse(readFileSync(0, "utf8")).flat(), uiFiles);
  for (const e of errors) console.log(e);
  if (errors.length) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
