import { useRef, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { FormError } from "../../../shared/ui/FormError";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";

/** Asks before deleting an Investment or a Goal. Focus starts on Cancel; a failed delete stays open to retry. */
export function DeleteSavingsDialog({
  title,
  body,
  action,
  remove,
  onClose,
}: {
  title: string;
  body: string;
  /** The button's words, for example "Delete Goal". */
  action: string;
  remove(): Promise<boolean>;
  onClose(): void;
}) {
  const { t } = useI18n();
  const cancel = useRef<HTMLButtonElement>(null);
  const [failed, setFailed] = useState(false);
  const { run, pending } = useSubmitOnce(async () => {
    setFailed(false);
    if (await remove()) onClose();
    else setFailed(true);
  });
  return (
    <AppDialog
      title={title}
      description={<p className="mb-0 [overflow-wrap:anywhere]">{body}</p>}
      initialFocusRef={cancel}
      dismissible={!pending}
      onDismiss={onClose}
      footer={
        <ButtonRow
          stretch
          start={
            <Button ref={cancel} variant="secondary" disabled={pending} onClick={onClose}>
              {t("finances.savings.cancel")}
            </Button>
          }
          end={
            <Button variant="danger" pending={pending} onClick={() => void run()}>
              {action}
            </Button>
          }
        />
      }
    >
      <FormError form="finances-savings-delete">{failed && t("finances.savings.deleteFailed")}</FormError>
    </AppDialog>
  );
}
