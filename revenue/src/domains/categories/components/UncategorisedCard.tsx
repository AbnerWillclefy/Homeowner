import { Card } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { Link } from "react-router";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Transaction } from "../api";
import { formatDay } from "../logic/month";

/** The Expenses nothing could categorise, and where to pick a category for them (the Transactions screen). Hidden when there are none. */
export function UncategorisedCard({ rows, month }: { rows: Transaction[]; month: string }) {
  const { t, locale } = useI18n();
  if (rows.length === 0) return null;
  return (
    <Card>
      <h2 className="section-title">{t("categories.uncategorised.title", { count: rows.length })}</h2>
      <p className="caption text-text-muted">{t("categories.uncategorised.hint")}</p>
      <ul className="divide-y divide-border">
        {rows.map((tx) => (
          <li key={tx.id} className="flex items-center justify-between gap-4 py-2">
            <span className="flex min-w-0 flex-col">
              <span className="body-strong [overflow-wrap:anywhere]">{tx.description}</span>
              <span className="caption text-text-muted">{formatDay(tx.postedOn, locale)}</span>
            </span>
            <Amount cents={-tx.amountCents} size="sm" locale={locale} />
          </li>
        ))}
      </ul>
      <Link to={{ pathname: "/transactions", search: `?month=${month}` }} className="body-strong inline-flex min-h-11 items-center rounded-sm underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        {t("categories.uncategorised.open")}
      </Link>
    </Card>
  );
}
