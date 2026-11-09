// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import type { MonthResponse, WriteResult } from "../api/api";
import { monthKey } from "../api/queries";

const putBudget = vi.fn<() => Promise<WriteResult>>();
vi.mock("../api/api", async (importOriginal) => ({ ...(await importOriginal<object>()), putBudget: () => putBudget() }));

const { useBudget } = await import("./useBudget");

const MONTH: MonthResponse = { month: "2026-12", spentCents: 0, categories: [], transactions: [], limits: { groceries: 80000 } };

describe("useBudget", () => {
  let rendered: Rendered | undefined;
  let setLimit!: ReturnType<typeof useBudget>;
  const limits = () => rendered!.client.getQueryData<MonthResponse>(monthKey("2026-12"))?.limits;
  beforeEach(() => {
    putBudget.mockReset();
    const client = createTestQueryClient();
    client.setQueryData(monthKey("2026-12"), MONTH);
    const Probe = () => {
      setLimit = useBudget("2026-12");
      return null;
    };
    rendered = renderWithQueryClient(createElement(Probe), client);
  });
  afterEach(() => rendered?.unmount());

  it("shows the new limit before the write answers", async () => {
    let finish!: (r: WriteResult) => void;
    putBudget.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    let pending!: Promise<string>;
    act(() => void (pending = setLimit("leisure", 5000)));
    expect(limits()).toEqual({ groceries: 80000, leisure: 5000 });
    await act(async () => {
      finish({ kind: "ok" });
      expect(await pending).toBe("saved");
    });
    expect(limits()).toEqual({ groceries: 80000, leisure: 5000 });
  });

  it("removes a limit at once", async () => {
    putBudget.mockResolvedValue({ kind: "ok" });
    await act(() => setLimit("groceries", null));
    expect(limits()).toEqual({});
  });

  it("puts the previous limit back when the write fails", async () => {
    putBudget.mockResolvedValue({ kind: "error" });
    let outcome = "";
    await act(async () => void (outcome = await setLimit("groceries", 99900)));
    expect(outcome).toBe("failed");
    expect(limits()).toEqual({ groceries: 80000 });
  });

  it("takes a failed new limit away again", async () => {
    putBudget.mockResolvedValue({ kind: "offline" });
    await act(() => setLimit("leisure", 5000));
    expect(limits()).toEqual({ groceries: 80000 });
  });
});
