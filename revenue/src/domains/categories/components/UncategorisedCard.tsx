import { Badge, Button, Card } from "@homeowner/bedrock";
import { CategoryIcon, ListRow } from "@homeowner/bedrock/finance";
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
          <li key={tx.id}>
            <ListRow leading={<CategoryIcon category="other" />} title={tx.description} subtitle={[tx.sourceName, formatDay(tx.postedOn, locale)].filter(Boolean).join(" · ")} cents={-tx.amountCents} locale={locale} {...hidden} />
          </li>
        ))}
      </ul>
      <Button asChild variant="secondary" size="lg" className="w-full">
        <Link to={{ pathname: "/transactions", search: `?month=${month}` }}>{t("categories.uncategorised.open")}</Link>
      </Button>
    </Card>
  );
}
