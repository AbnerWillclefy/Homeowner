import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import { useI18n } from "../i18n";
import { LEAVE_FAILURE_KEY } from "./failureMessages";
import { useLeaveHome } from "./useLeaveHome";

interface Props {
  /** The Resident is out of the Home: the screen falls back to the create form. */
  onLeft(): void;
}

/**
 * A "Leave this Home" control that asks first. The dialog says what is removed and what stays, because leaving
 * cannot be undone for the last Resident. Focus starts on Cancel, the safe choice.
 */
export function LeaveHome({ onLeft }: Props) {
  const { t } = useI18n();
  const { state, open, cancel, confirm } = useLeaveHome(onLeft);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const leaving = state.kind === "leaving";

  return (
    <section aria-labelledby="home-leave-heading">
      <h2 id="home-leave-heading">{t("home.leave.heading")}</h2>
      <p>{t("home.leave.intro")}</p>
      <Dialog.Root open={state.kind !== "closed"} onOpenChange={(next) => (next ? open() : cancel())}>
        <Dialog.Trigger className="btn">{t("home.leave.open")}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-text/50" />
          <Dialog.Content
            className="fixed inset-x-4 top-1/2 mx-auto max-h-[90dvh] max-w-[32rem] -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface-raised p-6 text-text"
            onOpenAutoFocus={(event) => {
              // Destructive action: land on Cancel, not on the first button in the DOM.
              event.preventDefault();
              cancelRef.current?.focus();
            }}
          >
            <Dialog.Title>{t("home.leave.title")}</Dialog.Title>
            <Dialog.Description>{t("home.leave.warning")}</Dialog.Description>
            {state.kind === "confirming" && state.failed && (
              <p role="alert" className="text-danger">
                {t(LEAVE_FAILURE_KEY[state.failed])}
              </p>
            )}
            <button ref={cancelRef} type="button" className="btn" disabled={leaving} onClick={cancel}>
              {t("home.leave.cancel")}
            </button>
            <button type="button" className="btn btn-primary" disabled={leaving} onClick={() => void confirm()}>
              {t(leaving ? "home.leave.leaving" : "home.leave.confirm")}
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
