import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { CategoryIcon, CategoryTag } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatDay } from "../../../shared/month/month";
import type { Transaction } from "../api";
import { spendingKey, tagOf } from "../logic/categories";
import { groupByDay } from "../logic/totals";
import { Money } from "./Money";

interface RowsProps {
  rows: Transaction[];
  caption: string;
  onEdit(tx: Transaction): void;
}

const isRefund = (tx: Transaction) => tx.type === "expense" && tx.amountCents > 0;

/** The text that tells the row's kind apart from its amount's sign alone. */
function useMeta() {
  const { t } = useI18n();
  return (tx: Transaction) =>
    [
      t(`tx.type.${tx.type}`),
      isRefund(tx) && t("tx.refund"),
      tx.installment && t("tx.installment", { number: tx.installment.number, total: tx.installment.total }),
    ].filter(Boolean).join(" · ");
}

const rowButton =
  "text-left body-strong [overflow-wrap:anywhere] min-h-11 cursor-pointer rounded-sm outline-none after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Desktop width: a real table, one `<tbody>` per day under a row-group heading. Scrolls inside its box, never the page. */
export function TransactionsTable({ rows, caption, onEdit }: RowsProps) {
  const { t, locale } = useI18n();
  const meta = useMeta();
  return (
    <Table className="min-w-[47.5rem]">
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t("tx.col.description")}</TableHead>
          <TableHead>{t("tx.col.category")}</TableHead>
          <TableHead>{t("tx.col.source")}</TableHead>
          <TableHead align="end">{t("tx.col.amount")}</TableHead>
        </TableRow>
      </TableHeader>
      {groupByDay(rows).map((group) => (
        <TableBody key={group.day}>
          <TableRow>
            <th scope="rowgroup" colSpan={4} className="label bg-surface-sunken px-4 py-2 text-left text-text-muted">
              {formatDay(group.day, locale)}
            </th>
          </TableRow>
          {group.rows.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  {tx.type === "expense" && <CategoryIcon category={tagOf(tx.spendingCategory)} />}
                  <div className="min-w-0">
                    <button type="button" aria-haspopup="dialog" onClick={() => onEdit(tx)} className={rowButton}>
                      {tx.description}
                    </button>
                    {tx.note && <p className="caption text-text-muted [overflow-wrap:anywhere]">{tx.note}</p>}
                    <p className="caption text-text-muted [overflow-wrap:anywhere]">{meta(tx)}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {tx.type === "expense" && <CategoryTag category={tagOf(tx.spendingCategory)} label={t(spendingKey(tx.spendingCategory ?? "other"))} size="sm" />}
              </TableCell>
              <TableCell className="text-text-muted [overflow-wrap:anywhere]">{tx.sourceName}</TableCell>
              <TableCell align="end"><Money tx={tx} size="sm" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      ))}
    </Table>
  );
}

/** Phone width: a list per day. Bedrock's ListRow truncates, which this screen must not, so the row is laid out here. */
export function TransactionsList({ rows, caption, onEdit }: RowsProps) {
  const { t, locale } = useI18n();
  const meta = useMeta();
  return (
    <div>
      {groupByDay(rows).map((group) => {
        const day = formatDay(group.day, locale);
        return (
          <section key={group.day}>
            <h2 className="label pt-4 pb-2 text-text-muted">{day}</h2>
            <ul aria-label={`${caption}, ${day}`} className="divide-y divide-border">
              {group.rows.map((tx) => (
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
                      {tx.note && <span className="caption text-text-muted [overflow-wrap:anywhere]">{tx.note}</span>}
                      <span className="caption text-text-muted [overflow-wrap:anywhere]">
                        {[tx.type === "expense" && t(spendingKey(tx.spendingCategory ?? "other")), tx.sourceName, meta(tx)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end"><Money tx={tx} size="sm" /></span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
