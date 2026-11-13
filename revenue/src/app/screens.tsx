import {
  Banknote, CreditCard, Landmark, LayoutDashboard, LineChart, PiggyBank, Receipt, Settings, Tags, Target,
  type LucideIcon,
} from "lucide-react";
import type { ReactElement } from "react";
import { BillsPage } from "../domains/bills/BillsPage";
import { CardBillsPage } from "../domains/card-bills/CardBillsPage";
import { CategoriesPage } from "../domains/categories/CategoriesPage";
import { CategoryPage } from "../domains/categories/CategoryPage";
import { GoalsPage } from "../domains/goals/GoalsPage";
import { NetWorthPage } from "../domains/net-worth/NetWorthPage";
import { OnboardingPage } from "../domains/onboarding/OnboardingPage";
import { OverviewPage } from "../domains/overview/OverviewPage";
import { ProjectionPage } from "../domains/projection/ProjectionPage";
import { SettingsPage } from "../domains/settings/SettingsPage";
import { SourcesPage } from "../domains/sources/SourcesPage";
import { TransactionsPage } from "../domains/transactions/TransactionsPage";
import type { MessageKey } from "../shared/i18n/catalogs";

export interface Screen {
  /** English and stable: /bills is used by the deploy smoke test and the reminder payload. */
  path: string;
  label: MessageKey;
  icon: LucideIcon;
  element: ReactElement;
}

const screen = (path: string, label: MessageKey, icon: LucideIcon, element: ReactElement): Screen => ({ path, label, icon, element });

export const OVERVIEW = screen("/", "nav.overview", LayoutDashboard, <OverviewPage />);
export const TRANSACTIONS = screen("/transactions", "nav.transactions", Receipt, <TransactionsPage />);
export const BILLS = screen("/bills", "nav.bills", Banknote, <BillsPage />);
export const CARD_BILLS = screen("/card-bills", "nav.cardBills", CreditCard, <CardBillsPage />);
export const CATEGORIES = screen("/categories", "nav.categories", Tags, <CategoriesPage />);
/** The drill-down into one Spending Category: a route, not a navigation item. */
export const CATEGORY = screen("/categories/:category", "nav.categories", Tags, <CategoryPage />);
export const GOALS = screen("/goals", "nav.goals", Target, <GoalsPage />);
export const NET_WORTH = screen("/net-worth", "nav.netWorth", PiggyBank, <NetWorthPage />);
export const PROJECTION = screen("/projection", "nav.projection", LineChart, <ProjectionPage />);
export const SOURCES = screen("/sources", "nav.sources", Landmark, <SourcesPage />);
export const SETTINGS = screen("/settings", "nav.settings", Settings, <SettingsPage />);
/** The first-run flow: a route, not a navigation item. */
export const ONBOARDING = screen("/onboarding", "page.onboarding", LayoutDashboard, <OnboardingPage />);

export const NAV_GROUPS: { label: MessageKey; screens: Screen[] }[] = [
  { label: "nav.group.main", screens: [OVERVIEW, TRANSACTIONS] },
  { label: "nav.group.planning", screens: [BILLS, CARD_BILLS, CATEGORIES, GOALS, NET_WORTH, PROJECTION] },
  { label: "nav.group.accounts", screens: [SOURCES] },
];
/** Pinned to the bottom of the Sidebar. */
export const NAV_FOOTER: Screen[] = [SETTINGS];
/** On a phone, four tabs and "More" with everything else. */
export const TABS: Screen[] = [OVERVIEW, TRANSACTIONS, BILLS, GOALS];
export const ROUTES: Screen[] = [...NAV_GROUPS.flatMap((g) => g.screens), ...NAV_FOOTER, CATEGORY, ONBOARDING];
export const MORE: Screen[] = [...NAV_GROUPS.flatMap((g) => g.screens), ...NAV_FOOTER].filter((s) => !TABS.includes(s));
