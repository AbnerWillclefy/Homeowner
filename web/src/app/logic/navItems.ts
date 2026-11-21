import type { MessageKey } from "../../shared/i18n";
import { CHORES_PATH, HOME_PATH, ME_PATH, TODAY_PATH } from "./routes";

export type NavIcon = "today" | "chores" | "home" | "me";

export interface NavItem {
  path: string;
  labelKey: MessageKey;
  icon: NavIcon;
}

/** The four bottom tabs, in order. The icon components are mapped in BottomNav so this file stays testable. */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: TODAY_PATH, labelKey: "nav.today", icon: "today" },
  { path: CHORES_PATH, labelKey: "nav.chores", icon: "chores" },
  { path: HOME_PATH, labelKey: "nav.home", icon: "home" },
  { path: ME_PATH, labelKey: "nav.me", icon: "me" },
];
