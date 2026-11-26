import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { applyTheme, LIGHT_QUERY, readStoredTheme, systemPrefersLight, writeStoredTheme } from "./browserTheme";
import { ThemeContext, type Theme } from "./context";
import { resolveTheme, THEME_STORAGE_KEY, type ThemeChoice } from "./theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Storage is read once. A bad stored value is ignored (System) and left alone until the person chooses.
  const [choice, setChoiceState] = useState<ThemeChoice>(() => resolveTheme({ stored: readStoredTheme(), systemPrefersLight: systemPrefersLight() }).choice);
  const [systemLight, setSystemLight] = useState(systemPrefersLight);

  // Follow the OS live, but only while the choice is System.
  useEffect(() => {
    if (choice !== "system" || typeof matchMedia !== "function") return;
    const query = matchMedia(LIGHT_QUERY);
    const onChange = () => setSystemLight(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [choice]);

  // Keep a second tab in step.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      setChoiceState(resolveTheme({ stored: readStoredTheme(), systemPrefersLight: systemPrefersLight() }).choice);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const applied = choice === "system" ? (systemLight ? "light" : "dark") : choice;

  // Only an attribute on <html> changes, so no screen remounts and no form input is lost.
  useLayoutEffect(() => {
    applyTheme(applied);
  }, [applied]);

  const setChoice = useCallback((next: ThemeChoice) => {
    writeStoredTheme(next);
    setChoiceState(next);
  }, []);

  const value = useMemo<Theme>(() => ({ choice, applied, setChoice }), [choice, applied, setChoice]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
