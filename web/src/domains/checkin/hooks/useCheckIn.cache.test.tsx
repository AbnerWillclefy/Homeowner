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
const { dayPlanKey } = await import("../../dayplan/api/queries");
const { useCheckIn } = await import("./useCheckIn");

const BEFORE: CheckIn = { date: "2026-10-21", checkedIn: false, level: null, restrictions: [] };
const SAVED: CheckIn = { date: "2026-10-21", checkedIn: true, level: "low", restrictions: ["lifting"] };

/** Lets the query client's batched notifications (a zero-delay timer) reach React. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));

describe("useCheckIn save over the query cache", () => {
  let rendered: Rendered | undefined;
  let checkIn!: ReturnType<typeof useCheckIn>;
  let hasHome = true;
  const Probe = () => {
    checkIn = useCheckIn(hasHome);
    return null;
  };
  const mount = async () => {
    const client = createTestQueryClient();
    rendered = renderWithQueryClient(createElement(Probe), client);
    await settle();
    return client;
  };
  beforeEach(() => {
    hasHome = true;
    getCheckIn.mockReset().mockResolvedValue({ kind: "ok", checkIn: BEFORE });
    putCheckIn.mockReset();
  });
  afterEach(() => rendered?.unmount());

  it("sends no request without a Home, and reads once the Home is there", async () => {
    hasHome = false;
    const client = await mount();
    expect(getCheckIn).not.toHaveBeenCalled();
    expect(checkIn.state).toEqual({ kind: "loading" });
    hasHome = true;
    rendered!.rerender(createElement(Probe));
    await settle();
    expect(getCheckIn).toHaveBeenCalledTimes(1);
    expect(checkIn.state.kind).toBe("ready");
    expect(client.getQueryData(checkInKey)).toEqual(BEFORE);
  });

  it("writes the saved Check-in to the cache, does not read it again, and invalidates the Day Plan", async () => {
    putCheckIn.mockResolvedValue({ kind: "ok", checkIn: SAVED });
    const client = await mount();
    client.setQueryData(dayPlanKey, null);
    expect(getCheckIn).toHaveBeenCalledTimes(1);
    let outcome: unknown;
    await act(async () => {
      outcome = await checkIn.save("low", ["lifting"]);
    });
    await settle();
    expect(outcome).toBeNull();
    expect(client.getQueryData(checkInKey)).toEqual(SAVED);
    expect(getCheckIn).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(dayPlanKey)?.isInvalidated).toBe(true);
  });

  it("leaves the cache untouched and keeps the Day Plan valid when the save fails", async () => {
    putCheckIn.mockResolvedValue({ kind: "offline" });
    const client = await mount();
    client.setQueryData(dayPlanKey, null);
    let outcome: unknown;
    await act(async () => {
      outcome = await checkIn.save("low", []);
    });
    expect(outcome).toBe("offline");
    expect(client.getQueryData(checkInKey)).toEqual(BEFORE);
    expect(client.getQueryState(dayPlanKey)?.isInvalidated).toBe(false);
  });
});
