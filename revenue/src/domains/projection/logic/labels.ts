import type { MessageKey } from "../../../shared/i18n/catalogs";
import type { Translate } from "../../../shared/i18n/i18n";
import { SPENDING_CATEGORIES } from "../../overview/logic/spendingCategories";

/** A category's name; an unknown one as the API wrote it. */
export const categoryName = (t: Translate, category: string) => ((SPENDING_CATEGORIES as readonly string[]).includes(category) ? t(`spending.${category}` as MessageKey) : category);
