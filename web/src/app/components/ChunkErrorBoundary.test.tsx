// @vitest-environment jsdom
import { act, createElement, Component, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../shared/i18n";
import { ChunkErrorBoundary } from "./ChunkErrorBoundary";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  // React logs a caught render error; the tests throw on purpose.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function Boom({ error }: { error: Error }): ReactNode {
  throw error;
}

/** Stands for the next boundary up, to see what reaches it. */
class Outer extends Component<{ children: ReactNode }, { caught: Error | null }> {
  state = { caught: null as Error | null };
  static getDerivedStateFromError(caught: Error) {
    return { caught };
  }
  render() {
    return this.state.caught ? createElement("p", { "data-testid": "outer" }, this.state.caught.message) : this.props.children;
  }
}

function show(error: Error) {
  act(() =>
    root.render(
      createElement(
        I18nProvider,
        null,
        createElement(Outer, null, createElement(ChunkErrorBoundary, null, createElement(Boom, { error }))),
      ),
    ),
  );
}

describe("ChunkErrorBoundary", () => {
  it("shows the alert with Try again when a chunk cannot load", () => {
    show(new TypeError("Failed to fetch dynamically imported module: https://x/assets/Me.js"));
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="outer"]')).toBeNull();
  });

  it("rethrows any other error to the boundary above instead of hiding it", () => {
    show(new TypeError("Cannot read properties of undefined (reading 'name')"));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[data-testid="outer"]')?.textContent).toContain("Cannot read properties");
  });
});
