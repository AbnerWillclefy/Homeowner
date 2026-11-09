import { expect, it } from "vitest";
import { applyInOrder, type SendResult } from "./apply";

it("starts the next send only after the previous one resolves, and a failure does not stop the rest", async () => {
  const started: string[] = [];
  const gates: Record<string, (r: SendResult) => void> = {};
  const send = (id: string) => {
    started.push(id);
    return new Promise<SendResult>((resolve) => (gates[id] = resolve));
  };
  const tick = () => new Promise((r) => setTimeout(r));
  const done = applyInOrder(["a", "b", "c"], send);
  await tick();
  expect(started).toEqual(["a"]);
  gates["a"]!({ kind: "failed", reason: "conflict" });
  await tick();
  expect(started).toEqual(["a", "b"]);
  gates["b"]!({ kind: "ok" });
  await tick();
  gates["c"]!({ kind: "ok" });
  expect(await done).toEqual([{ kind: "failed", reason: "conflict" }, { kind: "ok" }, { kind: "ok" }]);
});

it("turns a throw into a failure", async () => {
  expect(await applyInOrder([1], () => Promise.reject(new Error("x")))).toEqual([{ kind: "failed", reason: "error" }]);
});
