import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { launchSyncGate, LAUNCH_SYNC_FALLBACK_MS } from "./launchSyncGate";

describe("launchSyncGate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs once when the page settles, and the fallback never runs it again", async () => {
    const run = vi.fn();
    const gate = launchSyncGate(5000, run);
    gate.settled();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs at the fallback delay and not before when nothing settles", async () => {
    const run = vi.fn();
    launchSyncGate(5000, run);
    await vi.advanceTimersByTimeAsync(4999);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("ignores settled() after the fallback has run", async () => {
    const run = vi.fn();
    const gate = launchSyncGate(5000, run);
    await vi.advanceTimersByTimeAsync(5000);
    gate.settled();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs once however many times settled() is called", async () => {
    const run = vi.fn();
    const gate = launchSyncGate(5000, run);
    gate.settled();
    gate.settled();
    await vi.advanceTimersByTimeAsync(0);
    gate.settled();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs nothing when disposed before either path", async () => {
    const run = vi.fn();
    const gate = launchSyncGate(5000, run);
    gate.dispose();
    gate.settled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs nothing when disposed right after settled(), before the microtask", async () => {
    const run = vi.fn();
    const gate = launchSyncGate(5000, run);
    gate.settled();
    gate.dispose();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).not.toHaveBeenCalled();
  });

  it("falls back after a few seconds", () => {
    expect(LAUNCH_SYNC_FALLBACK_MS).toBeGreaterThanOrEqual(3000);
    expect(LAUNCH_SYNC_FALLBACK_MS).toBeLessThanOrEqual(10_000);
  });
});
