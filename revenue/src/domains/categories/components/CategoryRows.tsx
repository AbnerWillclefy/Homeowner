import { Amount, CategoryTag } from "@homeowner/bedrock/finance";
import { Link } from "react-router";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { spendingKey, tagOf } from "../logic/categories";
import { changePercent, type previousMonth } from "../logic/change";
import type { CategoryRow } from "../logic/rows";
import { ChangeBadge } from "./ChangeBadge";
import { LimitBar } from "./LimitBar";

/**
 * One row per Spending Category in three columns (below 1024px, two lines): its tag as a link to the drill-down,
 * the bar against its limit, and the change against the previous month (left out when that month spent nothing).
 */
export function CategoryRows({ rows, search, previous }: { rows: CategoryRow[]; search: string; previous: ReturnType<typeof previousMonth> }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  return (
    <ul className="flex flex-col gap-4">
      {rows.map(({ category, spentCents, limit }) => {
        const name = t(spendingKey(category));
        const change = previous && changePercent(spentCents, previous.byCategory.get(category) ?? 0);
        return (
          <li key={category} className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 desktop:grid-cols-[minmax(11rem,1.2fr)_minmax(12rem,2fr)_auto]">
            <Link to={{ pathname: `/categories/${category}`, search }} className="flex min-h-11 min-w-0 items-center rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [overflow-wrap:anywhere]">
              <CategoryTag category={tagOf(category)} label={name} />
            </Link>
            <span className="flex justify-end desktop:col-start-3 desktop:row-start-1">{change != null && <ChangeBadge percent={change} />}</span>
            <div className="col-span-2 desktop:col-span-1 desktop:col-start-2 desktop:row-start-1">
              {limit === undefined ? (
                <p className="caption flex justify-between gap-4 text-text-muted">
                  <Amount cents={spentCents} size="sm" locale={locale} {...hidden} />
                  {t("categories.noLimit")}
                </p>
              ) : (
                <LimitBar label={t("categories.limit.label", { name })} spent={spentCents} limit={limit} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
