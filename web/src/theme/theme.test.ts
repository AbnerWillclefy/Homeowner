import { describe, expect, it } from "vitest";
import { isThemeChoice, resolveTheme, THEME_CHOICES, THEME_STORAGE_KEY } from "./theme";

describe("resolveTheme", () => {
  it("lets a stored dark choice beat a light system", () => {
    expect(resolveTheme({ stored: "dark", systemPrefersDark: false })).toEqual({ choice: "dark", applied: "dark" });
  });

  it("lets a stored light choice beat a dark system", () => {
    expect(resolveTheme({ stored: "light", systemPrefersDark: true })).toEqual({ choice: "light", applied: "light" });
  });

  it.each([null, undefined])("follows the system when nothing is stored (%j)", (stored) => {
    expect(resolveTheme({ stored, systemPrefersDark: true })).toEqual({ choice: "system", applied: "dark" });
    expect(resolveTheme({ stored, systemPrefersDark: false })).toEqual({ choice: "system", applied: "light" });
  });

  it("treats a stored system choice as System", () => {
    expect(resolveTheme({ stored: "system", systemPrefersDark: true })).toEqual({ choice: "system", applied: "dark" });
    expect(resolveTheme({ stored: "system", systemPrefersDark: false })).toEqual({ choice: "system", applied: "light" });
  });

  it.each(["Dark", "sepia", "", " dark ", "null", 42, {}])("ignores the invalid stored value %j", (stored) => {
    expect(resolveTheme({ stored, systemPrefersDark: true })).toEqual({ choice: "system", applied: "dark" });
    expect(resolveTheme({ stored, systemPrefersDark: false })).toEqual({ choice: "system", applied: "light" });
  });
});

describe("isThemeChoice", () => {
  it("accepts exactly the three tags", () => {
    expect([...THEME_CHOICES]).toEqual(["system", "light", "dark"]);
    for (const tag of ["system", "light", "dark"]) expect(isThemeChoice(tag)).toBe(true);
  });

  it.each(["Dark", "", "sepia", null, undefined, 1, {}, ["dark"]])("rejects %j", (value) => {
    expect(isThemeChoice(value)).toBe(false);
  });

  it("stores under homeowner.theme", () => {
    expect(THEME_STORAGE_KEY).toBe("homeowner.theme");
  });
});
