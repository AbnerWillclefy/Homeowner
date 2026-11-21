import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import { Checkbox } from "./checkbox";

function Harness() {
  const [on, setOn] = useState(false);
  return <Checkbox label="Rice" checked={on} onCheckedChange={(v) => setOn(v === true)} />;
}

it("is named by its label", () => {
  render(<Harness />);
  expect(screen.getByRole("checkbox", { name: "Rice" })).toBeTruthy();
});

it("Space toggles it from the keyboard", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("checkbox"));
  await user.keyboard(" ");
  expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("true");
  await user.keyboard(" ");
  expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
});

it("clicking the label toggles it", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByText("Rice"));
  expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("true");
});

it("a disabled checkbox does not toggle", async () => {
  const user = userEvent.setup();
  render(<Checkbox label="Rice" disabled />);
  await user.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
});
