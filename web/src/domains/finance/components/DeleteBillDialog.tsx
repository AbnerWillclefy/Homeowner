import { useRef, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { FormError } from "../../../shared/ui/FormError";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import type { Bill } from "../api/api";
import type { BillOutcome } from "../hooks/useBills";

/** Asks before deleting a Bill. Focus starts on Cancel; a failed delete stays open to retry. */
export function DeleteBillDialog({ bill, remove, onClose }: { bill: Bill; remove(id: string): Promise<BillOutcome>; onClose(): void }) {
  const { t } = useI18n();
  const cancel = useRef<HTMLButtonElement>(null);
  const [failed, setFailed] = useState(false);
  const { run, pending } = useSubmitOnce(async () => {
    setFailed(false);
    if ((await remove(bill.id)).kind === "ok") onClose();
    else setFailed(true);
  });
  return (
    <AppDialog
      title={t("finances.bills.delete.title")}
      description={<p className="mb-0 [overflow-wrap:anywhere]">{t("finances.bills.delete.body", { name: bill.name })}</p>}
      initialFocusRef={cancel}
      dismissible={!pending}
      onDismiss={onClose}
      footer={
        <ButtonRow
          stretch
          start={
            <Button ref={cancel} variant="secondary" disabled={pending} onClick={onClose}>
              {t("finances.bills.form.cancel")}
            </Button>
          }
          end={
            <Button variant="danger" pending={pending} onClick={() => void run()}>
              {t("finances.bills.delete")}
            </Button>
          }
        />
      }
    >
      <FormError form="finances-bill-delete">{failed && t("finances.bills.failed")}</FormError>
    </AppDialog>
  );
}
