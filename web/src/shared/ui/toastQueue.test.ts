import { describe, expect, it } from "vitest";
import {
  initialToastQueue,
  MAX_TOASTS,
  toastQueue,
  type ToastQueue,
  type ToastRequest,
} from "./toastQueue";

const saved: ToastRequest = { messageKey: "app.name", tone: "success" };

function add(state: ToastQueue, request: ToastRequest) {
  return toastQueue(state, { type: "add", request });
}

describe("toastQueue", () => {
  it("adds a toast with its own id", () => {
    const state = add(initialToastQueue, saved);
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0]).toMatchObject(saved);
  });

  it("gives each toast a different id", () => {
    let state = add(initialToastQueue, saved);
    state = add(state, { ...saved, tone: "error" });
    expect(new Set(state.toasts.map((toast) => toast.id)).size).toBe(2);
  });

  it("dismisses one toast by id and ignores an unknown id", () => {
    let state = add(initialToastQueue, saved);
    state = add(state, { ...saved, tone: "error" });
    const [first, second] = state.toasts;
    const after = toastQueue(state, { type: "dismiss", id: first!.id });
    expect(after.toasts).toEqual([second]);
    expect(toastQueue(after, { type: "dismiss", id: 999 })).toEqual(after);
  });

  it("replaces an identical toast instead of stacking it, with a new id so its timer restarts", () => {
    const once = add(initialToastQueue, saved);
    const twice = add(once, { ...saved });
    expect(twice.toasts).toHaveLength(1);
    expect(twice.toasts[0]!.id).not.toBe(once.toasts[0]!.id);
  });

  it("treats a different tone or different params as a different toast", () => {
    let state = add(initialToastQueue, { ...saved, params: { name: "Ana" } });
    state = add(state, { ...saved, params: { name: "Bia" } });
    state = add(state, { ...saved, params: { name: "Bia" }, tone: "error" });
    expect(state.toasts).toHaveLength(3);
  });

  it("keeps at most MAX_TOASTS, dropping the oldest", () => {
    let state = initialToastQueue;
    for (let i = 0; i < MAX_TOASTS + 2; i++) state = add(state, { ...saved, params: { n: i } });
    expect(state.toasts).toHaveLength(MAX_TOASTS);
    expect(state.toasts.at(-1)!.params).toEqual({ n: MAX_TOASTS + 1 });
    expect(state.toasts[0]!.params).toEqual({ n: 2 });
  });
});

describe("toastQueue with an action", () => {
  const undo = (n: number): ToastRequest => ({
    ...saved,
    params: { n },
    action: { labelKey: "undo.action", altTextKey: "undo.altText", onClick: () => {} },
  });

  it("replaces the earlier undo toast, whatever its words, but not a plain one", () => {
    let state = add(initialToastQueue, saved);
    state = add(state, undo(1));
    state = add(state, undo(2));
    expect(state.toasts.map((toast) => toast.params)).toEqual([undefined, { n: 2 }]);
  });

  it("never drops the undo toast when the queue overflows", () => {
    let state = add(initialToastQueue, undo(1));
    for (let i = 0; i < MAX_TOASTS + 1; i++) state = add(state, { ...saved, params: { plain: i } });
    expect(state.toasts).toHaveLength(MAX_TOASTS);
    expect(state.toasts.some((toast) => toast.action)).toBe(true);
  });
});
