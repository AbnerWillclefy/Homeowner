import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ProgressBar } from "./progress-bar";

afterEach(cleanup);

it("keeps aria-valuenow, capped at max, when the value is over max", () => {
  render(<ProgressBar label="L" value={2200} max={2000} />);
  const bar = screen.getByRole("progressbar", { name: "L" });
  expect(bar.getAttribute("aria-valuenow")).toBe("2000");
  expect(bar.getAttribute("aria-valuemax")).toBe("2000");
});

it("keeps the fixed tone even when the value is over max", () => {
  const { container } = render(<ProgressBar label="L" value={2200} max={2000} tone="brand" />);
  expect(container.querySelector(".bg-brand")).toBeTruthy();
  expect(container.querySelector(".bg-danger")).toBeNull();
});
