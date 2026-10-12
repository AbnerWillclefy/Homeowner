import { describe, expect, it } from "vitest";
import { createSubmitGuard } from "./submitGuard";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("createSubmitGuard", () => {
  it("ignores a second call while the first is in flight", async () => {
    const gate = deferred<string>();
    let calls = 0;
    const guard = createSubmitGuard(() => {
      calls++;
      return gate.promise;
    });
    const first = guard.run();
    const second = await guard.run();
    expect(second).toBeUndefined();
    expect(calls).toBe(1);
    gate.resolve("saved");
    expect(await first).toBe("saved");
  });

  it("runs the action once for a burst of synchronous calls, like a repeated Enter", () => {
    let calls = 0;
    const guard = createSubmitGuard(async () => {
      calls++;
    });
    for (let i = 0; i < 5; i++) void guard.run();
    expect(calls).toBe(1);
  });

  it("runs again after the first call settles", async () => {
    let calls = 0;
    const guard = createSubmitGuard(async () => ++calls);
    await guard.run();
    await guard.run();
    expect(calls).toBe(2);
  });

  it("returns to normal after the action rejects, and passes the rejection on", async () => {
    let calls = 0;
    const guard = createSubmitGuard(async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
    });
    await expect(guard.run()).rejects.toThrow("offline");
    expect(guard.isPending()).toBe(false);
    await guard.run();
    expect(calls).toBe(2);
  });

  it("tells its listener when it starts and stops being pending", async () => {
    const gate = deferred();
    const seen: boolean[] = [];
    const guard = createSubmitGuard(
      () => gate.promise,
      (pending) => seen.push(pending),
    );
    const running = guard.run();
    expect(guard.isPending()).toBe(true);
    gate.resolve();
    await running;
    expect(seen).toEqual([true, false]);
  });

  it("recovers from an action that throws synchronously", async () => {
    let calls = 0;
    const guard = createSubmitGuard(() => {
      calls++;
      throw new Error("boom");
    });
    await expect(guard.run()).rejects.toThrow("boom");
    expect(guard.isPending()).toBe(false);
    await expect(guard.run()).rejects.toThrow("boom");
    expect(calls).toBe(2);
  });
});
