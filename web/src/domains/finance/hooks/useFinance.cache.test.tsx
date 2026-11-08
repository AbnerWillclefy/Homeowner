// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import type { FinanceStatus, StatusResult, WriteResult } from "../api/api";
import type { PluggyOptions } from "../logic/pluggyConnect";

const STATUS: FinanceStatus = { configured: true, sources: [], importing: true, lastSyncedAt: null };
const registerItem = vi.fn<() => Promise<StatusResult>>();
const deleteFinanceData = vi.fn<() => Promise<WriteResult>>();
let widget!: PluggyOptions;
vi.mock("../api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getFinanceStatus: () => Promise.resolve({ kind: "ok", status: STATUS }),
  createConnectToken: () => Promise.resolve({ kind: "ok", connectToken: "t", includeSandbox: false }),
  registerItem: () => registerItem(),
  deleteFinanceData: () => deleteFinanceData(),
}));
vi.mock("../logic/pluggyConnect", () => ({
  openPluggyConnect: (options: PluggyOptions) => {
    widget = options;
    return Promise.resolve();
  },
}));

const { useFinance } = await import("./useFinance");

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));

describe("useFinance connect guard", () => {
  let rendered: Rendered | undefined;
  let finance!: ReturnType<typeof useFinance>;
  const Probe = () => {
    finance = useFinance();
    return null;
  };
  beforeEach(async () => {
    registerItem.mockReset();
    deleteFinanceData.mockReset().mockResolvedValue({ kind: "ok" });
    rendered = renderWithQueryClient(createElement(Probe), createTestQueryClient());
    await settle();
  });
  afterEach(() => rendered?.unmount());

  it("holds the guard until the item is registered", async () => {
    let finish!: (result: StatusResult) => void;
    registerItem.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await act(() => finance.connect());
    expect(finance.busy).toBe("connect");

    await act(async () => void widget.onSuccess({ item: { id: "i" } }));
    expect(finance.busy).toBe("connect");
    let deleted = true;
    await act(async () => void (deleted = await finance.deleteAll()));
    expect(deleted).toBe(false);
    expect(deleteFinanceData).not.toHaveBeenCalled();

    await act(async () => finish({ kind: "ok", status: STATUS }));
    expect(finance.busy).toBeNull();
  });

  it("lets a late widget callback leave a newer action's guard alone", async () => {
    registerItem.mockResolvedValue({ kind: "ok", status: STATUS });
    await act(() => finance.connect());
    await act(async () => void widget.onSuccess({ item: { id: "i" } }));
    expect(finance.busy).toBeNull();

    let finish!: (result: WriteResult) => void;
    deleteFinanceData.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    let pending!: Promise<boolean>;
    await act(async () => void (pending = finance.deleteAll()));
    expect(finance.busy).toBe("delete");

    await act(async () => widget.onError(new Error("late")));
    expect(finance.busy).toBe("delete");
    await act(async () => {
      finish({ kind: "ok" });
      await pending;
    });
    expect(finance.busy).toBeNull();
  });
});
