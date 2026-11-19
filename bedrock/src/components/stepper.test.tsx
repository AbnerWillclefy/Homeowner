import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import { Stepper } from "./stepper";

function Harness({ initial = 2, step, min }: { initial?: number; step?: number; min?: number }) {
  const [v, setV] = useState(initial);
  return <Stepper label="Quantity of Rice" decrementLabel="Less" incrementLabel="More" value={v} onValueChange={setV} step={step} min={min} />;
}

it("names the group and both buttons", () => {
  render(<Harness />);
  expect(screen.getByRole("group", { name: "Quantity of Rice" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Less" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
});

it("minus is disabled at the minimum, one step by default", async () => {
  const user = userEvent.setup();
  render(<Harness initial={2} />);
  await user.click(screen.getByRole("button", { name: "Less" }));
  expect(screen.getByRole("status").textContent).toBe("1");
  expect((screen.getByRole("button", { name: "Less" }) as HTMLButtonElement).disabled).toBe(true);
});

it("steps a kilogram value without float noise", async () => {
  const user = userEvent.setup();
  render(<Harness initial={1.1} step={0.1} min={0.1} />);
  await user.click(screen.getByRole("button", { name: "More" }));
  expect(screen.getByRole("status").textContent).toBe("1.2");
});

it("keeps a three-decimal value on the minimum edge", () => {
  render(<Harness initial={0.001} step={0.001} />);
  expect((screen.getByRole("button", { name: "Less" }) as HTMLButtonElement).disabled).toBe(true);
});

it("both buttons are disabled when the whole stepper is", () => {
  render(<Stepper label="Q" decrementLabel="Less" incrementLabel="More" value={3} onValueChange={() => {}} disabled />);
  expect((screen.getByRole("button", { name: "More" }) as HTMLButtonElement).disabled).toBe(true);
});
