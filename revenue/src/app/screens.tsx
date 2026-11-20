import {
  Banknote, CreditCard, Landmark, LayoutDashboard, LineChart, MessageCircle, PiggyBank, Receipt, Settings, ShoppingBasket, Tags, Target,
  type LucideIcon,
} from "lucide-react";
import type { ReactElement } from "react";
import { BillsPage } from "../domains/bills/BillsPage";
import { ChatPage } from "../domains/chat/ChatPage";
import { CardBillsPage } from "../domains/card-bills/CardBillsPage";
import { CategoriesPage } from "../domains/categories/CategoriesPage";
import { CategoryPage } from "../domains/categories/CategoryPage";
import { GoalsPage } from "../domains/goals/GoalsPage";
import { NetWorthPage } from "../domains/net-worth/NetWorthPage";
import { OverviewPage } from "../domains/overview/OverviewPage";
import { PantryPage } from "../domains/pantry/PantryPage";
import { ShoppingListPage } from "../domains/pantry/ShoppingListPage";
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
export const PANTRY = screen("/pantry", "nav.pantry", ShoppingBasket, <PantryPage />);
/** The next shopping list, reached from the Pantry: a route, not a navigation item. */
export const PANTRY_LIST = screen("/pantry/list", "pantry.list", ShoppingBasket, <ShoppingListPage />);
/** Last of "Principal", and out of "Mais": on a phone the floating button is the way in (docs/design/revenue/README.md). */
export const CHAT = screen("/chat", "nav.ask", MessageCircle, <ChatPage />);
export const GOALS = screen("/goals", "nav.goals", Target, <GoalsPage />);
export const NET_WORTH = screen("/net-worth", "nav.netWorth", PiggyBank, <NetWorthPage />);
export const PROJECTION = screen("/projection", "nav.projection", LineChart, <ProjectionPage />);
export const SOURCES = screen("/sources", "nav.sources", Landmark, <SourcesPage />);
export const SETTINGS = screen("/settings", "nav.settings", Settings, <SettingsPage />);

export const NAV_GROUPS: { label: MessageKey; screens: Screen[] }[] = [
  { label: "nav.group.main", screens: [OVERVIEW, TRANSACTIONS, BILLS, CARD_BILLS, CATEGORIES, PANTRY, CHAT] },
  { label: "nav.group.planning", screens: [GOALS, NET_WORTH, PROJECTION, SOURCES] },
];
/** Pinned to the bottom of the Sidebar. */
export const NAV_FOOTER: Screen[] = [SETTINGS];
/** On a phone, four tabs and "More" with everything else. */
export const TABS: Screen[] = [OVERVIEW, TRANSACTIONS, BILLS, GOALS];
export const ROUTES: Screen[] = [...NAV_GROUPS.flatMap((g) => g.screens), ...NAV_FOOTER, CATEGORY, PANTRY_LIST];
export const MORE: Screen[] = [...NAV_GROUPS.flatMap((g) => g.screens), ...NAV_FOOTER].filter((s) => !TABS.includes(s) && s !== CHAT);
