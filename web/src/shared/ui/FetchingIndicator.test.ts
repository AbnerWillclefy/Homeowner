// @vitest-environment jsdom
import { act, createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { FetchingIndicator } from "./FetchingIndicator";
import { mountWithI18n } from "./testing";

const { render, container } = mountWithI18n();
const mount = (active: boolean) => render(createElement(FetchingIndicator, { active }));
const named = () => container().querySelector('[role="img"]');

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
    const svg = container().querySelector("svg")!;
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
    expect(container().querySelector('[role="status"], [role="alert"], [aria-live]')).toBeNull();
  });
});
