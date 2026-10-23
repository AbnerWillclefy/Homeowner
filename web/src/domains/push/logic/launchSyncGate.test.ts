import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { launchSyncGate, LAUNCH_SYNC_FALLBACK_MS } from "./launchSyncGate";

describe("launchSyncGate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs once when the page settles, and the fallback never runs it again", () => {
    const run = vi.fn();
    const gate = launchSyncGate(5000, run);
    gate.settled();
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs at the fallback delay and not before when nothing settles", () => {
    const run = vi.fn();
    launchSyncGate(5000, run);
    vi.advanceTimersByTime(4999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("ignores settled() after the fallback has run", () => {
    const run = vi.fn();
    const gate = launchSyncGate(5000, run);
    vi.advanceTimersByTime(5000);
    gate.settled();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs once however many times settled() is called", () => {
    const run = vi.fn();
    const gate = launchSyncGate(5000, run);
    gate.settled();
    gate.settled();
    gate.settled();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs nothing when disposed before either path", () => {
    const run = vi.fn();
    const gate = launchSyncGate(5000, run);
    gate.dispose();
    gate.settled();
    vi.advanceTimersByTime(10_000);
    expect(run).not.toHaveBeenCalled();
  });

  it("falls back after a few seconds", () => {
    expect(LAUNCH_SYNC_FALLBACK_MS).toBeGreaterThanOrEqual(3000);
    expect(LAUNCH_SYNC_FALLBACK_MS).toBeLessThanOrEqual(10_000);
  });
});
