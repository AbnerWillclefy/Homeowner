import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Input } from "./input";

it("has a programmatic label", () => {
  render(<Input label="Name" />);
  expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
});

it("describes the field by the hint when there is no error", () => {
  render(<Input label="Name" hint="As on your ID" />);
  const field = screen.getByRole("textbox", { description: "As on your ID" });
  expect(field.getAttribute("aria-invalid")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("the error replaces the hint, is announced and tied to the field", () => {
  render(<Input label="Name" hint="As on your ID" error="Enter your name." />);
  const field = screen.getByRole("textbox", { description: "Enter your name." });
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByRole("alert").textContent).toBe("Enter your name.");
  expect(screen.queryByText("As on your ID")).toBeNull();
});
