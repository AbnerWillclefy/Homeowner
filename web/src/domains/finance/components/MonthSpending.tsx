import { useId, useMemo, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import { StatTile } from "../../../shared/ui/StatTile";
import type { Transaction } from "../api/api";
import { useMonth, type EditOutcome } from "../hooks/useMonth";
import { useReport } from "../hooks/useReport";
import { lastMonth } from "../logic/difference";
import { formatCents } from "../logic/money";
import { addMonths, currentMonth, monthLabel, monthName } from "../logic/month";
import { monthView } from "../logic/monthView";
import { spendingKey, type SpendingCategory } from "../logic/spendingCategories";
import { Card } from "../../../shared/ui/Card";
import { CategoryCard } from "./CategoryCard";
import { MonthPicker } from "./MonthPicker";
import { EditTransactionDialog } from "./EditTransactionDialog";
import { LeftOutGroup } from "./LeftOutGroup";

/**
 * The month's spending by Spending Category against the month before, with one month picker and a Transaction edit.
 * Shown once there are Sources. The comparison is text; a category with nothing in either month is not listed.
 */
export function MonthSpending() {
  const { t, locale } = useI18n();
  const [today] = useState(() => currentMonth(new Date()));
  const [month, setMonth] = useState(today);
  const { state, refreshing, reload, edit } = useMonth(month);
  const report = useReport(month);
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing || report.refreshing);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [gone, setGone] = useState(false);
  const view = useMemo(() => (state.kind === "ready" ? monthView(state.data) : null), [state]);
  const last = useMemo(
    () => (view && report.state.kind === "ready" ? lastMonth(report.state.data, view.categories.map((g) => g.category)) : null),
    [view, report.state],
  );

  function closed(outcome: EditOutcome | "cancelled") {
    setEditing(null);
    setGone(outcome === "gone");
  }

  function go(n: number) {
    setGone(false);
    setMonth(addMonths(month, n));
  }

  const label = monthLabel(month, locale);
  const previousName = monthName(addMonths(month, -1), locale);
  const money = (cents: number) => formatCents(cents, locale);
  return (
    // No outer card: the category cards inside it get the full width, which they need at the largest text.
    <div className="flex flex-col gap-3">
      <MonthPicker
        month={month}
        today={today}
        groupLabel={t("finances.month.heading")}
        prevLabel={t("finances.month.prev")}
        nextLabel={t("finances.month.next")}
        onStep={go}
      />

      {state.kind === "loading" && skeleton && (
        <div aria-hidden="true">
          <SkeletonBar className="h-5 w-full" />
        </div>
      )}
      {state.kind === "failed" && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="my-0 font-semibold">
            {t("finances.month.failed")}
          </p>
          <Button variant="secondary" onClick={() => void reload()}>
            {t("finances.load.retry")}
          </Button>
        </div>
      )}
      <p role="status" className="my-0">
        {gone ? t("finances.edit.gone") : ""}
      </p>
      {view &&
        (view.isEmpty ? (
          <>
            <p className="my-0 text-muted">{t("finances.month.empty")}</p>
            {/* Early in a month nothing is imported yet; last month is still worth seeing. */}
            {last && last.only.length > 0 && (
              <>
                <p className="my-0 text-muted">
                  {t(`finances.report.${last.diff.key}`, { amount: money(last.diff.amount), month: previousName })}
                </p>
                <OnlyLastMonth title={t("finances.month.onlyLast", { month: previousName })} rows={last.only} />
              </>
            )}
          </>
        ) : (
          <>
            <StatTile
              value={money(view.spentCents)}
              label={
                <>
                  {t("finances.month.spent", { month: label })}
                  {last && (
                    <span className="block font-normal text-muted">
                      {t(`finances.report.${last.diff.key}`, { amount: money(last.diff.amount), month: previousName })}
                    </span>
                  )}
                </>
              }
            />
            {report.state.kind === "failed" && (
              <div className="flex flex-col items-start gap-3">
                <p role="alert" className="my-0 font-semibold">
                  {t("finances.report.failed")}
                </p>
                <Button variant="secondary" onClick={() => void report.reload()}>
                  {t("finances.load.retry")}
                </Button>
              </div>
            )}
            {view.categories.map((group) => (
              <CategoryCard
                key={group.category}
                group={group}
                {...(last && {
                  lastMonth: t("finances.report.value", { month: previousName, amount: money(last.spentBy.get(group.category) ?? 0) }),
                })}
                onEdit={setEditing}
              />
            ))}
            {last && last.only.length > 0 && <OnlyLastMonth title={t("finances.month.onlyLast", { month: previousName })} rows={last.only} />}
            <LeftOutGroup title={t("finances.month.transfers")} rows={view.transfers} onEdit={setEditing} />
            <LeftOutGroup title={t("finances.month.income")} rows={view.income} onEdit={setEditing} />
          </>
        ))}
      {editing && <EditTransactionDialog tx={editing} save={edit} onClose={closed} />}
    </div>
  );
}

/** Categories spent on last month but not this one, so the two totals still add up in the reader's head. */
function OnlyLastMonth({ title, rows }: { title: string; rows: { category: SpendingCategory; spentCents: number }[] }) {
  const { t, locale } = useI18n();
  const id = useId();
  return (
    <Card as="section" aria-labelledby={id} className="mt-0 flex flex-col gap-2">
      <h4 id={id} className="m-0 text-base font-bold leading-snug [overflow-wrap:anywhere]">
        {title}
      </h4>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
        {rows.map((r) => (
          <li key={r.category} className="flex flex-wrap justify-between gap-x-3">
            <span className="min-w-0 [overflow-wrap:anywhere]">{t(spendingKey(r.category))}</span>
            <span className="font-semibold">{formatCents(r.spentCents, locale)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
