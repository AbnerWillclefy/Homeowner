import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";

/** The Residents card when the list failed to load: an inline message with Retry. */
export function ResidentsError({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-start gap-3 py-3">
      <p role="alert" className="my-0 text-danger">
        {t("home.residents.error")}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        {t("home.retry")}
      </Button>
    </div>
  );
}
