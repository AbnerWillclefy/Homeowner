import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Select } from "./select";

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
