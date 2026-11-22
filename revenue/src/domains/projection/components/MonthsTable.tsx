import { Card, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel } from "../../../shared/month/month";
import type { ProjectionRow } from "../logic/projectionRow";

/**
 * One row per month, six columns, for a desktop width: the month, the bills and card bills together, Planned spending,
 * Put aside and the two Leftovers (a dash without a Monthly income). Six columns fit from 1024px; the box still
 * scrolls sideways at the largest text size (Bedrock's `Table` wraps it in `overflow-x-auto`). The month cell holds a
 * button stretched over the row: it is how the keyboard and screen readers choose the month shown in the detail card.
 */
export function MonthsTable({ rows, from, selected, onSelect }: { rows: ProjectionRow[]; from: string; selected: string; onSelect: (month: string) => void }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const cell = (cents: number | null | undefined) => (
    <TableCell align="end">
      {cents == null ? <><span aria-hidden>—</span><span className="sr-only">{t("projection.none")}</span></> : <Amount cents={cents} size="sm" locale={locale} {...hidden} />}
    </TableCell>
  );

  return (
    <Card className="min-w-0 gap-3 desktop:col-span-12">
      <Table>
        <TableCaption>{t("projection.heading")}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t("month.select")}</TableHead>
            <TableHead align="end">{t("projection.colBills")}</TableHead>
            <TableHead align="end">{t("overview.group.planned")}</TableHead>
            <TableHead align="end">{t("overview.group.saving")}</TableHead>
            <TableHead align="end">{t("projection.leftoverPlan")}</TableHead>
            <TableHead align="end">{t("projection.colPace")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.month} className={r.month === selected ? "bg-surface-hover" : undefined}>
              <TableHead scope="row" className="text-text">
                <button type="button" aria-pressed={r.month === selected} onClick={() => onSelect(r.month)} className="min-h-11 text-left outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus">
                  {monthLabel(r.month, locale)}
                  {r.month === from && <span className="caption block normal-case text-text-muted">{t("projection.thisMonth")}</span>}
                </button>
              </TableHead>
              {cell(r.cardsCents + r.billsCents)}
              {cell(r.plannedCents)}
              {cell(r.savingCents)}
              {cell(r.leftoverCents)}
              {cell(r.paceLeftoverCents)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="caption text-text-muted">{t("projection.footnote")}</p>
    </Card>
  );
}
