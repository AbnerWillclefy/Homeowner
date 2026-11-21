import { Badge } from "@homeowner/bedrock";
import { useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useMonthParam } from "../../../shared/month/useMonthParam";
import { useBills } from "../../bills/hooks/useBills";
import { summarise } from "../../bills/logic/billState";
import { useSpending } from "../../categories/hooks/useCategories";
import { uncategorised } from "../../categories/logic/uncategorised";
import { useMoney } from "../../goals/hooks/useMoney";
import { useCommitments } from "../../overview/hooks/useOverviewData";
import { formatDay } from "../../overview/logic/month";
import { usePantry } from "../../pantry/hooks/usePantry";
import type { RowDetail } from "../../plan/hooks/usePlanRows";
import { nextDue, openCardBillsCents, ranOutCount } from "../logic/more";

/** What each Mais row shows beside its title, by the screen's path. As on Planejar: shared reads, the title alone while one loads or fails, no amounts in a caption while values are hidden. */
export function useMoreRows(): Record<string, RowDetail> {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const money = useMoney();
  const { thisMonth } = useMonthParam();
  const bills = useBills(thisMonth).data;
  const commitments = useCommitments(thisMonth).data;
  const spending = useSpending(thisMonth).data;
  const pantry = usePantry().data;

  const rows: Record<string, RowDetail> = {};

  if (bills) {
    const { toPayCents, toPayCount } = summarise(bills);
    const due = nextDue(bills);
    rows["/bills"] = {
      caption: due ? (hidden ? t("more.bills.due", { day: formatDay(due, locale) }) : t("more.bills.amountDue", { amount: money(toPayCents), day: formatDay(due, locale) })) : t("more.bills.allPaid"),
      end: toPayCount > 0 ? <Badge tone="warning">{t(toPayCount === 1 ? "more.bills.pending.one" : "more.bills.pending.many", { count: toPayCount })}</Badge> : undefined,
    };
  }

  const cards = commitments && openCardBillsCents(commitments.month.cards);
  if (cards != null) rows["/card-bills"] = { caption: hidden ? t("more.cardBills.hidden") : t("more.cardBills", { amount: money(cards) }) };

  if (spending) {
    const count = uncategorised(spending.transactions).length;
    if (count > 0) rows["/categories"] = { caption: t("more.categories", { count }), end: <Badge tone="warning">{count}</Badge> };
  }

  if (pantry) {
    const out = ranOutCount(pantry);
    if (out > 0) rows["/pantry"] = { caption: t(out === 1 ? "more.pantry.one" : "more.pantry.many", { count: out }) };
  }

  rows["/settings"] = { caption: t("more.settings") };
  return rows;
}
