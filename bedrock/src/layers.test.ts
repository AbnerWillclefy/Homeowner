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

const importsFinance = (src: string) =>
  [...src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].some((m) => m[1].includes("finance"));

it("the matcher sees finance imports", () => {
  expect(importsFinance('import { A } from "../finance";')).toBe(true);
  expect(importsFinance('export { A } from "../../finance/Amount";')).toBe(true);
  expect(importsFinance('const m = import("../finance");')).toBe(true);
  expect(importsFinance('import { B } from "./Button";')).toBe(false);
});

it("core never imports finance", () => {
  const offenders = ["components", "lib"]
    .flatMap((d) => sources(join(import.meta.dirname, d)))
    .filter((f) => importsFinance(readFileSync(f, "utf8")));
  expect(offenders).toEqual([]);
});
