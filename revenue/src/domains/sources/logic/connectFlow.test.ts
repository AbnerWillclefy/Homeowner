import { describe, expect, it, vi } from "vitest";
import type { SourcesStatus } from "../api";
import { connectBanks } from "./connectFlow";
import { FAILURE_KEY } from "./failureMessages";
import type { PluggyOptions } from "./pluggyConnect";

const STATUS: SourcesStatus = { sources: [], importing: true, lastSyncedAt: null };

function setup(over: { token?: Awaited<ReturnType<Parameters<typeof connectBanks>[0]["createToken"]>>; open?: (o: PluggyOptions) => Promise<void>; register?: Parameters<typeof connectBanks>[0]["register"] } = {}) {
  let options!: PluggyOptions;
  const outcome = { connected: vi.fn(), closed: vi.fn(), problem: vi.fn() };
  const register = vi.fn(over.register ?? (async () => ({ kind: "ok" as const, status: STATUS })));
  const run = connectBanks(
    {
      createToken: async () => over.token ?? { kind: "ok", connectToken: "tok", includeSandbox: true },
      open: over.open ?? (async (o) => void (options = o)),
      register,
    },
    outcome,
  );
  return { run, outcome, register, options: () => options };
}

describe("connectBanks", () => {
  it("opens the widget with the token and registers the Item on success, handing back the new status", async () => {
    const t = setup();
    await t.run;
    expect(t.options()).toMatchObject({ connectToken: "tok", includeSandbox: true });
    await t.options().onSuccess({ item: { id: "item-1" } });
    expect(t.register).toHaveBeenCalledWith("item-1");
    expect(t.outcome.connected).toHaveBeenCalledWith(STATUS);
    t.options().onClose();
    expect(t.outcome.closed).not.toHaveBeenCalled();
  });

  it("calls a close with nothing connected 'closed', not a problem", async () => {
    const t = setup();
    await t.run;
    t.options().onClose();
    expect(t.outcome.closed).toHaveBeenCalled();
    expect(t.outcome.problem).not.toHaveBeenCalled();
  });

  it.each(["no-credentials", "rejected", "unavailable", "offline", "error"] as const)("stops at a %s token without opening the widget", async (kind) => {
    const open = vi.fn();
    const t = setup({ token: { kind }, open });
    await t.run;
    expect(t.outcome.problem).toHaveBeenCalledWith(kind);
    expect(open).not.toHaveBeenCalled();
  });

  it("reports a refused Item", async () => {
    const t = setup({ register: async () => ({ kind: "item-refused" }) });
    await t.run;
    await t.options().onSuccess({ item: { id: "i" } });
    expect(t.outcome.problem).toHaveBeenCalledWith("item-refused");
    expect(t.outcome.connected).not.toHaveBeenCalled();
  });

  it("reports the widget failing to load or erroring", async () => {
    const failing = setup({ open: async () => Promise.reject(new Error("no script")) });
    await failing.run;
    expect(failing.outcome.problem).toHaveBeenCalledWith("widget");
    const erroring = setup();
    await erroring.run;
    erroring.options().onError({});
    expect(erroring.outcome.problem).toHaveBeenCalledWith("widget");
  });
});

describe("FAILURE_KEY", () => {
  it("has a message for every problem", () => {
    expect(Object.keys(FAILURE_KEY).sort()).toEqual(["error", "item-refused", "no-credentials", "not-signed-in", "offline", "rejected", "unavailable", "widget"]);
  });
});
