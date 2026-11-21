import { expect, it } from "vitest";
import { groupSlices } from "./donut-chart";

const cats = ["housing", "groceries", "transport", "health", "leisure", "pets", "shopping", "education", "subscriptions"] as const;
const slice = (i: number, cents: number) => ({ category: cats[i], label: cats[i], cents });

it("returns 5 slices sorted, unchanged", () => {
  const input = [slice(0, 100), slice(1, 500), slice(2, 300), slice(3, 200), slice(4, 400)];
  expect(groupSlices(input, "Outros").map((s) => s.cents)).toEqual([500, 400, 300, 200, 100]);
});

it("keeps the top 6 of 9 and merges the rest into one Other", () => {
  const input = cats.map((_, i) => slice(i, (i + 1) * 100)); // 100..900
  const out = groupSlices(input, "Outros");
  expect(out).toHaveLength(7);
  expect(out.slice(0, 6).map((s) => s.cents)).toEqual([900, 800, 700, 600, 500, 400]);
  expect(out[6]).toEqual({ category: "other", label: "Outros", cents: 100 + 200 + 300 });
});

it("merges an input other into the Other bucket", () => {
  const input = [...cats.slice(0, 7).map((_, i) => slice(i, (i + 1) * 100)), { category: "other" as const, label: "x", cents: 1000 }];
  const out = groupSlices(input, "Outros");
  expect(out.filter((s) => s.category === "other")).toHaveLength(1);
  expect(out.reduce((n, s) => n + s.cents, 0)).toBe(2800 + 1000);
});

it("renames a lone input other to otherLabel", () => {
  const out = groupSlices([slice(0, 100), { category: "other", label: "x", cents: 50 }], "Outros");
  expect(out).toEqual([slice(0, 100), { category: "other", label: "Outros", cents: 50 }]);
});

it("drops zero and negative slices", () => {
  expect(groupSlices([slice(0, 0), slice(1, -5), slice(2, 10)], "Outros")).toEqual([slice(2, 10)]);
});
