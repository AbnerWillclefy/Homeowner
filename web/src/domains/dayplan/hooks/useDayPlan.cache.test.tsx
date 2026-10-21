// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import { dayPlan } from "../testing/fixtures";
import type { DayPlanResult } from "../api/api";

const getDayPlan = vi.fn<() => Promise<DayPlanResult>>();
vi.mock("../api/api", async (importOriginal) => ({ ...(await importOriginal<object>()), getDayPlan: () => getDayPlan() }));

const { dayPlanKey } = await import("../api/queries");
const { useDayPlan } = await import("./useDayPlan");

const CACHED = dayPlan({ energy: 3 });
const FRESH = dayPlan({ energy: 8 });

/** Lets the query client's batched notifications (a zero-delay timer) reach React. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));

describe("useDayPlan over the query cache", () => {
  let rendered: Rendered | undefined;
  let day!: ReturnType<typeof useDayPlan>;
  let setVersion!: (version: number) => void;
  const Probe = () => {
    const [version, set] = useState(0);
    setVersion = set;
    day = useDayPlan(version);
    return null;
  };
  const mount = () => {
    const client = createTestQueryClient();
    client.setQueryData(dayPlanKey, CACHED);
    rendered = renderWithQueryClient(createElement(Probe), client);
    return client;
  };
  beforeEach(() => {
    getDayPlan.mockReset();
  });
  afterEach(() => rendered?.unmount());

  it("shows the cached plan at once, with no loading state, while a refetch runs behind it", async () => {
    let answer!: (result: DayPlanResult) => void;
    getDayPlan.mockImplementation(() => new Promise<DayPlanResult>((resolve) => (answer = resolve)));
    mount();
    expect(day.state).toEqual({ kind: "ready", plan: CACHED });
    expect(day.refreshing).toBe(true);
    answer({ kind: "ok", plan: FRESH });
    await settle();
    expect(day.state).toEqual({ kind: "ready", plan: FRESH });
    expect(day.refreshing).toBe(false);
  });

  it("keeps the cached plan, with no alert state, when the refetch fails", async () => {
    getDayPlan.mockResolvedValue({ kind: "offline" });
    mount();
    await settle();
    expect(day.state).toEqual({ kind: "ready", plan: CACHED });
    expect(day.refreshing).toBe(false);
  });

  it("reads again when `version` changes, and not on the first render", async () => {
    getDayPlan.mockResolvedValue({ kind: "ok", plan: CACHED });
    const client = mount();
    await settle();
    expect(getDayPlan).toHaveBeenCalledTimes(1);
    getDayPlan.mockResolvedValue({ kind: "ok", plan: FRESH });
    act(() => setVersion(1));
    await settle();
    expect(getDayPlan).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(dayPlanKey)).toEqual(FRESH);
  });
});
