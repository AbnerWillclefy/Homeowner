import { ChevronRight, LogOut } from "lucide-react";
import { useRef } from "react";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { List, Row } from "@homeowner/bedrock";
import { RowTile } from "../../../shared/ui/RowTile";
import { useI18n } from "../../../shared/i18n";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { Button } from "../../../shared/ui/Button";
import { LEAVE_FAILURE_KEY } from "../logic/failureMessages";
import { useLeaveHome } from "../hooks/useLeaveHome";

interface Props {
  /** The Resident is out of the Home: the screen falls back to the create form. */
  onLeft(): void;
}

/**
 * The "Leave this Home" Row, which asks first (the one confirm Dialog left on the Home tab). The dialog says what is removed and what stays, because leaving
 * cannot be undone for the last Resident. Focus starts on Cancel, the safe choice; focus returns to the
 * Row on close.
 */
export function LeaveHome({ onLeft }: Props) {
  const { t } = useI18n();
  const { state, open, cancel, confirm } = useLeaveHome(onLeft);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const leaving = state.kind === "leaving";

  return (
    <>
      <List>
        <Row
          asChild
          leading={<RowTile icon={LogOut} tone="danger" />}
          title={t("home.leave.open")}
          caption={t("home.leave.caption")}
          trailing={<ChevronRight size={20} aria-hidden="true" className="text-muted" />}
          className="my-0 [&_.body-strong]:text-danger"
        >
          <button ref={openerRef} type="button" aria-haspopup="dialog" onClick={open} />
        </Row>
      </List>
      <AppDialog
        open={state.kind !== "closed"}
        onDismiss={cancel}
        returnFocusRef={openerRef}
        // Destructive action: land on Cancel, not on the title.
        initialFocusRef={cancelRef}
        title={t("home.leave.title")}
        description={
          <>
            <p>{t("home.leave.removes")}</p>
            <p>{t("home.leave.stays")}</p>
            <p className="font-semibold">{t("home.leave.last")}</p>
          </>
        }
      >
        {state.kind === "confirming" && state.failed && (
          <p role="alert" className="text-danger">
            {t(LEAVE_FAILURE_KEY[state.failed])}
          </p>
        )}
        <ButtonRow
          className="mt-4"
          start={
            <Button ref={cancelRef} variant="secondary" disabled={leaving} onClick={cancel}>
              {t("home.leave.cancel")}
            </Button>
          }
          end={
            <Button
              variant="danger"
              pending={leaving}
              leadingIcon={<LogOut aria-hidden="true" className="size-4" />}
              onClick={() => void confirm()}
            >
              {t("home.leave.confirm")}
            </Button>
          }
        />
      </AppDialog>
    </>
  );
}
