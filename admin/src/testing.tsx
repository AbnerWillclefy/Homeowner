import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach } from "vitest";

const globals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
globals.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Sets up a jsdom container around each test and returns `render`, which mounts a node and then waits a moment, so a
 * query's answer is on screen before the test looks. (TanStack Query notifies observers on a timer, and React's `act`
 * does not flush updates made by a timer, so the wait runs outside `act` with the act environment switched off.)
 */
export function mount(): { render(node: ReactNode): Promise<void>; container(): HTMLElement } {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  return {
    async render(node) {
      act(() => root.render(node));
      globals.IS_REACT_ACT_ENVIRONMENT = false;
      try {
        await new Promise((resolve) => setTimeout(resolve, 30));
      } finally {
        globals.IS_REACT_ACT_ENVIRONMENT = true;
      }
    },
    container: () => container,
  };
}
