import { createContext } from "react";
import type { AppliedTheme, ThemeChoice } from "./theme";

export interface Theme {
  /** What the person picked: System, Light or Dark. The Settings control shows this. */
  choice: ThemeChoice;
  /** What is painted right now. */
  applied: AppliedTheme;
  setChoice(choice: ThemeChoice): void;
}

export const ThemeContext = createContext<Theme | null>(null);
