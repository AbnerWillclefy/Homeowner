import { THEME_COLORS, THEME_STORAGE_KEY, type AppliedTheme, type ThemeChoice } from "./theme";

/** The browser pieces the theme touches, injectable so the wrappers can be tested with fakes. */
export interface ThemeEnv {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  root: { dataset: Record<string, string | undefined> };
  setThemeColor(color: string): void;
}

/** The only place that reaches for localStorage and the document. */
export function browserEnv(): ThemeEnv {
  return {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
    root: document.documentElement,
    setThemeColor: (color) => document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color),
  };
}

/** The raw stored value, or null when there is none or storage is unavailable (private mode, blocked). */
export function readStoredTheme(env: ThemeEnv = browserEnv()): string | null {
  try {
    return env.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Remembers the choice. System removes the key. Failing to persist never breaks the UI: the choice still applies for the session. */
export function writeStoredTheme(choice: ThemeChoice, env: ThemeEnv = browserEnv()): void {
  try {
    if (choice === "system") env.removeItem(THEME_STORAGE_KEY);
    else env.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Not persisted; nothing else to do.
  }
}

export function applyTheme(applied: AppliedTheme, env: ThemeEnv = browserEnv()): void {
  env.root.dataset.theme = applied;
  env.setThemeColor(THEME_COLORS[applied]);
}

export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function systemPrefersDark(): boolean {
  return typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches;
}
