import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { SPENDING_CATEGORIES, SPENDING_LOOK, spendingKey } from "./spendingCategories";

describe("spending categories", () => {
  it("lists the 13 ids the API accepts, in order", () => {
    expect(SPENDING_CATEGORIES).toEqual([
      "housing", "household_bills", "groceries", "eating_out", "transport", "health", "education",
      "leisure", "shopping", "subscriptions", "pets", "taxes_fees", "other",
    ]);
  });
  it("gives each a look, with its own token in every class", () => {
    for (const id of SPENDING_CATEGORIES) {
      const { icon, ink, tile, bar, fill } = SPENDING_LOOK[id];
      const token = id.replace("_", "-");
      expect(icon).toBeDefined();
      expect([ink, tile, bar, fill]).toEqual([`text-spend-${token}`, `bg-spend-${token}-tint`, `bg-spend-${token}`, `fill-spend-${token}`]);
    }
  });
  it("has a label for each in the catalog", () => {
    for (const id of SPENDING_CATEGORIES) expect(enUS).toHaveProperty(spendingKey(id));
  });
});
