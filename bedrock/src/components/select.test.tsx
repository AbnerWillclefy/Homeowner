import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Select } from "./select";
import { CalendarDays } from "lucide-react";

const options = [{ value: "a", label: "Alpha" }];

it("names the trigger by its label", () => {
  render(<Select label="Account" options={options} placeholder="Choose" />);
  expect(screen.getByRole("combobox", { name: "Account" })).toBeTruthy();
});

it("the error replaces the hint, is announced and describes the trigger", () => {
  render(<Select label="Account" options={options} hint="Pick one" error="Choose an account." />);
  const trigger = screen.getByRole("combobox", { description: "Choose an account." });
  expect(trigger.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByRole("alert").textContent).toBe("Choose an account.");
  expect(screen.queryByText("Pick one")).toBeNull();
});

it("shows the placeholder until a value is chosen, and can be disabled", () => {
  render(<Select label="Account" options={options} placeholder="Choose" disabled />);
  const trigger = screen.getByRole("combobox", { name: "Account" });
  expect(trigger.textContent).toContain("Choose");
  expect((trigger as HTMLButtonElement).disabled).toBe(true);
});

it("hides the label visually but keeps it as the trigger's name", () => {
  render(<Select label="Month" hideLabel options={options} />);
  expect(screen.getByRole("combobox", { name: "Month" })).toBeTruthy();
  expect(screen.getByText("Month").className).toContain("sr-only");
});

it("draws the trigger at control-lg on a phone", () => {
  render(<Select label="Account" options={options} />);
  expect(screen.getByRole("combobox").className).toContain("max-tablet:h-control-lg");
});

it("draws a leading icon and the secondary look only when given an icon", () => {
  const { unmount } = render(<Select label="Month" hideLabel options={options} icon={CalendarDays} />);
  const withIcon = screen.getByRole("combobox", { name: "Month" });
  expect(withIcon.querySelectorAll("svg")).toHaveLength(2);
  expect(withIcon.className).toContain("bg-surface-raised");
  unmount();
  render(<Select label="Month" hideLabel options={options} />);
  const plain = screen.getByRole("combobox", { name: "Month" });
  expect(plain.querySelectorAll("svg")).toHaveLength(1);
  expect(plain.className).not.toContain("bg-surface-raised");
});
