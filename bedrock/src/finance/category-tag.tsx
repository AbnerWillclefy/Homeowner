import {
  Car, CircleEllipsis, GraduationCap, HeartPulse, House, Landmark, PawPrint,
  Repeat, ShoppingBag, ShoppingCart, Ticket, Utensils, Zap, type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/cn";

export type SpendingCategoryId =
  | "housing" | "household-bills" | "groceries" | "eating-out" | "transport" | "health" | "education"
  | "leisure" | "shopping" | "subscriptions" | "pets" | "taxes-fees" | "other";

// Every tile is a whole literal: Tailwind finds classes as complete strings, so never build them from the id.
const categories: Record<SpendingCategoryId, { icon: LucideIcon; tile: string }> = {
  housing: { icon: House, tile: "bg-cat-housing-soft text-cat-housing" },
  "household-bills": { icon: Zap, tile: "bg-cat-household-bills-soft text-cat-household-bills" },
  groceries: { icon: ShoppingCart, tile: "bg-cat-groceries-soft text-cat-groceries" },
  "eating-out": { icon: Utensils, tile: "bg-cat-eating-out-soft text-cat-eating-out" },
  transport: { icon: Car, tile: "bg-cat-transport-soft text-cat-transport" },
  health: { icon: HeartPulse, tile: "bg-cat-health-soft text-cat-health" },
  education: { icon: GraduationCap, tile: "bg-cat-education-soft text-cat-education" },
  leisure: { icon: Ticket, tile: "bg-cat-leisure-soft text-cat-leisure" },
  shopping: { icon: ShoppingBag, tile: "bg-cat-shopping-soft text-cat-shopping" },
  subscriptions: { icon: Repeat, tile: "bg-cat-subscriptions-soft text-cat-subscriptions" },
  pets: { icon: PawPrint, tile: "bg-cat-pets-soft text-cat-pets" },
  "taxes-fees": { icon: Landmark, tile: "bg-cat-taxes-fees-soft text-cat-taxes-fees" },
  other: { icon: CircleEllipsis, tile: "bg-cat-other-soft text-cat-other" },
};

type Size = "md" | "sm";

/** The bare tile, for ListRow. Decorative: the name is text beside it. */
export function CategoryIcon({ category, size = "md", className }: { category: SpendingCategoryId; size?: Size; className?: string }) {
  const { icon: Icon, tile } = categories[category];
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center", size === "md" ? "size-8 rounded-md" : "size-6 rounded-sm", tile, className)}
    >
      <Icon className={size === "md" ? "size-4" : "size-3.5"} />
    </span>
  );
}

export function CategoryTag({ category, label, share, size = "md" }: { category: SpendingCategoryId; label: string; share?: string; size?: Size }) {
  return (
    <span className="inline-flex items-center gap-2">
      <CategoryIcon category={category} size={size} />
      <span className="body text-text">{label}</span>
      {share && <span className="inline-flex h-6 items-center rounded-full bg-surface-hover px-2 label tabular-nums text-text-muted">{share}</span>}
    </span>
  );
}
