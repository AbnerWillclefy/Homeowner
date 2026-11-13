import { Amount, CategoryIcon, CategoryTag } from "@homeowner/bedrock/finance";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Transaction } from "../api";
import { spendingKey, tagOf } from "../logic/categories";
import { formatDay } from "../logic/month";

interface RowsProps {
  rows: Transaction[];
  caption: string;
  onEdit(tx: Transaction): void;
}

/** What the row shows as money: an Expense as what it cost (a refund comes out negative), the rest as the bank signed it. */
function useMoney() {
  const { locale } = useI18n();
  return (tx: Transaction) => (
    <Amount cents={tx.type === "expense" ? -tx.amountCents : tx.amountCents} income={tx.type === "income"} size="sm" locale={locale} />
  );
}

const isRefund = (tx: Transaction) => tx.type === "expense" && tx.amountCents > 0;

/** The text that tells the row's kind apart from its amount's sign alone. */
function useNotes() {
  const { t } = useI18n();
  return (tx: Transaction) =>
    [
      isRefund(tx) && t("tx.refund"),
      tx.installment && t("tx.installment", { number: tx.installment.number, total: tx.installment.total }),
    ].filter(Boolean).join(" · ");
}

const rowButton =
  "text-left body-strong [overflow-wrap:anywhere] min-h-11 cursor-pointer rounded-sm outline-none after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Desktop width: a table. Descriptions wrap; the first cell's button covers the row. */
export function TransactionsTable({ rows, caption, onEdit }: RowsProps) {
  const { t, locale } = useI18n();
  const money = useMoney();
  const notes = useNotes();
  return (
    <Table>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t("tx.col.date")}</TableHead>
          <TableHead>{t("tx.col.description")}</TableHead>
          <TableHead>{t("tx.col.category")}</TableHead>
          <TableHead>{t("tx.col.type")}</TableHead>
          <TableHead align="end">{t("tx.col.amount")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((tx) => (
          <TableRow key={tx.id}>
            <TableCell className="whitespace-nowrap text-text-muted">{formatDay(tx.postedOn, locale)}</TableCell>
            <TableCell>
              <button type="button" aria-haspopup="dialog" onClick={() => onEdit(tx)} className={rowButton}>
                {tx.description}
              </button>
              <p className="caption text-text-muted [overflow-wrap:anywhere]">{[tx.sourceName, notes(tx)].filter(Boolean).join(" · ")}</p>
            </TableCell>
            <TableCell>
              {tx.type === "expense" && <CategoryTag category={tagOf(tx.spendingCategory)} label={t(spendingKey(tx.spendingCategory ?? "other"))} size="sm" />}
            </TableCell>
            <TableCell>{t(`tx.type.${tx.type}`)}</TableCell>
            <TableCell align="end">{money(tx)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Phone width: a list. Bedrock's ListRow truncates, which this screen must not, so the row is laid out here. */
export function TransactionsList({ rows, caption, onEdit }: RowsProps) {
  const { t, locale } = useI18n();
  const money = useMoney();
  const notes = useNotes();
  return (
    <ul aria-label={caption} className="divide-y divide-border">
      {rows.map((tx) => {
        const detail = [formatDay(tx.postedOn, locale), tx.sourceName, t(`tx.type.${tx.type}`), notes(tx)].filter(Boolean).join(" · ");
        return (
          <li key={tx.id}>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => onEdit(tx)}
              className="grid min-h-control-lg w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-md py-2 text-left text-text outline-none hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="flex">{tx.type === "expense" && <CategoryIcon category={tagOf(tx.spendingCategory)} />}</span>
              <span className="flex min-w-0 flex-col">
                <span className="body-strong [overflow-wrap:anywhere]">{tx.description}</span>
                <span className="caption text-text-muted [overflow-wrap:anywhere]">{detail}</span>
                {tx.type === "expense" && <span className="caption text-text-muted">{t(spendingKey(tx.spendingCategory ?? "other"))}</span>}
              </span>
              <span className="flex shrink-0 flex-col items-end">{money(tx)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
