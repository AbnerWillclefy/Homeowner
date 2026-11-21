import { Banner, Card, ProgressBar } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { Link } from "react-router";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { ShoppingList } from "../api";
import { overBy, unpricedCount } from "../logic/list";

/**
 * The expected total beside what is left of the groceries limit. Going over only warns: nothing on the screen is blocked.
 * With no limit the total stands alone, with a way to set one.
 */
export function ListSummary({ list, className }: { list: ShoppingList; className?: string }) {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const hiddenProps = useHiddenProps();
  const { expectedTotalCents: total, groceriesLeftCents: left } = list;
  const over = overBy(total, left);
  const unpriced = unpricedCount(list.items);
  const money = (cents: number) => (hidden ? t("hide.label") : formatAmount(cents, { locale }));
  return (
    <Card className={className}>
      <h2 className="section-title">{t("list.summaryHead")}</h2>
      <div className="flex flex-col gap-1">
        <span className="caption text-text-muted">{t("list.total")}</span>
        <Amount cents={total} size="lg" locale={locale} {...hiddenProps} />
        {unpriced > 0 && <span className="caption text-text-muted">{t(unpriced === 1 ? "list.unpriced.one" : "list.unpriced.many", { count: unpriced })}</span>}
      </div>
      {left === undefined ? (
        <p className="body text-text-muted">
          {t("list.noLimit")}{" "}
          <Link to="/categories" className="rounded-sm text-brand underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            {t("list.setLimit")}
          </Link>
        </p>
      ) : (
        <>
          {left > 0 && (
            <ProgressBar
              value={total}
              max={left}
              label={t("list.leftBar")}
              tone={over === null ? undefined : "warning"}
              valueText={hidden ? t("hide.label") : `${money(total)} / ${money(left)}`}
              start={t("list.left")}
              end={<Amount cents={left} size="sm" locale={locale} {...hiddenProps} />}
            />
          )}
          {left <= 0 && (
            <div className="flex flex-col gap-1">
              <span className="caption text-text-muted">{t("list.left")}</span>
              <Amount cents={0} size="md" locale={locale} {...hiddenProps} />
            </div>
          )}
          {over !== null && <Banner tone="warning">{t("list.over", { amount: money(over) })}</Banner>}
        </>
      )}
    </Card>
  );
}
