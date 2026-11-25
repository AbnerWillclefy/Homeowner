// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { EnvironmentBadge } from "./EnvironmentBadge";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderBadge(environment: string | undefined): string {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(createElement(EnvironmentBadge, { environment })));
  const text = container.textContent ?? "";
  act(() => root.unmount());
  return text;
}

describe("EnvironmentBadge", () => {
  it("names a staging build", () => {
    expect(renderBadge("staging")).toBe("STAGING");
  });

  it.each([["production"], [undefined]])("shows nothing for %s", (environment) => {
    expect(renderBadge(environment)).toBe("");
  });
});
