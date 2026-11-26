// @vitest-environment jsdom
import { act, createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useFocusOnNavigate } from "./useFocusOnNavigate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The Shell's shape: no top bar, the tab inside the content ref and its page header's h1 first in it. */
function Page({ pathname, heading = "h1" }: { pathname: string; heading?: "h1" | "h2" | null }) {
  const content = useRef<HTMLDivElement>(null);
  useFocusOnNavigate(content, pathname, "Homeowner");
  return createElement(
    "div",
    null,
    createElement("div", { ref: content }, heading && createElement(heading, null, "Chores"), createElement("h2", null, "Section")),
  );
}

describe("useFocusOnNavigate", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

  function mount() {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    cleanups.push(() => act(() => root.unmount()), () => container.remove());
    return root;
  }

  it("focuses the tab's page header h1, before any h2 under it", () => {
    const root = mount();
    act(() => root.render(createElement(Page, { pathname: "/" })));
    expect(document.activeElement).toBe(document.body);
    act(() => root.render(createElement(Page, { pathname: "/chores" })));

    expect(document.activeElement?.tagName).toBe("H1");
    expect(document.activeElement?.textContent).toBe("Chores");
  });

  it("still finds an h2 where a screen has no h1", () => {
    const root = mount();
    act(() => root.render(createElement(Page, { pathname: "/", heading: "h2" })));
    act(() => root.render(createElement(Page, { pathname: "/chores", heading: "h2" })));
    expect(document.activeElement?.tagName).toBe("H2");
  });
});
