import { Card } from "@homeowner/bedrock";
import { useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Spending } from "../../categories/api";
import { SpendingDonut } from "../../categories/components/SpendingDonut";
import { categoryRows } from "../../categories/logic/rows";
import { monthName } from "../logic/month";
import { CardHead } from "./CardHead";

/** The month's spending by Category, drawn by the Categories screen's donut. */
export function SpendingCard({ spending, month }: { spending: Spending; month: string }) {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const rows = categoryRows(spending);
  return (
    <Card>
      <CardHead label={t("overview.spending.heading", { month: monthName(month, locale).toLocaleLowerCase(locale) })} to="/categories" name={t("nav.categories")} />
      {rows.some((r) => r.spentCents > 0) ? (
        // Bedrock's donut prints its total in the centre as text, which the toggle cannot reach: hide that one `.label`.
        <div className={hidden ? "pointer-events-none [&_.absolute>.label]:invisible" : undefined}>
          <SpendingDonut rows={rows} />
        </div>
      ) : (
        <p className="text-text-muted">{t("overview.pace.empty")}</p>
      )}
    </Card>
  );
}
