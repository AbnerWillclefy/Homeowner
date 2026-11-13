import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { Amount, ListRow } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatDay } from "../../bills/logic/month";
import type { CardTransaction } from "../api";

const subtitle = (r: CardTransaction, t: ReturnType<typeof useI18n>["t"], locale: string) =>
  [formatDay(r.postedOn, locale), r.installment && t("cardBills.installment", { number: r.installment.number, total: r.installment.total })].filter(Boolean).join(" · ");

/** The Transactions that make up a card's bill. Desktop width: a table. */
export function CardRowsTable({ rows, caption }: { rows: CardTransaction[]; caption: string }) {
  const { t, locale } = useI18n();
  return (
    <Table>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t("cardBills.col.date")}</TableHead>
          <TableHead>{t("cardBills.col.description")}</TableHead>
          <TableHead align="end">{t("cardBills.col.amount")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="whitespace-nowrap text-text-muted">{formatDay(r.postedOn, locale)}</TableCell>
            <TableCell>
              <span className="[overflow-wrap:anywhere]">{r.description}</span>
              {r.installment && <p className="caption text-text-muted">{t("cardBills.installment", { number: r.installment.number, total: r.installment.total })}</p>}
            </TableCell>
            <TableCell align="end"><Amount cents={r.amountCents} size="sm" locale={locale} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Phone width: a list of rows. */
export function CardRowsList({ rows, caption }: { rows: CardTransaction[]; caption: string }) {
  const { t, locale } = useI18n();
  return (
    <ul aria-label={caption} className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.id}>
          <ListRow title={r.description} subtitle={subtitle(r, t, locale)} cents={r.amountCents} locale={locale} />
        </li>
      ))}
    </ul>
  );
}
