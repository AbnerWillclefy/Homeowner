import { formatAmount } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel } from "../logic/month";
import type { When } from "../logic/savings";

/** "Neste mês R$ 400,00" and when it is expected. Plain facts: a Goal behind its date reads like any other, with no countdown or alarm. */
export function MonthLine({ monthCents, when }: { monthCents: number | null; when: When }) {
  const { t, locale } = useI18n();
  const text =
    when.kind === "reached" ? t("goals.reached")
    : when.kind === "beyond" ? t("goals.beyond")
    : when.kind === "expected" ? t("goals.expected", { month: monthLabel(when.month, locale) })
    : null;
  const month = monthCents !== null && when.kind !== "reached" ? t("goals.thisMonth", { amount: formatAmount(monthCents, { locale }) }) : null;
  if (!text && !month) return null;
  return (
    <p className="caption flex flex-wrap justify-between gap-x-3 text-text-muted">
      {month && <span>{month}</span>}
      {text && <span>{text}</span>}
    </p>
  );
}
