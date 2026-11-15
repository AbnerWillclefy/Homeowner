import { Badge, Card } from "@homeowner/bedrock";
import { CategoryIcon, ListRow } from "@homeowner/bedrock/finance";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatDay } from "../../../shared/month/month";
import { SPENDING_CATEGORIES, spendingKey, tagOf, type SpendingCategory } from "../../transactions/logic/categories";
import type { CardTransaction } from "../api";

const categoryOf = (id: string | null): SpendingCategory | null => SPENDING_CATEGORIES.find((c) => c === id) ?? null;

/** "Nesta fatura": the Transactions that make up the bill, one row each; an installment carries its "3/10" tag. */
export function CardRows({ rows, caption }: { rows: CardTransaction[] | null; caption: string }) {
  const { t, locale } = useI18n();
  const hiddenProps = useHiddenProps();
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="card-label text-text-muted">{t("cardBills.rows.title")}</h2>
        {rows && <span className="text-text-muted">{t(rows.length === 1 ? "cardBills.rows.count.one" : "cardBills.rows.count.many", { count: rows.length })}</span>}
      </div>
      {rows === null ? (
        <p className="caption text-text-muted">{t("cardBills.rows.failed")}</p>
      ) : rows.length === 0 ? (
        <p className="caption text-text-muted">{t("cardBills.rows.none")}</p>
      ) : (
        <ul aria-label={caption} className="divide-y divide-border">
          {rows.map((r) => {
            const category = categoryOf(r.spendingCategory);
            return (
              <li key={r.id}>
                <ListRow
                  leading={<CategoryIcon category={tagOf(category)} />}
                  title={r.description}
                  subtitle={[t(spendingKey(category ?? "other")), formatDay(r.postedOn, locale)].join(" · ")}
                  cents={r.amountCents}
                  end={r.installment && <Badge tone="neutral">{r.installment.number}/{r.installment.total}</Badge>}
                  locale={locale}
                  {...hiddenProps}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
