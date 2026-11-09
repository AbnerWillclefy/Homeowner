import { useRef, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { FormError } from "../../../shared/ui/FormError";
import { FinanceCard } from "./FinanceCard";
import type { ConnectProblem } from "../logic/connectFlow";
import { FINANCE_FAILURE_KEY } from "../logic/failureMessages";

interface Props {
  removing: boolean;
  problem: ConnectProblem | null;
  onReplace(): void;
  /** Removes the credentials and resolves true when they are gone. */
  onRemove(): Promise<boolean>;
  onDismissProblem(): void;
}

/** Says the credentials exist and never what they are. Remove asks first. */
export function SavedCredentials({ removing, problem, onReplace, onRemove, onDismissProblem }: Props) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setConfirming(false);
    onDismissProblem();
  };

  return (
    <FinanceCard id="finances-saved-heading" title={t("finances.saved")} hint={t("finances.saved.hint")}>
      <ButtonRow
        start={
          <AppDialog
            open={confirming}
            onDismiss={close}
            dismissible={!removing}
            trigger={
              <Button variant="danger" onClick={() => setConfirming(true)}>
                {t("finances.saved.remove")}
              </Button>
            }
            initialFocusRef={cancelRef}
            title={t("finances.remove.title")}
            description={<p>{t("finances.remove.body")}</p>}
          >
            <FormError form="finances-remove">{problem && t(FINANCE_FAILURE_KEY[problem])}</FormError>
            <ButtonRow
              className="mt-4"
              stretch
              start={
                <Button ref={cancelRef} variant="secondary" disabled={removing} onClick={close}>
                  {t("finances.remove.cancel")}
                </Button>
              }
              end={
                <Button
                  variant="danger"
                  pending={removing}
                  onClick={() => void onRemove().then((gone) => gone && setConfirming(false))}
                >
                  {t("finances.remove.confirm")}
                </Button>
              }
            />
          </AppDialog>
        }
        end={
          <Button variant="secondary" onClick={onReplace}>
            {t("finances.saved.replace")}
          </Button>
        }
      />
    </FinanceCard>
  );
}
