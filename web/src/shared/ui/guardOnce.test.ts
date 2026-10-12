import { describe, expect, it, vi } from "vitest";
import { guardOnce } from "./guardOnce";

describe("guardOnce", () => {
  it("ignores a second call while one is in flight", async () => {
    let release!: () => void;
    const action = vi.fn(() => new Promise<string>((resolve) => (release = () => resolve("done"))));
    const run = guardOnce(action);

    const first = run();
    const second = await run();
    release();

    expect(second).toBeUndefined();
    expect(await first).toBe("done");
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("runs again after the call resolves", async () => {
    const action = vi.fn(async (n: number) => n);
    const run = guardOnce(action);

    expect(await run(1)).toBe(1);
    expect(await run(2)).toBe(2);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("runs again after a rejection, and the rejection reaches the caller", async () => {
    const action = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    const run = guardOnce(action);

    await expect(run()).rejects.toThrow("boom");
    expect(await run()).toBe("ok");
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("reports in-flight changes", async () => {
    const changes: boolean[] = [];
    await guardOnce(async () => 1, (v) => changes.push(v))();
    expect(changes).toEqual([true, false]);
  });
});
