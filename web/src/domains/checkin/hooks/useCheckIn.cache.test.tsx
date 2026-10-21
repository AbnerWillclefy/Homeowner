// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import type { CheckIn, CheckInResult, SaveCheckInResult } from "../api/api";

const getCheckIn = vi.fn<() => Promise<CheckInResult>>();
const putCheckIn = vi.fn<() => Promise<SaveCheckInResult>>();
vi.mock("../api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCheckIn: () => getCheckIn(),
  putCheckIn: () => putCheckIn(),
}));
vi.mock("../../profile/api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getDemands: () => Promise.resolve({ kind: "ok", ids: ["lifting"] }),
}));

const { checkInKey } = await import("../api/queries");
const { useCheckIn } = await import("./useCheckIn");

const BEFORE: CheckIn = { date: "2026-10-21", checkedIn: false, level: null, restrictions: [] };
const SAVED: CheckIn = { date: "2026-10-21", checkedIn: true, level: "low", restrictions: ["lifting"] };

/** Lets the query client's batched notifications (a zero-delay timer) reach React. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));

describe("useCheckIn save over the query cache", () => {
  let rendered: Rendered | undefined;
  let checkIn!: ReturnType<typeof useCheckIn>;
  const onSaved = vi.fn();
  const Probe = () => {
    checkIn = useCheckIn(onSaved);
    return null;
  };
  const mount = async () => {
    const client = createTestQueryClient();
    rendered = renderWithQueryClient(createElement(Probe), client);
    await settle();
    return client;
  };
  beforeEach(() => {
    getCheckIn.mockReset().mockResolvedValue({ kind: "ok", checkIn: BEFORE });
    putCheckIn.mockReset();
    onSaved.mockReset();
  });
  afterEach(() => rendered?.unmount());

  it("writes the saved Check-in to the cache, does not read it again, and calls onSaved once", async () => {
    putCheckIn.mockResolvedValue({ kind: "ok", checkIn: SAVED });
    const client = await mount();
    expect(getCheckIn).toHaveBeenCalledTimes(1);
    let outcome: unknown;
    await act(async () => {
      outcome = await checkIn.save("low", ["lifting"]);
    });
    await settle();
    expect(outcome).toBeNull();
    expect(client.getQueryData(checkInKey)).toEqual(SAVED);
    expect(getCheckIn).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("leaves the cache untouched and skips onSaved when the save fails", async () => {
    putCheckIn.mockResolvedValue({ kind: "offline" });
    const client = await mount();
    let outcome: unknown;
    await act(async () => {
      outcome = await checkIn.save("low", []);
    });
    expect(outcome).toBe("offline");
    expect(client.getQueryData(checkInKey)).toEqual(BEFORE);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
