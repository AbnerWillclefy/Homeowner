import { describe, expect, it } from "vitest";
import { firstLoadFiles } from "./check-bundle-budget.mjs";

describe("firstLoadFiles", () => {
  it("counts a shared import once", () => {
    const manifest = {
      "index.html": { file: "assets/index.js", isEntry: true, imports: ["a.ts", "b.ts"] },
      "a.ts": { file: "assets/a.js", imports: ["shared.ts"] },
      "b.ts": { file: "assets/b.js", imports: ["shared.ts"] },
      "shared.ts": { file: "assets/shared.js" },
    };
    expect(firstLoadFiles(manifest)).toEqual(["assets/index.js", "assets/a.js", "assets/shared.js", "assets/b.js"]);
  });

  it("ignores lazy dynamic imports", () => {
    const manifest = {
      "index.html": { file: "assets/index.js", isEntry: true, dynamicImports: ["screen.tsx"] },
      "screen.tsx": { file: "assets/screen.js" },
    };
    expect(firstLoadFiles(manifest)).toEqual(["assets/index.js"]);
  });

  it("throws when no record is the entry", () => {
    expect(() => firstLoadFiles({ "a.ts": { file: "assets/a.js" } })).toThrow(/isEntry/);
  });

  it("throws on an import key with no record", () => {
    const manifest = { "index.html": { file: "assets/index.js", isEntry: true, imports: ["gone.ts"] } };
    expect(() => firstLoadFiles(manifest)).toThrow(/gone\.ts/);
  });
});
