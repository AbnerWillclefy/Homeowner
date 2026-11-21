import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DonutChart } from "./donut-chart";
import type { SpendingCategoryId } from "./category-tag";

const ids: SpendingCategoryId[] = ["housing", "groceries", "transport", "eating-out", "health", "leisure", "shopping", "pets", "education"];
const nine = ids.map((category, i) => ({ category, label: category, cents: (9 - i) * 1000 }));

const chart = (slices: typeof nine) => <DonutChart slices={slices} otherLabel="Outros" label="Conclusão" totalLabel="Total" alternative={<table />} />;

it("shows the label but no legend or total when nothing was spent", () => {
  const { container } = render(chart([]));
  expect(screen.getByRole("img", { name: "Conclusão" })).toBeTruthy();
  expect(container.querySelector("ul")).toBeNull();
  expect(container.textContent).not.toContain("Total");
  expect(container.textContent).not.toContain("NaN");
});

it("merges nine slices into seven legend rows ending with Other", () => {
  const { container } = render(chart(nine));
  const rows = container.querySelectorAll("li");
  expect(rows).toHaveLength(7);
  expect(rows[6].textContent).toContain("Outros");
});

it("highlights only the hovered legend row", () => {
  const { container } = render(chart(nine));
  const rows = container.querySelectorAll("li");
  fireEvent.mouseEnter(rows[2]);
  expect(Array.from(rows).map((r) => r.classList.contains("bg-surface-hover"))).toEqual([false, false, true, false, false, false, false]);
});
