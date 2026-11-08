import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { FormError } from "../../../shared/ui/FormError";
import { SectionCard } from "../../../shared/ui/SectionCard";
import type { ConnectProblem } from "../logic/connectFlow";
import { FINANCE_FAILURE_KEY } from "../logic/failureMessages";

interface Props {
  deleting: boolean;
  problem: ConnectProblem | null;
  /** Deletes everything and resolves true when it is gone. */
  onDelete(): Promise<boolean>;
  onDismissProblem(): void;
}

/** "Delete my finance data", confirmed in a short stacked dialog: the danger action last and full width, Cancel above it. */
export function DeleteFinanceData({ deleting, problem, onDelete, onDismissProblem }: Props) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setConfirming(false);
    onDismissProblem();
  };

  return (
    <SectionCard id="finances-delete-heading" icon={Trash2} tone="danger" title={t("finances.delete.heading")} hint={t("finances.delete.hint")}>
      <ButtonRow
        start={
          <AppDialog
            open={confirming}
            onDismiss={close}
            dismissible={!deleting}
            trigger={
              <Button variant="danger" onClick={() => setConfirming(true)}>
                {t("finances.delete.open")}
              </Button>
            }
            initialFocusRef={cancelRef}
            title={t("finances.delete.title")}
            description={<p>{t("finances.delete.body")}</p>}
          >
            <FormError form="finances-delete">{problem && t(FINANCE_FAILURE_KEY[problem])}</FormError>
            <ButtonRow
              className="mt-4"
              stretch
              start={
                <Button ref={cancelRef} variant="secondary" disabled={deleting} onClick={close}>
                  {t("finances.delete.cancel")}
                </Button>
              }
              end={
                <Button
                  variant="danger"
                  pending={deleting}
                  onClick={() => void onDelete().then((gone) => gone && setConfirming(false))}
                >
                  {t("finances.delete.confirm")}
                </Button>
              }
            />
          </AppDialog>
        }
      />
    </SectionCard>
  );
}
