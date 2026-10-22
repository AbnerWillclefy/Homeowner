import { createElement, act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./queryClient";

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
  unmount(): void;
}

/** Mounts an element in jsdom under a QueryClientProvider. Call `unmount` in `afterEach`. */
export function renderWithQueryClient(element: ReactElement, client: QueryClient = createTestQueryClient()): Rendered {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  act(() => root.render(createElement(QueryClientProvider, { client }, element)));
  return {
    client,
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}
