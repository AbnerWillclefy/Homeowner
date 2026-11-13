export const THEME_STORAGE_KEY = "revenue.theme";

/** "system" follows prefers-color-scheme. Dark is Bedrock's default, so it is also the fallback. */
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.includes(value as ThemeChoice);
}

/** The theme to put on <html data-theme>. The inline script in index.html does the same before first paint. */
export function resolveTheme(choice: ThemeChoice, prefersLight: boolean): "light" | "dark" {
  return choice === "system" ? (prefersLight ? "light" : "dark") : choice;
}

export function readStoredTheme(storage: Pick<Storage, "getItem"> = globalThis.localStorage): ThemeChoice {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function writeStoredTheme(choice: ThemeChoice, storage: Pick<Storage, "setItem" | "removeItem"> = globalThis.localStorage): void {
  try {
    if (choice === "system") storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}
