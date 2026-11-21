import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readStoredTheme, resolveTheme, writeStoredTheme, type ThemeChoice } from "./theme";

interface ThemeValue {
  choice: ThemeChoice;
  setChoice(next: ThemeChoice): void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme needs a ThemeProvider");
  return value;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState(() => readStoredTheme());

  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(choice, query.matches);
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    writeStoredTheme(next);
  }, []);
  const value = useMemo(() => ({ choice, setChoice }), [choice, setChoice]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}
