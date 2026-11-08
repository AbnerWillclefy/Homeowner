import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { SPENDING_CATEGORIES, spendingKey } from "./spendingCategories";

describe("spending categories", () => {
  it("lists the 13 ids the API accepts, in order", () => {
    expect(SPENDING_CATEGORIES).toEqual([
      "housing", "household_bills", "groceries", "eating_out", "transport", "health", "education",
      "leisure", "shopping", "subscriptions", "pets", "taxes_fees", "other",
    ]);
  });
  it("has a label for each in the catalog", () => {
    for (const id of SPENDING_CATEGORIES) expect(enUS).toHaveProperty(spendingKey(id));
  });
});
