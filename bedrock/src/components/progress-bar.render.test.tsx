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

it("draws the fill in the brand colour at any ratio when the tone is brand", () => {
  const fill = (tone?: "brand") => {
    const { container } = render(<ProgressBar label="L" value={90} max={100} tone={tone} />);
    return container.querySelector("[data-state]:not([role])")?.className ?? "";
  };
  expect(fill()).toContain("bg-warning");
  cleanup();
  expect(fill("brand")).toContain("bg-brand");
});
