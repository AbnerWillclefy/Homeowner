import * as Toast from "@radix-ui/react-toast";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useMemo, useReducer, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { initialToastQueue, toastDurationMs, toastQueue, type ToastRequest, type ToastTone } from "./toastQueue";
import { ToastContext, type Toasts } from "./useToast";

// Whole class strings, so Tailwind finds them. The icon and the words carry the tone, not the colour alone;
// an error also has a thick edge.
const TONES: Record<ToastTone, string> = {
  success: "border-border",
  error: "border-2 border-danger",
};

/**
 * Mount once, inside I18nProvider and above the router, so a toast survives navigation. Radix's viewport is
 * the single polite live region (toasts are `type="background"`, never assertive); a toast never takes focus.
 * It sits above the bottom nav and the device's bottom inset. Hovering pauses the timer.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [queue, dispatch] = useReducer(toastQueue, initialToastQueue);
  const api = useMemo<Toasts>(() => ({ show: (request: ToastRequest) => dispatch({ type: "add", request }) }), []);

  return (
    <ToastContext.Provider value={api}>
      <Toast.Provider swipeDirection="down">
        {children}
        {queue.toasts.map((toast) => {
          const Icon = toast.tone === "error" ? CircleAlert : CircleCheck;
          return (
            <Toast.Root
              key={toast.id}
              type="background"
              duration={toastDurationMs(toast.tone)}
              onOpenChange={(open) => {
                if (!open) dispatch({ type: "dismiss", id: toast.id });
              }}
              className={`box-border flex items-start gap-3 rounded-card border bg-surface-raised p-4 text-text shadow-lg motion-safe:animate-toast-in ${TONES[toast.tone]}`}
            >
              <Icon aria-hidden="true" size={24} className="mt-0.5 shrink-0" />
              <Toast.Description className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">
                {t(toast.messageKey, toast.params)}
              </Toast.Description>
              <Toast.Close
                aria-label={t("toast.dismiss")}
                className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-pill border-0 bg-transparent text-text"
              >
                <X aria-hidden="true" size={20} />
              </Toast.Close>
            </Toast.Root>
          );
        })}
        <Toast.Viewport
          label={t("toast.region")}
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 m-0 mx-auto flex max-w-[32rem] list-none flex-col gap-2 p-4 outline-none"
        />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
