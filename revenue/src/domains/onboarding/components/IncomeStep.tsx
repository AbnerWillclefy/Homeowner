import { Banner, Button } from "@homeowner/bedrock";
import { MoneyInput } from "@homeowner/bedrock/finance";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useIncome } from "../../settings/hooks/useFinanceSettings";
import { readIncome } from "../../settings/logic/income";
import { StepActions, StepHeading } from "./StepFrame";

/** Step 3: Monthly income, with what it turns on. Same check and write as Settings; a failed save keeps what was typed. */
export function IncomeStep({ onBack, onNext, onSkip }: { onBack(): void; onNext(): void; onSkip(): void }) {
  const { t, locale } = useI18n();
  const { income, save } = useIncome();
  const [typed, setTyped] = useState<{ cents: number | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailed(false);
    const read = readIncome(typed ? typed.cents : (income ?? null));
    if ("problem" in read) return setProblem(t(`settings.income.${read.problem}`));
    setProblem(null);
    setSaving(true);
    const ok = await save(read.cents);
    setSaving(false);
    if (ok) onNext();
    else setFailed(true);
  }

  return (
    <>
      <StepHeading title={t("onboarding.income.title")} why={t("onboarding.income.why")} />
      <form id="onboarding-income" onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <MoneyInput label={t("settings.income.field")} hint={t("onboarding.income.hint")} value={typed ? typed.cents : (income ?? null)} onValueChange={(cents) => setTyped({ cents })} error={problem ?? undefined} locale={locale} />
        {failed && <Banner tone="danger">{t("settings.plan.failed")}</Banner>}
      </form>
      <StepActions back={<Button variant="ghost" icon={ChevronLeft} onClick={onBack}>{t("onboarding.back")}</Button>}>
        <Button variant="ghost" onClick={onSkip}>{t("onboarding.skip")}</Button>
        <Button size="lg" type="submit" form="onboarding-income" loading={saving}>{t("onboarding.income.save")}</Button>
      </StepActions>
    </>
  );
}
