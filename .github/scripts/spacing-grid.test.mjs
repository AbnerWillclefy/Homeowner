import assert from "node:assert/strict";
import { test } from "node:test";
import { addedLines, errorsFor, offGrid } from "./spacing-grid.mjs";

const cls = (c) => `<div className="flex ${c} items-center">`;

test("offGrid flags odd, fractional and non-multiple px steps", () => {
  const bad = ["gap-3", "p-5", "mt-0.5", "px-[12px]", "-mt-3", "md:gap-x-3", "hover:!p-3", "inset-x-7"];
  assert.ok(bad.length);
  for (const c of bad) assert.deepEqual(offGrid(cls(c)), [c], c);
});

test("offGrid passes even steps, step 1, 8-multiple px and non-steps", () => {
  const good = ["gap-2", "p-4", "px-1", "-mt-2", "p-[16px]", "p-[4px]", "top-1/2", "left-1/2", "inset-0", "space-x-reverse", "size-3", "h-5", "mt-auto", "md:p-(--gap)", "text-sm"];
  assert.ok(good.length);
  for (const c of good) assert.deepEqual(offGrid(cls(c)), [], c);
});

const patch = ["@@ -1,3 +1,4 @@", " keep", '-  className="gap-3"', '+  className="gap-5"', " context", "\\ No newline at end of file", "@@ -20,2 +21,3 @@", " ctx", "+added", " end"].join("\n");

test("addedLines numbers lines in the new file and skips removed and context lines", () => {
  assert.deepEqual(addedLines(patch), [
    { line: 2, text: '  className="gap-5"' },
    { line: 22, text: "added" },
  ]);
});

test("errorsFor names file, line and class, and ignores files outside the UI list", () => {
  const files = [
    { filename: "web/src/a.tsx", status: "modified", changes: 2, patch },
    { filename: "docs/x.tsx", status: "modified", changes: 2, patch },
    { filename: "web/src/b.tsx", status: "modified", changes: 1, patch: '@@ -1 +1 @@\n-  className="p-3"\n+  className="p-2"' },
  ];
  assert.deepEqual(errorsFor(files, ["web/src/a.tsx", "web/src/b.tsx"]), ["::error file=web/src/a.tsx,line=2::gap-5 is off the 8px grid"]);
});

test("errorsFor fails a file whose diff GitHub left out", () => {
  const errors = errorsFor([{ filename: "web/src/big.tsx", status: "modified", changes: 5000 }], ["web/src/big.tsx"]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /web\/src\/big\.tsx/);
});
