// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enUS } from "../i18n/catalogs/en-US";
import { I18nContext } from "../i18n/context";
import { PageHeader } from "./PageHeader";
import { PageLoading, useReportFetching } from "./PageLoading";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const i18n = { locale: "en-US", setLocale: () => {}, t: (key: keyof typeof enUS) => enUS[key] };
const render = (node: ReactNode) => act(() => root.render(createElement(I18nContext.Provider, { value: i18n as never }, node)));
const slot = () => container.querySelector('[data-slot="fetching"]');

function Fetching({ on }: { on: boolean }) {
  useReportFetching(on);
  return null;
}

const page = (on: boolean) =>
  createElement(PageLoading, {
    message: "Loading",
    children: [createElement(PageHeader, { key: "h", title: "Today" }), createElement(Fetching, { key: "f", on })],
  });

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("PageHeader", () => {
  it("has no fetching slot outside a PageLoading", () => {
    render(createElement(PageHeader, { title: "Sign in" }));
    expect(slot()).toBeNull();
    expect(container.querySelector("h2")?.textContent).toBe("Sign in");
  });

  it("reserves an empty 1rem slot inside a PageLoading while idle", () => {
    render(page(false));
    expect(slot()).not.toBeNull();
    expect(slot()!.className).toContain("size-4");
    expect(slot()!.querySelector("svg")).toBeNull();
  });

  it("fills the same slot with the spinner after 300ms of fetching, and empties it after", () => {
    render(page(true));
    act(() => vi.advanceTimersByTime(299));
    expect(slot()!.querySelector("svg")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(slot()!.querySelector('[aria-label="Refreshing"]')).not.toBeNull();
    render(page(false));
    expect(slot()!.querySelector("svg")).toBeNull();
    expect(container.querySelectorAll('[data-slot="fetching"]')).toHaveLength(1);
  });

  it("shows one spinner however many sections fetch", () => {
    render(
      createElement(PageLoading, {
        message: "Loading",
        children: [
          createElement(PageHeader, { key: "h", title: "Today" }),
          createElement(Fetching, { key: "a", on: true }),
          createElement(Fetching, { key: "b", on: true }),
        ],
      }),
    );
    act(() => vi.advanceTimersByTime(300));
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });
});
