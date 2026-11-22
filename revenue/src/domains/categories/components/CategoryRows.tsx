import { Amount, CategoryTag, formatAmount } from "@homeowner/bedrock/finance";
import { Link } from "react-router";
import { useHideValues, useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { spendingKey, tagOf } from "../logic/categories";
import { changePercent, type previousMonth } from "../logic/change";
import { limitText } from "../logic/limit";
import type { CategoryRow } from "../logic/rows";
import { ChangeBadge } from "./ChangeBadge";
import { LimitBar } from "./LimitBar";

/**
 * One row per Spending Category, the same three lines on every width: its tag as a link to the drill-down and the
 * amount; the bar against its limit (only with one); the caption ("of R$ 400 · R$ 112 under", or no limit) and the
 * change against the previous month (left out when that month spent nothing).
 */
export function CategoryRows({ rows, search, previous }: { rows: CategoryRow[]; search: string; previous: ReturnType<typeof previousMonth> }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const { hidden: isHidden } = useHideValues();
  const money = (cents: number) => formatAmount(cents, { locale });
  return (
    <ul className="flex flex-col gap-2">
      {rows.map(({ category, spentCents, limit }) => {
        const name = t(spendingKey(category));
        const change = previous && changePercent(spentCents, previous.byCategory.get(category) ?? 0);
        const standing = limit === undefined ? null : limitText(spentCents, limit);
        // The caption carries money, so a hidden one is left empty.
        const caption = limit === undefined ? t("categories.noLimit") : isHidden ? "" : t(`categories.caption.${standing!.key}`, { limit: money(limit), amount: money(standing!.amount) });
        return (
          <li key={category} className="flex flex-col gap-2 py-2">
            <div className="flex items-center justify-between gap-4">
              <Link to={{ pathname: `/categories/${category}`, search }} className="flex min-h-11 min-w-0 items-center rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [overflow-wrap:anywhere]">
                <CategoryTag category={tagOf(category)} label={name} />
              </Link>
              <Amount cents={spentCents} size="sm" locale={locale} {...hidden} />
            </div>
            {limit !== undefined && <LimitBar bare label={t("categories.limit.label", { name })} spent={spentCents} limit={limit} />}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="caption min-w-0 text-text-muted">{caption}</span>
              {change != null && <span className="shrink-0"><ChangeBadge percent={change} /></span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
