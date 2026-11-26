// The closed set of appearance choices. No imports and no DOM types, so this file
// is pure and testable in node. The inline script in index.html repeats the
// resolution rule (it cannot import); inlineScript.test.ts keeps the two in step.
export const THEME_CHOICES = ["system", "light", "dark"] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** What is painted: always a concrete value, so the CSS only ever has two states. */
export type AppliedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "homeowner.theme";

/** Bedrock's `bg` token per theme (the page colour), for the status bar (theme-color). Keep in step with bedrock/src/tokens.css. */
export const THEME_COLORS: Record<AppliedTheme, string> = { light: "#f4f6f5", dark: "#0e1110" };

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

/** A stored light or dark wins; anything else (nothing, "system", junk) is System: light only when the OS says so, else dark. */
export function resolveTheme(input: { stored: unknown; systemPrefersLight: boolean }): {
  choice: ThemeChoice;
  applied: AppliedTheme;
} {
  const { stored, systemPrefersLight } = input;
  if (stored === "light" || stored === "dark") return { choice: stored, applied: stored };
  return { choice: "system", applied: systemPrefersLight ? "light" : "dark" };
}
