import { useI18n } from "../../../shared/i18n";
import { formatCents } from "../logic/money";
import { whenText, type When } from "../logic/suggestion";

/** "Neste mês R$ 400,00" on the left and when it is expected on the right; a reached target has no amount to add. */
export function MonthLine({ monthCents, when, who }: { monthCents: number | null; when: When; who: "reserve" | "goal" }) {
  const { t, locale } = useI18n();
  const text = whenText(t, locale, when, who);
  if (monthCents === null || when.kind === "reached") return text && <p className="my-0 text-sm text-muted">{text}</p>;
  return (
    <p className="my-0 flex flex-wrap justify-between gap-x-3 text-sm">
      <span>
        <span className="text-muted">{t("finances.savings.thisMonth")}</span> <strong>{formatCents(monthCents, locale)}</strong>
      </span>
      {text && <span className="text-muted">{text}</span>}
    </p>
  );
}
