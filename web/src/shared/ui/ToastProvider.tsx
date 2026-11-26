import { Toast, ToastProvider as BedrockToastProvider } from "@homeowner/bedrock";
import { useMemo, useReducer, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { initialToastQueue, toastQueue, type ToastRequest, type ToastTone } from "./toastQueue";
import { ToastContext, type Toasts } from "./useToast";

const TONES = { success: "positive", error: "danger" } as const satisfies Record<ToastTone, string>;

/**
 * Mount once, inside I18nProvider and above the router, so a toast survives navigation. It renders Bedrock's
 * `ToastProvider` and `Toast` (ADR 0022): one viewport, at the bottom above the BottomBar. A success toast
 * closes after Bedrock's timer; one with an action (Desfazer) never times out and closes on the action, the
 * close button, Escape or a swipe.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [queue, dispatch] = useReducer(toastQueue, initialToastQueue);
  const api = useMemo<Toasts>(() => ({ show: (request: ToastRequest) => dispatch({ type: "add", request }) }), []);

  return (
    <ToastContext.Provider value={api}>
      <BedrockToastProvider label={t("toast.region")}>
        {children}
        {queue.toasts.map((toast) => (
          <Toast
            key={toast.id}
            open
            onOpenChange={(open) => {
              if (open) return;
              dispatch({ type: "dismiss", id: toast.id });
              toast.onClose?.();
            }}
            tone={TONES[toast.tone]}
            title={t(toast.messageKey, toast.params)}
            closeLabel={t("toast.dismiss")}
            action={
              toast.action && {
                label: t(toast.action.labelKey),
                altText: t(toast.action.altTextKey),
                onClick: toast.action.onClick,
              }
            }
          />
        ))}
      </BedrockToastProvider>
    </ToastContext.Provider>
  );
}
