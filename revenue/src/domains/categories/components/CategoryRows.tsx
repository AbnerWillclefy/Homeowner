import { Amount } from "@homeowner/bedrock/finance";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { spendingKey } from "../logic/categories";
import type { CategoryRow } from "../logic/rows";
import { LimitBar } from "./LimitBar";

/** One row per Spending Category: its name as a link to the drill-down, what it took, and the bar against its limit. */
export function CategoryRows({ rows, search }: { rows: CategoryRow[]; search: string }) {
  const { t, locale } = useI18n();
  return (
    <ul className="divide-y divide-border">
      {rows.map(({ category, spentCents, limit }) => {
        const name = t(spendingKey(category));
        return (
          <li key={category} className="flex flex-col gap-2 py-3">
            <div className="flex items-center justify-between gap-4">
              <Link to={{ pathname: `/categories/${category}`, search }} className="body-strong flex min-h-11 min-w-0 items-center gap-1 rounded-sm underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [overflow-wrap:anywhere]">
                {name}
                <ChevronRight aria-hidden className="size-4 shrink-0 rtl:rotate-180" />
              </Link>
              <Amount cents={spentCents} size="sm" locale={locale} />
            </div>
            {limit === undefined ? (
              <p className="caption text-text-muted">{t("categories.noLimit")}</p>
            ) : (
              <LimitBar label={t("categories.limit.label", { name })} spent={spentCents} limit={limit} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
