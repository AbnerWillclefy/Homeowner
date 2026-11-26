import { createElement, type ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { ToastContext } from "../ui/useToast";
import type { ToastRequest } from "../ui/toastQueue";
import { UndoProvider } from "./UndoProvider";

/** A toast the test can read: what was asked for, and whether it was dismissed or closed by the Resident. */
export interface ShownToast {
  id: number;
  request: ToastRequest;
  dismissed: boolean;
}

/**
 * An `UndoProvider` over a recording toast, for tests of code that holds undoable writes. `toasts` lists every
 * toast shown; `undo(i)` is a tap on its Desfazer; `close(i)` is the Resident closing it (which sends the write).
 */
export function undoHarness() {
  const toasts: ShownToast[] = [];
  const toast = {
    show(request: ToastRequest) {
      toasts.push({ id: toasts.length + 1, request, dismissed: false });
      return toasts.length;
    },
    dismiss(id: number) {
      const shown = toasts.find((t) => t.id === id);
      if (shown) shown.dismissed = true;
    },
  };
  return {
    toasts,
    undo: (index: number) => toasts[index]!.request.action!.onClick(),
    close: (index: number) => toasts[index]!.request.onClose?.(),
    wrap: (child: ReactElement) =>
      createElement(MemoryRouter, null, createElement(ToastContext.Provider, { value: toast }, createElement(UndoProvider, null, child))),
  };
}
