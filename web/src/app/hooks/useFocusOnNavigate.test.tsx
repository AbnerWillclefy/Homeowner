// @vitest-environment jsdom
import { act, createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useFocusOnNavigate } from "./useFocusOnNavigate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The Shell's shape: a top bar with the logo's h1 outside the content ref, then the tab inside it. */
function Page({ pathname }: { pathname: string }) {
  const content = useRef<HTMLDivElement>(null);
  useFocusOnNavigate(content, pathname, "Homeowner");
  return createElement(
    "div",
    null,
    createElement("header", null, createElement("h1", null, "homeowner"), createElement("button", null, "5")),
    createElement("div", { ref: content }, createElement("h2", null, "Chores")),
  );
}

describe("useFocusOnNavigate with a top bar", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

  it("focuses the tab's own first h2, never the bar's logo heading", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    cleanups.push(() => act(() => root.unmount()), () => container.remove());

    act(() => root.render(createElement(Page, { pathname: "/" })));
    expect(document.activeElement).toBe(document.body);
    act(() => root.render(createElement(Page, { pathname: "/chores" })));

    expect(document.activeElement?.tagName).toBe("H2");
    expect(document.activeElement?.textContent).toBe("Chores");
  });
});
