import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { delayedFlag } from "./delayedFlag";

describe("delayedFlag", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function make(delayMs = 300) {
    const seen: boolean[] = [];
    const flag = delayedFlag(delayMs, (on) => seen.push(on));
    return { flag, seen };
  }

  it("stays false at 299ms and turns true at 300ms", () => {
    const { flag, seen } = make();
    flag.set(true);
    vi.advanceTimersByTime(299);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([true]);
  });

  it("never turns true for a load that ends at 200ms, and clears the timer", () => {
    const { flag, seen } = make();
    flag.set(true);
    vi.advanceTimersByTime(200);
    flag.set(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual([]);
  });

  it("turns false at once when it goes inactive after being true", () => {
    const { flag, seen } = make();
    flag.set(true);
    vi.advanceTimersByTime(300);
    flag.set(false);
    expect(seen).toEqual([true, false]);
  });

  it("restarts the full wait when activated again", () => {
    const { flag, seen } = make();
    flag.set(true);
    vi.advanceTimersByTime(200);
    flag.set(false);
    flag.set(true);
    vi.advanceTimersByTime(299);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([true]);
  });

  it("keeps the first wait when set to true twice", () => {
    const { flag, seen } = make();
    flag.set(true);
    vi.advanceTimersByTime(200);
    flag.set(true);
    vi.advanceTimersByTime(100);
    expect(seen).toEqual([true]);
  });

  it("does not report false when it was never true", () => {
    const { flag, seen } = make();
    flag.set(false);
    expect(seen).toEqual([]);
  });

  it("clears the pending timer on dispose", () => {
    const { flag, seen } = make();
    flag.set(true);
    flag.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual([]);
  });
});
