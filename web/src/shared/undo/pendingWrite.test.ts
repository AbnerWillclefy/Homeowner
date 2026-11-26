import { describe, expect, it } from "vitest";
import { idle, pendingWrite, type PendingEffect, type PendingEvent, type PendingState, type Writable } from "./pendingWrite";

const a: Writable = { id: 1 };
const b: Writable = { id: 2 };
const failure = { kind: "failed", messageKey: "x" } as const;

const sends = (effects: PendingEffect<Writable>[]) => effects.filter((e) => e.type === "send");
const step = (state: PendingState<Writable>, event: PendingEvent<Writable>) => pendingWrite(state, event);
const holding = (): PendingState<Writable> => ({ held: a, sending: [] });

describe("pendingWrite", () => {
  it("holds an action started while idle and sends nothing", () => {
    const next = step(idle(), { type: "start", action: a });
    expect(next.state).toEqual(holding());
    expect(next.effects).toHaveLength(0);
  });

  it("sends the held action, then holds the new one, when a second starts", () => {
    const next = step(holding(), { type: "start", action: b });
    expect(next.state).toEqual({ held: b, sending: [a] });
    expect(sends(next.effects)).toEqual([{ type: "send", action: a, keepalive: false }]);
  });

  it("sends the first exactly once across a second start and its later close", () => {
    const second = step(holding(), { type: "start", action: b });
    const closed = step(second.state, { type: "close", id: b.id });
    const again = step(closed.state, { type: "close", id: a.id });
    expect([...second.effects, ...closed.effects, ...again.effects].filter((e) => e.type === "send" && e.action === a)).toHaveLength(1);
  });

  it("drops the write on undo, sending nothing", () => {
    const next = step(holding(), { type: "undo", id: a.id });
    expect(next.state).toEqual(idle());
    expect(next.effects).toHaveLength(0);
  });

  it("sends nothing on the close that follows an undo", () => {
    const undone = step(holding(), { type: "undo", id: a.id });
    const closed = step(undone.state, { type: "close", id: a.id });
    expect(closed.state).toEqual(idle());
    expect(closed.effects).toHaveLength(0);
  });

  it("ignores an undo or close for an id that is not the held one", () => {
    expect(step(holding(), { type: "undo", id: b.id })).toEqual({ state: holding(), effects: [] });
    expect(step(holding(), { type: "close", id: b.id })).toEqual({ state: holding(), effects: [] });
  });

  it.each<[string, PendingEvent<Writable>]>([
    ["close", { type: "close", id: a.id }],
    ["another", { type: "another" }],
    ["navigate", { type: "navigate" }],
    ["signOut", { type: "signOut" }],
  ])("sends the held action on %s", (_name, event) => {
    const next = step(holding(), event);
    expect(next.state).toEqual({ held: null, sending: [a] });
    expect(sends(next.effects)).toEqual([{ type: "send", action: a, keepalive: false }]);
  });

  it("sends with keepalive when the page becomes hidden", () => {
    const next = step(holding(), { type: "hidden" });
    expect(sends(next.effects)).toEqual([{ type: "send", action: a, keepalive: true }]);
  });

  it.each<[string, PendingEvent<Writable>]>([
    ["navigate", { type: "navigate" }],
    ["hidden", { type: "hidden" }],
    ["signOut", { type: "signOut" }],
    ["another", { type: "another" }],
  ])("sends nothing on %s while idle", (_name, event) => {
    expect(step(idle(), event)).toEqual({ state: idle(), effects: [] });
  });

  it("goes idle when a send is answered", () => {
    const next = step({ held: null, sending: [a] }, { type: "sent", id: a.id });
    expect(next.state).toEqual(idle());
    expect(next.effects).toHaveLength(0);
  });

  it("restores and reports a failed send", () => {
    const next = step({ held: null, sending: [a] }, { type: "failed", id: a.id, result: failure });
    expect(next.state).toEqual(idle());
    expect(next.effects).toEqual([{ type: "report", action: a, result: failure }]);
  });

  it("reports a 409 as a conflict outcome and restores", () => {
    const conflict = { kind: "conflict", messageKey: "y" } as const;
    const next = step({ held: b, sending: [a] }, { type: "failed", id: a.id, result: conflict });
    expect(next.state).toEqual({ held: b, sending: [] });
    expect(next.effects).toEqual([{ type: "report", action: a, result: conflict }]);
  });

  it("ignores an answer for an action it does not know", () => {
    expect(step(idle(), { type: "failed", id: 9, result: failure })).toEqual({ state: idle(), effects: [] });
  });
});
