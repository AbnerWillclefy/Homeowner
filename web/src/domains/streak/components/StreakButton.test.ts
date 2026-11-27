// @vitest-environment jsdom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountWithI18n } from "../../../shared/ui/testing";
import { StreakButton } from "./StreakButton";

const { render, container } = mountWithI18n();

// The Sheet below the tablet breakpoint is a drawer, which reads the viewport and watches its size.
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
const box = () => container().firstElementChild as HTMLElement;
const pill = () => box().querySelector("span");

describe("StreakButton", () => {
  it("works outside a PageLoading: it sits in Today's header tools, above the plan", () => {
    expect(() => render(createElement(StreakButton, { streak: null, loading: true }))).not.toThrow();
  });

  it("holds an empty, hidden box of its own size while it loads", () => {
    render(createElement(StreakButton, { streak: null, loading: true }));
    expect(box().getAttribute("aria-hidden")).toBe("true");
    expect(box().className).toContain("h-11");
    expect(box().className).toContain("w-16");
    expect(pill()).toBeNull();
  });

  it("draws the pulsing placeholder only after 300ms", () => {
    render(createElement(StreakButton, { streak: null, loading: true }));
    act(() => vi.advanceTimersByTime(299));
    expect(pill()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(pill()).not.toBeNull();
  });

  it("shows the button, named with the number, once it has a Streak", () => {
    render(createElement(StreakButton, { streak: { current: 3, todayGrew: false }, loading: false }));
    expect(container().querySelector("button")?.getAttribute("aria-label")).toBe("Streak: 3 days");
  });

  it("names the Streak paused on a Drained day that has not grown, and not when a Completion grew it", () => {
    render(createElement(StreakButton, { streak: { current: 4, todayGrew: false }, loading: false, paused: true }));
    expect(container().querySelector("button")?.getAttribute("aria-label")).toBe("Streak paused: 4 days");
    render(createElement(StreakButton, { streak: { current: 4, todayGrew: true }, loading: false, paused: true }));
    expect(container().querySelector("button")?.getAttribute("aria-label")).toBe("Streak: 4 days");
  });

  it("is absent when the Streak could not be read", () => {
    render(createElement(StreakButton, { streak: null, loading: false }));
    expect(container().firstElementChild).toBeNull();
  });
});
