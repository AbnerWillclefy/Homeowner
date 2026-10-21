import { createElement, act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./queryClient";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The app's defaults, but nothing is garbage collected mid-test. Use a fresh one per test. */
export function createTestQueryClient(): QueryClient {
  const client = createQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: { ...client.getDefaultOptions().queries, gcTime: Infinity },
  });
  return client;
}

export interface Rendered {
  client: QueryClient;
  container: HTMLElement;
  /** Renders again into the same tree (for changed props). */
  rerender(element: ReactElement): void;
  unmount(): void;
}

/** Mounts an element in jsdom under a QueryClientProvider. Call `unmount` in `afterEach`. */
export function renderWithQueryClient(element: ReactElement, client: QueryClient = createTestQueryClient()): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  const render = (next: ReactElement) => act(() => root.render(createElement(QueryClientProvider, { client }, next)));
  render(element);
  return {
    client,
    container,
    rerender: render,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

export interface RenderedHook<T> {
  client: QueryClient;
  /** The value from the latest render of the hook. */
  readonly current: T;
  unmount(): void;
}

/** Mounts a probe component that calls `hook` under a fresh QueryClient and exposes its latest value. */
export function renderHookWithClient<T>(hook: () => T, client: QueryClient = createTestQueryClient()): RenderedHook<T> {
  let latest: { value: T } | null = null;
  function Probe() {
    latest = { value: hook() };
    return null;
  }
  const rendered = renderWithQueryClient(createElement(Probe), client);
  return {
    client,
    get current() {
      if (latest === null) throw new Error("the hook has not rendered");
      return latest.value;
    },
    unmount: rendered.unmount,
  };
}
