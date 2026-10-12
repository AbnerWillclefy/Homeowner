import { describe, expect, it, vi } from "vitest";
import type { LeaveHomeResult } from "../api/home";
import { createLeaveFlow } from "./leaveFlow";

function setup(result: LeaveHomeResult | Promise<LeaveHomeResult> = { kind: "ok" }) {
  const leave = vi.fn(async () => result);
  const onLeft = vi.fn();
  const flow = createLeaveFlow({ leave, onLeft });
  return { flow, leave, onLeft };
}

describe("createLeaveFlow", () => {
  it("starts closed and sends nothing when the confirmation is only opened", () => {
    const { flow, leave } = setup();
    expect(flow.state()).toEqual({ kind: "closed" });
    flow.open();
    expect(flow.state()).toEqual({ kind: "confirming" });
    expect(leave).not.toHaveBeenCalled();
  });

  it("sends nothing when cancelled, and closes", () => {
    const { flow, leave, onLeft } = setup();
    flow.open();
    flow.cancel();
    expect(flow.state()).toEqual({ kind: "closed" });
    expect(leave).not.toHaveBeenCalled();
    expect(onLeft).not.toHaveBeenCalled();
  });

  it("sends one request on confirm and then reports the Resident has left", async () => {
    const { flow, leave, onLeft } = setup();
    flow.open();
    await flow.confirm();
    expect(leave).toHaveBeenCalledTimes(1);
    expect(onLeft).toHaveBeenCalledTimes(1);
    expect(flow.state()).toEqual({ kind: "closed" });
  });

  it("reports left on none too: a Home that is already gone is the outcome asked for", async () => {
    const { flow, onLeft } = setup({ kind: "none" });
    flow.open();
    await flow.confirm();
    expect(onLeft).toHaveBeenCalledTimes(1);
  });

  it("sends only one request when confirmed twice while the first is in flight", async () => {
    let finish: (r: LeaveHomeResult) => void = () => {};
    const { flow, leave, onLeft } = setup(new Promise<LeaveHomeResult>((resolve) => (finish = resolve)));
    flow.open();
    const first = flow.confirm();
    expect(flow.state()).toEqual({ kind: "leaving" });
    void flow.confirm();
    finish({ kind: "ok" });
    await first;
    expect(leave).toHaveBeenCalledTimes(1);
    expect(onLeft).toHaveBeenCalledTimes(1);
  });

  it("cannot be cancelled while the request is in flight", async () => {
    let finish: (r: LeaveHomeResult) => void = () => {};
    const { flow } = setup(new Promise<LeaveHomeResult>((resolve) => (finish = resolve)));
    flow.open();
    const pending = flow.confirm();
    flow.cancel();
    expect(flow.state()).toEqual({ kind: "leaving" });
    finish({ kind: "ok" });
    await pending;
  });

  it.each(["offline", "error", "not-signed-in"] as const)(
    "keeps the Resident in the Home on %s, with the reason, and allows a retry",
    async (kind) => {
      const { flow, leave, onLeft } = setup({ kind });
      flow.open();
      await flow.confirm();
      expect(onLeft).not.toHaveBeenCalled();
      expect(flow.state()).toEqual({ kind: "confirming", failed: kind });
      await flow.confirm();
      expect(leave).toHaveBeenCalledTimes(2);
    },
  );

  it("clears an earlier failure when closed and opened again", async () => {
    const { flow } = setup({ kind: "error" });
    flow.open();
    await flow.confirm();
    flow.cancel();
    flow.open();
    expect(flow.state()).toEqual({ kind: "confirming" });
  });

  it("does nothing on confirm when the confirmation is not open", async () => {
    const { flow, leave } = setup();
    await flow.confirm();
    expect(leave).not.toHaveBeenCalled();
  });

  it("tells a listener about every state change", async () => {
    const { flow } = setup();
    const seen: string[] = [];
    flow.subscribe(() => seen.push(flow.state().kind));
    flow.open();
    await flow.confirm();
    expect(seen).toEqual(["confirming", "leaving", "closed"]);
  });
});
