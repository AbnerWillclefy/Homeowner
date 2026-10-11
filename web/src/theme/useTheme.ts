import { useContext } from "react";
import { ThemeContext, type Theme } from "./context";

export function useTheme(): Theme {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}
