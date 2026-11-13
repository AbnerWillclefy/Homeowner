import type { MessageKey } from "../../../shared/i18n/catalogs";
import type { Translate } from "../../../shared/i18n/i18n";
import { SPENDING_CATEGORIES } from "../../overview/logic/spendingCategories";
import type { RowGroup, RowItem } from "../../overview/logic/monthRows";

const GROUP: Record<RowGroup["id"], MessageKey> = {
  cards: "overview.group.cards", bills: "overview.group.bills", planned: "overview.group.planned", spent: "overview.group.spent", saving: "overview.group.saving",
};

/** The current month's Planned spending is what is left of the limits, so it says so. */
export const groupLabel = (t: Translate, id: RowGroup["id"], current: boolean) => t(id === "planned" && current ? "projection.plannedCurrent" : GROUP[id]);

/** A line's name: its own for a card or Bill, the category's for Planned spending (an unknown one as the API wrote it). */
export function itemName(t: Translate, item: RowItem): string {
  if (item.kind === "offCardInstallments") return t("projection.offCardInstallments");
  if (item.kind === "planned") return (SPENDING_CATEGORIES as readonly string[]).includes(item.category) ? t(`spending.${item.category}` as MessageKey) : item.category;
  return item.name;
}
