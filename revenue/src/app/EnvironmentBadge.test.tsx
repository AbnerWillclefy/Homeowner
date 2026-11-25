import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnvironmentBadge } from "./EnvironmentBadge";

describe("EnvironmentBadge", () => {
  it("names a staging build", () => {
    render(<EnvironmentBadge environment="staging" />);
    expect(screen.getByText("STAGING")).toBeTruthy();
  });

  it.each([["production"], [undefined]])("shows nothing for %s", (environment) => {
    const { container } = render(<EnvironmentBadge environment={environment} />);
    expect(container.innerHTML).toBe("");
  });
});
