import { describe, expect, it } from "vitest";
import { enUS } from "../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../shared/i18n/catalogs/pt-BR";
import { NAV_ITEMS } from "./navItems";
import { SHELL_PATHS } from "./routes";

describe("NAV_ITEMS", () => {
  it("has the four tabs in order, on the shell paths", () => {
    expect(NAV_ITEMS.map((item) => item.path)).toEqual([...SHELL_PATHS]);
    expect(NAV_ITEMS.map((item) => item.path)).toEqual(["/", "/chores", "/home", "/me"]);
  });

  it("has unique paths, labels and icons", () => {
    expect(new Set(NAV_ITEMS.map((i) => i.path)).size).toBe(4);
    expect(new Set(NAV_ITEMS.map((i) => i.labelKey)).size).toBe(4);
    expect(new Set(NAV_ITEMS.map((i) => i.icon)).size).toBe(4);
  });

  it.each(NAV_ITEMS)("has a label in both languages for $path", ({ labelKey }) => {
    expect(enUS[labelKey]).toBeTruthy();
    expect(ptBR[labelKey]).toBeTruthy();
  });
});
