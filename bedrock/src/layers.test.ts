import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// Layers form a strict tree: Core (components/, lib/) imports neither Finance nor Home; Home and Finance import Core only.
function sources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : [join(dir, e.name)],
  );
}

type Layer = "finance" | "home";
const importsLayer = (src: string, layer: Layer) =>
  [...src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].some((m) => m[1].includes(layer));

it("the matcher sees layer imports", () => {
  expect(importsLayer('import { A } from "../finance";', "finance")).toBe(true);
  expect(importsLayer('export { A } from "../../finance/Amount";', "finance")).toBe(true);
  expect(importsLayer('const m = import("../finance");', "finance")).toBe(true);
  expect(importsLayer('import { B } from "./Button";', "finance")).toBe(false);
  expect(importsLayer('import { A } from "../home";', "home")).toBe(true);
  expect(importsLayer('export { A } from "../../home/effort";', "home")).toBe(true);
  expect(importsLayer('const m = import("../home");', "home")).toBe(true);
  expect(importsLayer('import { A } from "../home";', "finance")).toBe(false);
  expect(importsLayer('import { B } from "./Button";', "home")).toBe(false);
});

const offenders = (dirs: string[], layer: Layer) =>
  dirs.flatMap((d) => sources(join(import.meta.dirname, d))).filter((f) => importsLayer(readFileSync(f, "utf8"), layer));

it("core never imports finance or home", () => {
  expect(offenders(["components", "lib"], "finance")).toEqual([]);
  expect(offenders(["components", "lib"], "home")).toEqual([]);
});

it("home imports core but not finance", () => {
  expect(sources(join(import.meta.dirname, "home")).length).toBeGreaterThan(0);
  expect(offenders(["home"], "finance")).toEqual([]);
});

it("finance does not import home", () => {
  expect(offenders(["finance"], "home")).toEqual([]);
});
