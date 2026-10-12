import type { MessageKey } from "../i18n/catalogs/en-US";
import type { Params } from "../i18n/translate";

export type ToastTone = "success" | "error";

/** What a caller asks for: a catalog key, never a string, so a language switch re-words a showing toast. */
export interface ToastRequest {
  messageKey: MessageKey;
  params?: Params;
  tone: ToastTone;
}

export interface ToastItem extends ToastRequest {
  id: number;
}

export interface ToastQueue {
  toasts: readonly ToastItem[];
  nextId: number;
}

export type ToastAction = { type: "add"; request: ToastRequest } | { type: "dismiss"; id: number };

/** Most toasts on screen at once; the oldest goes first. */
export const MAX_TOASTS = 3;

const DURATION_MS: Record<ToastTone, number> = { success: 6000, error: 10000 };

/** How long a toast stays before it dismisses itself. An error stays longer: it is the one to read. */
export function toastDurationMs(tone: ToastTone): number {
  return DURATION_MS[tone];
}

function sameRequest(a: ToastRequest, b: ToastRequest): boolean {
  if (a.messageKey !== b.messageKey || a.tone !== b.tone) return false;
  const left = a.params ?? {};
  const right = b.params ?? {};
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

export const initialToastQueue: ToastQueue = { toasts: [], nextId: 1 };

/** The toast queue as a reducer: add (replacing an identical toast, capped), dismiss. */
export function toastQueue(state: ToastQueue, action: ToastAction): ToastQueue {
  if (action.type === "dismiss") {
    return { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.id) };
  }
  const kept = state.toasts.filter((toast) => !sameRequest(toast, action.request));
  const next: ToastItem = { ...action.request, id: state.nextId };
  return { toasts: [...kept, next].slice(-MAX_TOASTS), nextId: state.nextId + 1 };
}
