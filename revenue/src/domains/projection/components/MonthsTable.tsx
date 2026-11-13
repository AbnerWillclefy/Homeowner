import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { CommitmentMonth } from "../../overview/api/api";
import { monthLabel } from "../../overview/logic/month";
import { monthRows, type RowGroup } from "../../overview/logic/monthRows";
import { groupLabel } from "../logic/labels";

const GROUPS: RowGroup["id"][] = ["cards", "bills", "planned", "spent", "saving"];

/**
 * The months against what makes them up, for a desktop width: one column per month, one row per group, then Total and
 * Leftover. A group a month lacks reads as a dash. Neutral like the cards: a short month has a minus sign and words.
 */
export function MonthsTable({ months, from, income }: { months: CommitmentMonth[]; from: string; income: number | null }) {
  const { t, locale } = useI18n();
  const money = (cents: number) => formatAmount(cents, { locale });
  const rows = months.map(monthRows);
  const hasLeftover = income !== null;

  return (
    <Table>
      <TableCaption className="sr-only">{t("projection.heading")}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>
            <span className="sr-only">{t("projection.col.item")}</span>
          </TableHead>
          {months.map((m) => (
            <TableHead key={m.month} align="end" className="whitespace-nowrap">
              {monthLabel(m.month, locale)}
              {m.month === from && <span className="caption block normal-case">{t("projection.thisMonth")}</span>}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {GROUPS.filter((id) => rows.some((r) => r.groups.some((g) => g.id === id))).map((id) => (
          <TableRow key={id}>
            <TableHead scope="row" className="text-text">{groupLabel(t, id, false)}</TableHead>
            {rows.map((r, i) => {
              const cents = r.groups.find((g) => g.id === id)?.cents;
              return (
                <TableCell key={months[i]!.month} align="end">
                  {cents === undefined ? <><span aria-hidden>–</span><span className="sr-only">{t("projection.none")}</span></> : money(cents)}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
        <TableRow>
          <TableHead scope="row" className="text-text">{t("projection.total")}</TableHead>
          {rows.map((r, i) => (
            <TableCell key={months[i]!.month} align="end" className="font-semibold">{money(r.totalCents)}</TableCell>
          ))}
        </TableRow>
        {hasLeftover && (
          <TableRow>
            <TableHead scope="row" className="text-text">{t("projection.leftover")}</TableHead>
            {rows.map((r, i) => (
              <TableCell key={months[i]!.month} align="end">
                {r.leftoverCents !== null && <Amount cents={r.leftoverCents} size="sm" locale={locale} />}
                {r.overCents > 0 && <span className="caption block text-text-muted">{t("projection.short", { amount: money(r.overCents) })}</span>}
              </TableCell>
            ))}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
