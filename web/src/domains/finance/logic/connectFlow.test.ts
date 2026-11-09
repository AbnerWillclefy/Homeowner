import { describe, expect, it, vi } from "vitest";
import type { FinanceStatus } from "../api/api";
import { connectBanks } from "./connectFlow";
import type { PluggyOptions } from "./pluggyConnect";

const STATUS: FinanceStatus = { configured: true, sources: [], importing: true, lastSyncedAt: null };

function setup(overrides: Partial<Parameters<typeof connectBanks>[0]> = {}) {
  let widget!: PluggyOptions;
  const deps = {
    createToken: vi.fn(async () => ({ kind: "ok", connectToken: "tok", includeSandbox: true }) as const),
    open: vi.fn(async (options: PluggyOptions) => void (widget = options)),
    register: vi.fn(async () => ({ kind: "ok", status: STATUS }) as const),
    ...overrides,
  };
  const outcome = { connected: vi.fn(), closed: vi.fn(), problem: vi.fn() };
  return { deps, outcome, widget: () => widget };
}

describe("connectBanks", () => {
  it("fetches a token, opens the widget with it, and registers the item on success", async () => {
    const s = setup();
    await connectBanks(s.deps, s.outcome);
    expect(s.deps.open).toHaveBeenCalledWith(expect.objectContaining({ connectToken: "tok", includeSandbox: true }));
    await s.widget().onSuccess({ item: { id: "item-9" } });
    expect(s.deps.register).toHaveBeenCalledWith("item-9");
    expect(s.outcome.connected).toHaveBeenCalledWith(STATUS);
  });

  it("does not open the widget when the token fails", async () => {
    const s = setup({ createToken: vi.fn(async () => ({ kind: "rejected" }) as const) });
    await connectBanks(s.deps, s.outcome);
    expect(s.deps.open).not.toHaveBeenCalled();
    expect(s.outcome.problem).toHaveBeenCalledWith("rejected");
  });

  it("reports a widget problem when the script cannot load", async () => {
    const s = setup({ open: vi.fn(async () => Promise.reject(new Error("no script"))) });
    await connectBanks(s.deps, s.outcome);
    expect(s.outcome.problem).toHaveBeenCalledWith("widget");
  });

  it("reports closed when the widget closes without success", async () => {
    const s = setup();
    await connectBanks(s.deps, s.outcome);
    s.widget().onClose();
    expect(s.outcome.closed).toHaveBeenCalledTimes(1);
    expect(s.outcome.problem).not.toHaveBeenCalled();
  });

  it("reports a widget problem on a widget error", async () => {
    const s = setup();
    await connectBanks(s.deps, s.outcome);
    s.widget().onError({ message: "x" });
    expect(s.outcome.problem).toHaveBeenCalledWith("widget");
  });

  it("does not report closed for the close that follows a success", async () => {
    const s = setup();
    await connectBanks(s.deps, s.outcome);
    await s.widget().onSuccess({ item: { id: "item-9" } });
    s.widget().onClose();
    expect(s.outcome.closed).not.toHaveBeenCalled();
  });

  it("reports the failure when registering the item fails", async () => {
    const s = setup({ register: vi.fn(async () => ({ kind: "item-refused" }) as const) });
    await connectBanks(s.deps, s.outcome);
    await s.widget().onSuccess({ item: { id: "item-9" } });
    expect(s.outcome.problem).toHaveBeenCalledWith("item-refused");
    expect(s.outcome.connected).not.toHaveBeenCalled();
  });
});
