import { Car, Ellipsis, GraduationCap, HeartPulse, House, PawPrint, Receipt, Repeat, ShoppingBag, ShoppingCart, Ticket, Utensils, Zap, type LucideIcon } from "lucide-react";
import type { MessageKey } from "../../../shared/i18n";

/** The ids the API stores, in the order the picker lists them. */
export const SPENDING_CATEGORIES = [
  "housing", "household_bills", "groceries", "eating_out", "transport", "health", "education",
  "leisure", "shopping", "subscriptions", "pets", "taxes_fees", "other",
] as const;

export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number];

/** Their own `spending.*` keys: the Chore Category `pets` label is a different vocabulary. */
export const spendingKey = (id: SpendingCategory): MessageKey => `spending.${id}` as MessageKey;

export interface SpendingLook {
  icon: LucideIcon;
  /** Icon stroke. */
  ink: string;
  /** Icon tile fill. */
  tile: string;
  /** Bar fill. */
  bar: string;
  /** Donut part fill. */
  fill: string;
}

// Full class names, spelled out: Tailwind only builds the tokens it finds as whole strings in the source.
/** The fixed colour, tint and icon of each Spending Category (DESIGN.md, Spending Category colours). */
export const SPENDING_LOOK: Record<SpendingCategory, SpendingLook> = {
  housing: { icon: House, ink: "text-spend-housing", tile: "bg-spend-housing-tint", bar: "bg-spend-housing", fill: "fill-spend-housing" },
  household_bills: { icon: Zap, ink: "text-spend-household-bills", tile: "bg-spend-household-bills-tint", bar: "bg-spend-household-bills", fill: "fill-spend-household-bills" },
  groceries: { icon: ShoppingCart, ink: "text-spend-groceries", tile: "bg-spend-groceries-tint", bar: "bg-spend-groceries", fill: "fill-spend-groceries" },
  eating_out: { icon: Utensils, ink: "text-spend-eating-out", tile: "bg-spend-eating-out-tint", bar: "bg-spend-eating-out", fill: "fill-spend-eating-out" },
  transport: { icon: Car, ink: "text-spend-transport", tile: "bg-spend-transport-tint", bar: "bg-spend-transport", fill: "fill-spend-transport" },
  health: { icon: HeartPulse, ink: "text-spend-health", tile: "bg-spend-health-tint", bar: "bg-spend-health", fill: "fill-spend-health" },
  education: { icon: GraduationCap, ink: "text-spend-education", tile: "bg-spend-education-tint", bar: "bg-spend-education", fill: "fill-spend-education" },
  leisure: { icon: Ticket, ink: "text-spend-leisure", tile: "bg-spend-leisure-tint", bar: "bg-spend-leisure", fill: "fill-spend-leisure" },
  shopping: { icon: ShoppingBag, ink: "text-spend-shopping", tile: "bg-spend-shopping-tint", bar: "bg-spend-shopping", fill: "fill-spend-shopping" },
  subscriptions: { icon: Repeat, ink: "text-spend-subscriptions", tile: "bg-spend-subscriptions-tint", bar: "bg-spend-subscriptions", fill: "fill-spend-subscriptions" },
  pets: { icon: PawPrint, ink: "text-spend-pets", tile: "bg-spend-pets-tint", bar: "bg-spend-pets", fill: "fill-spend-pets" },
  taxes_fees: { icon: Receipt, ink: "text-spend-taxes-fees", tile: "bg-spend-taxes-fees-tint", bar: "bg-spend-taxes-fees", fill: "fill-spend-taxes-fees" },
  other: { icon: Ellipsis, ink: "text-spend-other", tile: "bg-spend-other-tint", bar: "bg-spend-other", fill: "fill-spend-other" },
};
