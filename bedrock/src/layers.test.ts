import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// Core (components/, lib/) never imports Finance.
function sources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : [join(dir, e.name)],
  );
}

it("core never imports finance", () => {
  const offenders = ["components", "lib"]
    .flatMap((d) => sources(join(import.meta.dirname, d)))
    .filter((f) =>
      [...readFileSync(f, "utf8").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].some((m) =>
        m[1].includes("finance"),
      ),
    );
  expect(offenders).toEqual([]);
});
