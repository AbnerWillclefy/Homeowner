import { Button } from "@homeowner/bedrock";
import { Check, ChevronLeft } from "lucide-react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useSources } from "../../sources/hooks/useSources";
import { StepActions } from "./StepFrame";

/** Step 4: what was set up, what the first import does, and where to do the rest later. Finishing is the only way out that writes the flag. */
export function DoneStep({ onBack, onFinish }: { onBack(): void; onFinish(): void }) {
  const { t } = useI18n();
  const { data } = useSources();
  const banks = data?.items.length ?? 0;

  return (
    <>
      <div className="flex flex-col items-center gap-4 pt-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-positive-soft text-positive">
          <Check className="size-6" aria-hidden />
        </span>
        <h1 data-step-heading tabIndex={-1} className="page-title outline-none">{t("onboarding.done.title")}</h1>
        <p className="body">{banks > 0 ? t(banks === 1 ? "onboarding.done.banks.one" : "onboarding.done.banks.other", { n: banks }) : t("onboarding.done.noBanks")}</p>
        {banks > 0 && <p role="status" className="body text-text-muted">{t("onboarding.done.importing")}</p>}
        <p className="body text-text-muted">{t("onboarding.done.later")}</p>
      </div>
      <StepActions back={<Button variant="ghost" icon={ChevronLeft} onClick={onBack}>{t("onboarding.back")}</Button>}>
        <Button size="lg" onClick={onFinish}>{t("onboarding.done.go")}</Button>
      </StepActions>
    </>
  );
}
