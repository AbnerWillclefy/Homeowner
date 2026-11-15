import { Badge, Button, Card } from "@homeowner/bedrock";
import { Amount, CategoryIcon } from "@homeowner/bedrock/finance";
import { Link } from "react-router";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatDay } from "../../../shared/month/month";
import type { Transaction } from "../api";

const SHOWN = 5;

/** The Expenses nothing could categorise (the first few), and the way to pick a category for them: the Transactions screen. Hidden when there are none. */
export function UncategorisedCard({ rows, month }: { rows: Transaction[]; month: string }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  if (rows.length === 0) return null;
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="section-title">{t("categories.uncategorised.label")}</h2>
        <Badge tone="warning">
          <span aria-hidden>{rows.length}</span>
          <span className="sr-only">{t("categories.uncategorised.count", { count: rows.length })}</span>
        </Badge>
      </div>
      <ul className="divide-y divide-border">
        {rows.slice(0, SHOWN).map((tx) => (
          <li key={tx.id} className="flex items-center gap-3 py-2">
            <CategoryIcon category="other" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="body-strong [overflow-wrap:anywhere]">{tx.description}</span>
              <span className="caption text-text-muted">{[tx.sourceName, formatDay(tx.postedOn, locale)].filter(Boolean).join(" · ")}</span>
            </span>
            <Amount cents={-tx.amountCents} size="sm" locale={locale} {...hidden} />
          </li>
        ))}
      </ul>
      <Button asChild variant="secondary" className="w-full">
        <Link to={{ pathname: "/transactions", search: `?month=${month}` }}>{t("categories.uncategorised.open")}</Link>
      </Button>
    </Card>
  );
}
