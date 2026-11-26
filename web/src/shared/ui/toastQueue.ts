import type { MessageKey } from "../i18n/catalogs/en-US";
import type { Params } from "../i18n/translate";

export type ToastTone = "success" | "error";

/** What a caller asks for: a catalog key, never a string, so a language switch re-words a showing toast. */
export interface ToastRequest {
  messageKey: MessageKey;
  params?: Params;
  tone: ToastTone;
  /** A button on the toast (Desfazer). A toast with one never times out, so it closes only on the action, ✕, Escape or a swipe. */
  action?: { labelKey: MessageKey; altTextKey: MessageKey; onClick: () => void };
  /** Runs when the Resident dismisses the toast (not when it is replaced). The Radix action click also dismisses it, after `action.onClick`. */
  onClose?: () => void;
}

export interface ToastItem extends ToastRequest {
  id: number;
}

export interface ToastQueue {
  toasts: readonly ToastItem[];
}

export type ToastAction = { type: "add"; id: number; request: ToastRequest } | { type: "dismiss"; id: number };

/** Most toasts on screen at once; the oldest goes first. */
export const MAX_TOASTS = 3;

function sameRequest(a: ToastRequest, b: ToastRequest): boolean {
  // One pending write at a time: a new undo toast replaces the old one, whatever its words.
  if (a.action && b.action) return true;
  if (a.action || b.action) return false;
  if (a.messageKey !== b.messageKey || a.tone !== b.tone) return false;
  const left = a.params ?? {};
  const right = b.params ?? {};
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

export const initialToastQueue: ToastQueue = { toasts: [] };

/** The toast queue as a reducer: add (with the caller's id, replacing an identical toast or the other undo toast, capped), dismiss. */
export function toastQueue(state: ToastQueue, action: ToastAction): ToastQueue {
  if (action.type === "dismiss") {
    return { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.id) };
  }
  const kept = state.toasts.filter((toast) => !sameRequest(toast, action.request));
  const next: ToastItem = { ...action.request, id: action.id };
  const all = [...kept, next];
  // Overflow drops the oldest toast, but never the one holding Desfazer: its write would have no toast to undo it.
  while (all.length > MAX_TOASTS) all.splice(Math.max(0, all.findIndex((toast) => !toast.action)), 1);
  return { toasts: all };
}
