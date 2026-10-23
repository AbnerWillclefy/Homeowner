// @vitest-environment jsdom
import { act, createElement, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { lazyNamed } from "./lazyWithReload";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("lazyNamed", () => {
  it("renders the named export of the imported module", async () => {
    const module = { Screen: () => createElement("p", null, "named screen"), Other: () => createElement("p", null, "other") };
    const Lazy = lazyNamed(() => Promise.resolve(module), "Screen");
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(Suspense, { fallback: null }, createElement(Lazy)));
    });
    expect(container.textContent).toBe("named screen");
    act(() => root.unmount());
  });
});
