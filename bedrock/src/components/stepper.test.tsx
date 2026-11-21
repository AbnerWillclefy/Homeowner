import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import { Stepper } from "./stepper";

function Harness({ initial = 2, step, min, max }: { initial?: number; step?: number; min?: number; max?: number }) {
  const [v, setV] = useState(initial);
  return <Stepper label="Quantity of Rice" decrementLabel="Less" incrementLabel="More" value={v} onValueChange={setV} step={step} min={min} max={max} />;
}

it("names the group and both buttons", () => {
  render(<Harness />);
  expect(screen.getByRole("group", { name: "Quantity of Rice" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Less" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
});

it("minus is aria-disabled at the minimum, keeps focus and ignores more presses", async () => {
  const user = userEvent.setup();
  render(<Harness initial={2} />);
  const less = screen.getByRole("button", { name: "Less" });
  less.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("status").textContent).toBe("1");
  expect(less.getAttribute("aria-disabled")).toBe("true");
  expect(document.activeElement).toBe(less);
  await user.keyboard("{Enter}");
  expect(screen.getByRole("status").textContent).toBe("1");
});

it("plus is aria-disabled at the maximum while minus stays enabled", async () => {
  const user = userEvent.setup();
  render(<Harness initial={2} max={3} />);
  const more = screen.getByRole("button", { name: "More" });
  await user.click(more);
  expect(screen.getByRole("status").textContent).toBe("3");
  expect(more.getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByRole("button", { name: "Less" }).getAttribute("aria-disabled")).toBeNull();
  await user.click(more);
  expect(screen.getByRole("status").textContent).toBe("3");
});

it.each([
  [1.1, 0.1, "1.2"],
  [0.5, 0.25, "0.75"],
  [1.5, 1, "2.5"],
  [1.234, 1, "2.234"],
])("adds %s + %s without losing decimals", async (initial, step, shown) => {
  const user = userEvent.setup();
  render(<Harness initial={initial} step={step} min={step} />);
  await user.click(screen.getByRole("button", { name: "More" }));
  expect(screen.getByRole("status").textContent).toBe(shown);
});

it("keeps a three-decimal value on the minimum edge", () => {
  render(<Harness initial={0.001} step={0.001} />);
  expect(screen.getByRole("button", { name: "Less" }).getAttribute("aria-disabled")).toBe("true");
});

it("both buttons are disabled when the whole stepper is", () => {
  render(<Stepper label="Q" decrementLabel="Less" incrementLabel="More" value={3} onValueChange={() => {}} disabled />);
  expect((screen.getByRole("button", { name: "More" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Less" }) as HTMLButtonElement).disabled).toBe(true);
});
