import { RefreshCw } from "lucide-react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { FormError } from "../../../shared/ui/FormError";
import { ACTION_FAILURE_KEY } from "../logic/failureMessages";
import { isReplanBusy, replanStatusKey, type ReplanState } from "../logic/replan";

interface Props {
  state: ReplanState;
  onPress(): void;
}

/**
 * The staging-only "Replan now" test control. While the new plan is made the button is disabled and a polite
 * status says so. When it arrives, the status says who made it, so a baseline plan is never mistaken for an AI
 * result. A failed request is an alert and the button is usable again. Nothing here asks the Resident to accept
 * anything. The status region is always in the page so a screen reader speaks what is put into it.
 */
export function ReplanButton({ state, onPress }: Props) {
  const { t } = useI18n();
  const statusKey = replanStatusKey(state);
  return (
    <div className="mb-6">
      <Button variant="secondary" fullWidth disabled={isReplanBusy(state)} onClick={onPress}>
        <RefreshCw aria-hidden="true" size={18} className="shrink-0" />
        {t("dayplan.replan.action")}
      </Button>
      <p role="status" className="mt-2 mb-0 text-muted">
        {statusKey && t(statusKey)}
      </p>
      <FormError form="replan">{state.kind === "failed" && t(ACTION_FAILURE_KEY[state.failure])}</FormError>
    </div>
  );
}
