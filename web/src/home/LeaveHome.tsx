import * as Dialog from "@radix-ui/react-dialog";
import { LogOut } from "lucide-react";
import { useRef } from "react";
import { DIALOG_CONTENT_CLASS } from "../components/ui/AppDialog";
import { Card } from "../components/ui/Card";
import { PillButton } from "../components/ui/PillButton";
import { useI18n } from "../i18n";
import { LEAVE_FAILURE_KEY } from "./failureMessages";
import { useLeaveHome } from "./useLeaveHome";

interface Props {
  /** The Resident is out of the Home: the screen falls back to the create form. */
  onLeft(): void;
}

/**
 * A "Leave this Home" control that asks first. The dialog says what is removed and what stays, because leaving
 * cannot be undone for the last Resident. Focus starts on Cancel, the safe choice; Radix returns it to the
 * trigger on close.
 */
export function LeaveHome({ onLeft }: Props) {
  const { t } = useI18n();
  const { state, open, cancel, confirm } = useLeaveHome(onLeft);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const leaving = state.kind === "leaving";

  return (
    <Card>
      <section aria-labelledby="home-leave-heading">
        <h2 id="home-leave-heading">{t("home.leave.heading")}</h2>
        <p>{t("home.leave.intro")}</p>
        <Dialog.Root open={state.kind !== "closed"} onOpenChange={(next) => (next ? open() : cancel())}>
          <Dialog.Trigger asChild>
            <PillButton variant="danger">{t("home.leave.open")}</PillButton>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-text/50" />
            <Dialog.Content
              className={DIALOG_CONTENT_CLASS}
              onOpenAutoFocus={(event) => {
                // Destructive action: land on Cancel, not on the first button in the DOM.
                event.preventDefault();
                cancelRef.current?.focus();
              }}
            >
              <Dialog.Title>{t("home.leave.title")}</Dialog.Title>
              <Dialog.Description asChild>
                <div>
                  <p>{t("home.leave.removes")}</p>
                  <p>{t("home.leave.stays")}</p>
                  <p className="font-semibold">{t("home.leave.last")}</p>
                </div>
              </Dialog.Description>
              {state.kind === "confirming" && state.failed && (
                <p role="alert" className="text-danger">
                  {t(LEAVE_FAILURE_KEY[state.failed])}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <PillButton ref={cancelRef} variant="secondary" disabled={leaving} onClick={cancel}>
                  {t("home.leave.cancel")}
                </PillButton>
                <PillButton variant="danger" disabled={leaving} onClick={() => void confirm()}>
                  <LogOut aria-hidden="true" className="size-5 shrink-0" />
                  {t(leaving ? "home.leave.leaving" : "home.leave.confirm")}
                </PillButton>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </section>
    </Card>
  );
}
