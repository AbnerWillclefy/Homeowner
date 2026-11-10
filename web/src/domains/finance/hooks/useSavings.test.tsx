// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import type { Savings, WriteResult } from "../api/api";
import { savingsKey } from "../api/queries";

const putGoalOrder = vi.fn<() => Promise<WriteResult>>();
const putReserve = vi.fn<() => Promise<WriteResult>>();
vi.mock("../api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  putGoalOrder: () => putGoalOrder(),
  putReserve: () => putReserve(),
}));

const { useSavings } = await import("./useSavings");

const SAVINGS: Savings = {
  reserveTargetCents: null,
  contributionBaseCents: null,
  reserveSharePercent: null,
  investments: [],
  goals: [
    { id: "a", name: "A", targetCents: 100, targetMonth: null },
    { id: "b", name: "B", targetCents: 200, targetMonth: null },
  ],
};

describe("useSavings", () => {
  let rendered: Rendered | undefined;
  let savings!: ReturnType<typeof useSavings>;
  const order = () => rendered!.client.getQueryData<Savings>(savingsKey)?.goals.map((g) => g.id);
  beforeEach(() => {
    putGoalOrder.mockReset();
    putReserve.mockReset();
    const client = createTestQueryClient();
    client.setQueryData(savingsKey, SAVINGS);
    const Probe = () => {
      savings = useSavings();
      return null;
    };
    rendered = renderWithQueryClient(createElement(Probe), client);
  });
  afterEach(() => rendered?.unmount());

  it("shows the new order before the write answers", async () => {
    let finish!: (r: WriteResult) => void;
    putGoalOrder.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    let pending!: Promise<string>;
    act(() => void (pending = savings.reorder(["b", "a"])));
    expect(order()).toEqual(["b", "a"]);
    await act(async () => {
      finish({ kind: "ok" });
      expect(await pending).toBe("saved");
    });
    expect(order()).toEqual(["b", "a"]);
  });

  it("puts the previous order back when the write fails", async () => {
    putGoalOrder.mockResolvedValue({ kind: "offline" });
    let outcome = "";
    await act(async () => void (outcome = await savings.reorder(["b", "a"])));
    expect(outcome).toBe("failed");
    expect(order()).toEqual(["a", "b"]);
  });

  it("says the list changed on a 400 and reads it again", async () => {
    putGoalOrder.mockResolvedValue({ kind: "invalid" });
    let outcome = "";
    await act(async () => void (outcome = await savings.reorder(["b", "a"])));
    expect(outcome).toBe("changed");
    expect(rendered!.client.getQueryState(savingsKey)?.isInvalidated).toBe(true);
  });

  it("reads the savings again after a setting is saved, and not after a failure", async () => {
    putReserve.mockResolvedValue({ kind: "error" });
    await act(async () => expect(await savings.saveReserve(100)).toBe(false));
    expect(rendered!.client.getQueryState(savingsKey)?.isInvalidated).toBe(false);
    putReserve.mockResolvedValue({ kind: "ok" });
    await act(async () => expect(await savings.saveReserve(100)).toBe(true));
    expect(rendered!.client.getQueryState(savingsKey)?.isInvalidated).toBe(true);
  });
});
