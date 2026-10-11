// The closed set of appearance choices. No imports and no DOM types, so this file
// is pure and testable in node. The inline script in index.html repeats the
// resolution rule (it cannot import); inlineScript.test.ts keeps the two in step.
export const THEME_CHOICES = ["system", "light", "dark"] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** What is painted: always a concrete value, so the CSS only ever has two states. */
export type AppliedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "homeowner.theme";

/** The `surface` token per theme, for the status bar (theme-color). Keep in step with index.css. */
export const THEME_COLORS: Record<AppliedTheme, string> = { light: "#f7f8f5", dark: "#121816" };

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

/** A stored light or dark wins; anything else (nothing, "system", junk) is System. */
export function resolveTheme(input: { stored: unknown; systemPrefersDark: boolean }): {
  choice: ThemeChoice;
  applied: AppliedTheme;
} {
  const { stored, systemPrefersDark } = input;
  if (stored === "light" || stored === "dark") return { choice: stored, applied: stored };
  return { choice: "system", applied: systemPrefersDark ? "dark" : "light" };
}
