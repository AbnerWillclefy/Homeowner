import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, expect, it } from "vitest";
import { DescriptionList } from "./description-list";

afterEach(cleanup);

const items = [
  { label: "Renda", value: "R$ 5.000" },
  { label: "− Faturas", value: "R$ 1.200" },
  { label: "Sobra", value: "R$ 3.800", total: true },
];

it("renders a dl with one dt and dd per item, in order", () => {
  const { container } = render(<DescriptionList items={items} />);
  const dts = container.querySelectorAll("dl > div > dt");
  const dds = container.querySelectorAll("dl > div > dd");
  expect(dts).toHaveLength(items.length);
  expect(dds).toHaveLength(items.length);
  items.forEach((item, i) => {
    expect(dts[i].textContent).toBe(item.label);
    expect(dds[i].textContent).toBe(item.value);
  });
});

it("styles only the total line, which stays a dt and dd pair", () => {
  const { container } = render(<DescriptionList items={items} />);
  const lines = [...container.querySelectorAll("dl > div")];
  expect(lines.map((l) => l.classList.contains("border-t"))).toEqual([false, false, true]);
  expect(lines[2].querySelectorAll(":scope > dt, :scope > dd")).toHaveLength(2);
});

it("renders nothing for no items", () => {
  const { container } = render(<DescriptionList items={[]} />);
  expect(container.querySelector("dl")).toBeNull();
});

it("has no axe violations", async () => {
  const { container } = render(<DescriptionList items={items} />);
  const { violations } = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(violations).toEqual([]);
});
