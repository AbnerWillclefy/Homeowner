import type { ReactNode } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import type { QueryViewState } from "../../../shared/query/view";
import { useBills } from "../hooks/useBills";
import { useCommitments } from "../hooks/useCommitments";
import { useMonth } from "../hooks/useMonth";
import { billGroups } from "../logic/billGroups";
import { billState } from "../logic/billState";
import { incomeSplit } from "../logic/incomeSplit";
import { formatCents } from "../logic/money";
import { addMonths, currentDay, currentMonth, formatDay, monthName } from "../logic/month";
import { monthView } from "../logic/monthView";
import { nextUnpaid } from "../logic/nextUnpaid";
import { paceSentence } from "../logic/paceSentence";
import { paceSeries } from "../logic/paceSeries";
import { sameDays } from "../logic/sameDays";
import { spendingKey } from "../logic/spendingCategories";
import { topCategories } from "../logic/topCategories";
import { CumulativeLine } from "./charts/CumulativeLine";
import type { FinanceView } from "./FinanceTabs";
import { IncomeBar } from "./IncomeBar";

/** A block that has not loaded: a quiet bar, or the failure with its own retry, so one failed read never hides the rest. */
function Block({ heading, states, retry, failed, children }: { heading: string; states: QueryViewState<unknown>[]; retry: () => void; failed: string; children: ReactNode }) {
  const { t } = useI18n();
  const skeleton = useReportFirstLoad(states.some((s) => s.kind === "loading"));
  const broken = states.some((s) => s.kind === "failed");
  return (
    <section aria-label={heading} className="mt-0 flex flex-col gap-3">
      <h3 className="my-0 text-lg font-bold leading-snug [overflow-wrap:anywhere]">{heading}</h3>
      {!broken && states.some((s) => s.kind === "loading") && skeleton && (
        <div aria-hidden="true">
          <SkeletonBar className="h-5 w-full" />
        </div>
      )}
      {broken && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="my-0 font-semibold">
            {failed}
          </p>
          <Button variant="secondary" onClick={retry}>
            {t("finances.load.retry")}
          </Button>
        </div>
      )}
      {!broken && states.every((s) => s.kind === "ready") && children}
    </section>
  );
}

/**
 * Resumo: how the month is going, from the same cached reads Gastos and Contas use (all panels stay mounted, so
 * opening Finances has already read them). Nothing is fetched here that the other views do not fetch too.
 */
export function Summary({ importing, show }: { importing: boolean; show: (view: FinanceView) => void }) {
  const { t, locale } = useI18n();
  const today = new Date(); // each render, like Gastos, so a resumed app is not stuck on the mount day
  const month = currentMonth(today);
  const day = currentDay(today);
  const previousMonth = addMonths(month, -1);
  const current = useMonth(month);
  const previous = useMonth(previousMonth);
  const bills = useBills(month);
  const commitments = useCommitments(month);
  useReportFetching(current.refreshing || previous.refreshing || bills.refreshing || commitments.refreshing);

  const money = (cents: number) => formatCents(cents, locale);
  const rows = current.state.kind === "ready" ? current.state.data.transactions : null;
  const before = previous.state.kind === "ready" ? previous.state.data.transactions : null;
  const compared = rows && before ? sameDays(rows, before, month, today) : null;
  const spent = compared?.spent ?? (current.state.kind === "ready" ? current.state.data.spentCents : 0);
  const unpaid = bills.state.kind === "ready" ? billGroups(bills.state.data, day).toPayCents : 0;
  const income = commitments.state.kind === "ready" ? commitments.state.data.monthlyIncomeCents : null;
  const series = rows && before ? paceSeries(rows, before, month, today) : null;
  const view = current.state.kind === "ready" ? monthView(current.state.data) : null;
  const sentence = compared ? paceSentence(t, locale, compared, today.getDate(), month) : null;
  const next = bills.state.kind === "ready" ? nextUnpaid(bills.state.data, day, 3) : [];
  const top = view ? topCategories(view, 3) : [];
  const retryAll = () => void Promise.all([current.reload(), bills.reload(), commitments.reload()]);

  return (
    <>
      {importing && <p className="my-0 text-muted">{t("finances.importing")}</p>}
      <Block heading={t("finances.summary.split.heading")} states={[current.state, bills.state, commitments.state]} retry={retryAll} failed={t("finances.summary.split.failed")}>
        <IncomeBar split={incomeSplit(income, spent, unpaid)} />
      </Block>

      <Block heading={t("finances.summary.pace.heading")} states={[current.state, previous.state]} retry={() => void Promise.all([current.reload(), previous.reload()])} failed={t("finances.summary.pace.failed")}>
        {sentence && <p className="my-0 font-semibold">{sentence}</p>}
        {/* No card around the chart: its legend needs the full width at the largest text. */}
        {series && (
          <CumulativeLine
            title={t("finances.summary.pace.title")}
            series={[
              { label: monthName(month, locale), points: series.current },
              { label: monthName(previousMonth, locale), points: series.previous },
            ]}
          />
        )}
      </Block>

      <Block heading={t("finances.summary.bills.heading")} states={[bills.state]} retry={() => void bills.reload()} failed={t("finances.bills.load.failed")}>
        {next.length === 0 ? (
          <p className="my-0 text-muted">{t("finances.summary.bills.empty")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {next.map((bill) => {
              const date = formatDay(bill.dueDate, locale);
              const line = billState(bill, day) === "overdue" ? t("finances.bills.state.overdue", { date }) : t("finances.bills.due", { date });
              return (
                <li key={bill.id} className="m-0 flex flex-col">
                  <span className="font-semibold [overflow-wrap:anywhere]">{bill.name}</span>
                  <span className="text-sm text-muted [overflow-wrap:anywhere]">{t("finances.summary.bills.row", { amount: money(bill.expectedCents), line })}</span>
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="link" className="self-start" onClick={() => show("bills")}>
          {t("finances.summary.bills.all")}
        </Button>
      </Block>

      <Block heading={t("finances.summary.top.heading")} states={[current.state]} retry={() => void current.reload()} failed={t("finances.month.failed")}>
        {top.length === 0 ? (
          <p className="my-0 text-muted">{t("finances.month.empty")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {top.map((c) => (
              <li key={c.category} className="m-0 flex flex-wrap justify-between gap-x-3">
                <span className="font-semibold [overflow-wrap:anywhere]">{t(spendingKey(c.category))}</span>
                <span>{money(c.spentCents)}</span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="link" className="self-start" onClick={() => show("spending")}>
          {t("finances.summary.top.all")}
        </Button>
      </Block>
    </>
  );
}
