import type { CategoryGroup, MonthView } from "./monthView";

/** The first `count` categories with something spent; `monthView` already puts the biggest first. */
export const topCategories = (view: MonthView, count: number): CategoryGroup[] => view.categories.filter((c) => c.spentCents > 0).slice(0, count);
