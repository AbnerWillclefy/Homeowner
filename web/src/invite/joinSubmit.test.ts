import { describe, expect, it, vi } from "vitest";
import type { Home } from "../api/home";
import type { AcceptInviteResult } from "../api/invites";
import { createJoiner } from "./joinSubmit";
import type { JoinState } from "./useJoinInvite";

function setup(result: AcceptInviteResult) {
  const accept = vi.fn(() => Promise.resolve(result));
  const states: JoinState[] = [];
  const onFinished = vi.fn();
  const join = createJoiner({ accept, onState: (state) => states.push(state), onFinished });
  return { accept, states, onFinished, join };
}

describe("join an Invite", () => {
  it("sends one request for a double tap in the same tick", async () => {
    const { accept, onFinished, join } = setup({ kind: "ok", home: {} as Home });
    await Promise.all([join(false), join(false)]);
    expect(accept).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledWith("joined");
  });

  it("returns to normal after a failure, keeping the Invite, so the retry sends again", async () => {
    const { accept, states, join } = setup({ kind: "offline" });
    await join(false);
    expect(states.at(-1)).toEqual({ kind: "ready", error: "offline" });
    await join(false);
    expect(accept).toHaveBeenCalledTimes(2);
  });

  it("goes back to the warning when the failure came from a confirmed leave", async () => {
    const { states, join } = setup({ kind: "error" });
    await join(true);
    expect(states.at(-1)).toEqual({ kind: "warn", error: "error" });
  });

  it("asks for the leave confirmation when the API says joining would leave a Home", async () => {
    const { states, join } = setup({ kind: "would-leave" });
    await join(false);
    expect(states.at(-1)).toEqual({ kind: "warn" });
  });

  it("explains a spent Invite", async () => {
    const { states, join } = setup({ kind: "used" });
    await join(false);
    expect(states.at(-1)).toEqual({ kind: "dead", why: "used" });
  });
});
