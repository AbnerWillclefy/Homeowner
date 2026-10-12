import { createContext, useContext } from "react";
import type { ToastRequest } from "./toastQueue";

export interface Toasts {
  /** Shows a toast. The same message shown twice in a row replaces the first instead of stacking. */
  show(request: ToastRequest): void;
}

export const ToastContext = createContext<Toasts | null>(null);

/** Shows a toast from any screen. Pass catalog keys, not strings, so a language switch re-words it. */
export function useToast(): Toasts {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>");
  return value;
}
