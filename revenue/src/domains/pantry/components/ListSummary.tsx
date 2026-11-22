import { Banner, Card, DescriptionList, ProgressBar } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { Link } from "react-router";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { ShoppingList } from "../api";
import { overBy, unpricedCount } from "../logic/list";

const LINK = "rounded-sm text-brand underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** The summary as a description list: the expected total, and what is left of the groceries limit (in danger once the total passes it). */
function useSummary(list: ShoppingList) {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const hiddenProps = useHiddenProps();
  const { expectedTotalCents: total, groceriesLeftCents: left } = list;
  const over = overBy(total, left);
  const money = (cents: number) => (hidden ? t("hide.label") : formatAmount(cents, { locale }));
  const items = [
    { label: t("list.total"), value: <Amount cents={total} size="md" locale={locale} {...hiddenProps} /> },
    ...(left === undefined ? [] : [{ label: t("list.left"), value: <Amount cents={Math.max(left, 0)} size="md" locale={locale} className={over === null ? undefined : "text-danger"} {...hiddenProps} /> }]),
  ];
  const noLimit = left === undefined && (
    <p className="body text-text-muted">
      {t("list.noLimit")} <Link to="/categories" className={LINK}>{t("list.setLimit")}</Link>
    </p>
  );
  const unpriced = unpricedCount(list.items);
  const unpricedNote = unpriced > 0 && <span className="caption text-text-muted">{t(unpriced === 1 ? "list.unpriced.one" : "list.unpriced.many", { count: unpriced })}</span>;
  const warning = over !== null && <Banner tone="warning">{t("list.over", { amount: money(over) })}</Banner>;
  return { items, noLimit, unpricedNote, warning, money, total, left, over };
}

/**
 * Desktop: the "Resumo" card. The expected total beside what is left of the groceries limit, with a bar. Going over only warns:
 * nothing on the screen is blocked. With no limit the total stands alone, with a way to set one.
 */
export function ListSummary({ list, className }: { list: ShoppingList; className?: string }) {
  const { t } = useI18n();
  const { hidden } = useHideValues();
  const { items, noLimit, unpricedNote, warning, money, total, left, over } = useSummary(list);
  return (
    <Card className={className}>
      <h2 className="section-title">{t("list.summaryHead")}</h2>
      <DescriptionList items={items} />
      {unpricedNote}
      {noLimit}
      {left !== undefined && left > 0 && (
        <ProgressBar
          value={total}
          max={left}
          label={t("list.leftBar")}
          tone={over === null ? undefined : "warning"}
          valueText={hidden ? t("hide.label") : `${money(total)} / ${money(left)}`}
        />
      )}
      {warning}
    </Card>
  );
}

/** The warning that goes in the scroll on a phone, above the list; the numbers are in the dock. */
export function OverWarning({ list }: { list: ShoppingList }) {
  return useSummary(list).warning || null;
}

/**
 * Phone: the same two lines pinned above the BottomBar, in thumb reach. `sticky`, not `fixed`, so it never covers the last row.
 * 5.0625rem is the BottomBar's height, as in the Shell.
 */
export function ListDock({ list }: { list: ShoppingList }) {
  const { t } = useI18n();
  const { items, noLimit, unpricedNote } = useSummary(list);
  return (
    <section aria-label={t("list.summaryHead")} className="sticky bottom-[calc(5.0625rem+env(safe-area-inset-bottom))] z-(--z-sticky) -mx-4 flex flex-col gap-1 border-t border-border bg-surface-raised px-4 py-3">
      <DescriptionList items={items} />
      {unpricedNote}
      {noLimit}
    </section>
  );
}
