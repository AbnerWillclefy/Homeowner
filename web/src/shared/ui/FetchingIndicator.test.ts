// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enUS } from "../i18n/catalogs/en-US";
import { I18nContext } from "../i18n/context";
import { FetchingIndicator } from "./FetchingIndicator";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const i18n = { locale: "en-US", setLocale: () => {}, t: (key: keyof typeof enUS) => enUS[key] };
const mount = (active: boolean) =>
  act(() => root.render(createElement(I18nContext.Provider, { value: i18n as never }, createElement(FetchingIndicator, { active }))));
const named = () => container.querySelector('[role="img"]');

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

describe("FetchingIndicator", () => {
  it("shows nothing at 299ms, so a fast refetch never flickers", () => {
    mount(true);
    act(() => vi.advanceTimersByTime(299));
    expect(named()).toBeNull();
  });

  it("shows a spinner with its accessible name at 300ms", () => {
    mount(true);
    act(() => vi.advanceTimersByTime(300));
    expect(named()?.getAttribute("aria-label")).toBe("Refreshing");
  });

  it("spins only when motion is allowed, in the muted colour, at 1rem", () => {
    mount(true);
    act(() => vi.advanceTimersByTime(300));
    const svg = container.querySelector("svg")!;
    const classes = svg.getAttribute("class")!.split(/\s+/);
    expect(classes).toContain("motion-safe:animate-spin");
    expect(classes).not.toContain("animate-spin");
    expect(classes).toContain("text-muted");
    expect(svg.getAttribute("width")).toBe("16");
  });

  it("disappears at once when the fetch ends", () => {
    mount(true);
    act(() => vi.advanceTimersByTime(300));
    mount(false);
    expect(named()).toBeNull();
  });

  it("is not a live region, so screen readers do not announce every refresh", () => {
    mount(true);
    act(() => vi.advanceTimersByTime(300));
    expect(container.querySelector('[role="status"], [role="alert"], [aria-live]')).toBeNull();
  });
});
