import { Badge, Card, CardLabel } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel } from "../../../shared/month/month";
import { useMoney } from "../hooks/useMoney";
import { type ProjectionRow, type Series, seriesCents } from "../logic/projectionRow";

/**
 * The twelve months as a list for a phone: each row is a button with the month, its bills and card bills, and the
 * shown series' Leftover ("Falta" beside a negative one, a dash without a Monthly income). It replaces the table.
 */
export function MonthsList({ rows, from, series, selected, onSelect }: { rows: ProjectionRow[]; from: string; series: Series; selected: string; onSelect: (month: string) => void }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const money = useMoney();

  return (
    <Card variant="compact" role="region" aria-labelledby="projection-months" className="desktop:col-span-12">
      <CardLabel id="projection-months">{t("projection.heading")}</CardLabel>
      <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
        {rows.map((r) => {
          const cents = seriesCents(r, series);
          return (
            <li key={r.month}>
              <button type="button" aria-pressed={r.month === selected} onClick={() => onSelect(r.month)} className={`grid min-h-12 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md py-2 text-left text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${r.month === selected ? "bg-surface-hover" : ""}`}>
                <span className="flex min-w-0 flex-col">
                  <span className="body-strong truncate">{monthLabel(r.month, locale)}{r.month === from && <span className="caption ms-2 font-normal text-text-muted">{t("projection.thisMonth")}</span>}</span>
                  <span className="caption truncate text-text-muted">{t("projection.billsCaption", { amount: money(r.cardsCents + r.billsCents) })}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 whitespace-nowrap">
                  {cents === null ? <><span aria-hidden>—</span><span className="sr-only">{t("projection.none")}</span></> : <Amount cents={cents} size="sm" locale={locale} {...hidden} />}
                  {cents !== null && cents < 0 && <Badge tone="danger">{t("plan.projection.badge")}</Badge>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="caption text-text-muted">{t("projection.footnote")}</p>
    </Card>
  );
}
