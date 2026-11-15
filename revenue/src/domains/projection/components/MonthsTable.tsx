import { Card, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel } from "../../../shared/month/month";
import type { ProjectionRow } from "../logic/projectionRow";

/**
 * One row per month, a column per group, for a desktop width. It scrolls sideways inside its card (Bedrock's `Table`
 * wraps it in `overflow-x-auto`; `min-w` keeps the columns from squeezing). The month cell holds a button stretched
 * over the row: it is how the keyboard and screen readers choose the month shown in the detail card. "Gasto fora do
 * cartão" appears only when a month has it (the current one), so the columns add up to the Leftover. Without a Monthly
 * income there are no Entradas and no Sobra.
 */
export function MonthsTable({ rows, from, income, selected, onSelect }: { rows: ProjectionRow[]; from: string; income: number | null; selected: string; onSelect: (month: string) => void }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const hasSpent = rows.some((r) => r.spentCents !== undefined);
  const hasLeftover = income !== null;
  const cell = (cents: number | undefined) => (
    <TableCell align="end">
      {cents === undefined ? <><span aria-hidden>–</span><span className="sr-only">{t("projection.none")}</span></> : <Amount cents={cents} size="sm" locale={locale} {...hidden} />}
    </TableCell>
  );

  return (
    <Card className="min-w-0 gap-3 desktop:col-span-12">
      <Table className="min-w-[760px]">
        <TableCaption>{t("projection.heading")}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t("month.select")}</TableHead>
            {hasLeftover && <TableHead align="end">{t("overview.leftover.income")}</TableHead>}
            <TableHead align="end">{t("overview.group.cards")}</TableHead>
            <TableHead align="end">{t("overview.group.bills")}</TableHead>
            <TableHead align="end">{t("overview.group.planned")}</TableHead>
            {hasSpent && <TableHead align="end">{t("overview.group.spent")}</TableHead>}
            <TableHead align="end">{t("overview.group.saving")}</TableHead>
            {hasLeftover && <TableHead align="end">{t("projection.leftover")}</TableHead>}
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
              {hasLeftover && cell(income)}
              {cell(r.cardsCents)}
              {cell(r.billsCents)}
              {cell(r.plannedCents)}
              {hasSpent && cell(r.spentCents)}
              {cell(r.savingCents)}
              {hasLeftover && cell(r.leftoverCents ?? undefined)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="caption text-text-muted">{t("projection.footnote")}</p>
    </Card>
  );
}
