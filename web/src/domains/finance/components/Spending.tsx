import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { financeStatusQuery, monthQuery } from "../api/queries";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { useFinanceMonth } from "../hooks/useFinanceMonth";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import type { Transaction } from "../api/api";
import { useMonth,type EditOutcome } from "../hooks/useMonth";
import { difference } from "../logic/difference";
import { headerGap } from "../logic/headerGap";
import { formatCents } from "../logic/money";
import { addMonths, monthName } from "../logic/month";
import { monthView } from "../logic/monthView";
import { categoryRows, sameDays, uncategorised } from "../logic/sameDays";
import { CategoryBar } from "./CategoryBar";
import { Donut } from "./charts/Donut";
import { EditTransactionDialog } from "./EditTransactionDialog";
import { LeftOutGroup } from "./LeftOutGroup";
import { UncategorisedCard } from "./UncategorisedCard";

/**
 * Gastos: the month's spending against the same days of the month before, built from the two cached months. While
 * the previous month loads or fails there is no comparison and no markers, never a wrong "a mais".
 */
export function Spending() {
  const { t, locale } = useI18n();
  const today = new Date(); // each render, so a resumed app cuts last month at the device's day, not the mount day
  const { month, thisMonth } = useFinanceMonth();
  const previousMonth = addMonths(month, -1);
  const { state, refreshing, reload, edit } = useMonth(month);
  const previous = useMonth(previousMonth);
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing || previous.refreshing);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [gone, setGone] = useState(false);
  const listId = useId();
  // Card charges already made whose bill is due in a later month (up to two ahead, as the API reads) are in no
  // month a picker reaches yet, so the current month lists them apart to be edited.
  const current = month === thisMonth;
  const ahead = [
    useQuery({ ...monthQuery(addMonths(thisMonth, 1)), enabled: current }),
    useQuery({ ...monthQuery(addMonths(thisMonth, 2)), enabled: current }),
  ];
  const later = current ? ahead.flatMap((q) => q.data?.transactions ?? []).filter((tx) => tx.type === "expense") : [];

  const view = useMemo(() => (state.kind === "ready" ? monthView(state.data) : null), [state]);
  const compared =
    state.kind === "ready" && previous.state.kind === "ready"
      ? sameDays(state.data.transactions, previous.state.data.transactions, month, today)
      : null;
  const rows = compared ? categoryRows(compared.byCategory) : null;
  const own = useMemo(() => (view ? categoryRows(new Map(view.categories.map((g) => [g.category, { spent: g.spentCents, previousSpent: 0 }]))) : null), [view]);
  const shown = rows ?? own;
  const missing = useMemo(() => (state.kind === "ready" ? uncategorised(state.data.transactions) : []), [state]);

  function closed(outcome: EditOutcome | "cancelled") {
    setEditing(null);
    setGone(outcome === "gone");
  }

  const money = (cents: number) => formatCents(cents, locale);
  const last = monthName(previousMonth, locale);
  const cut = compared?.cutDay ?? null;
  const diff = compared && !compared.noPrevious ? difference(compared.spent, compared.previousSpent) : null;
  const comparison = !compared
    ? null
    : diff === null
      ? t("finances.spending.noPrevious", { month: last })
      : cut === null
        ? t(`finances.report.${diff.key}`, { amount: money(diff.amount), month: last })
        : t(`finances.report.${diff.key}Until`, { amount: money(diff.amount), month: last, day: cut });
  const markers = compared !== null && !compared.noPrevious;
  const empty = view?.isEmpty && !(compared && !compared.noPrevious);
  const importing = useQuery(financeStatusQuery).data?.importing === true;
  const committed = state.kind === "ready" ? state.data.committedCents : undefined;
  const spentSince = state.kind === "ready" ? state.data.spentSinceFirstCents : undefined;
  const gap = committed !== undefined && spentSince !== undefined ? headerGap(committed, spentSince) : null;
  // The ring is the whole month's Spending Categories above zero; a refund-heavy one is left out.
  const donut = view?.categories.filter((g) => g.spentCents > 0).map((g) => ({ category: g.category, cents: g.spentCents })) ?? [];
  const limits = state.kind === "ready" ? state.data.limits : {};
  // The scale holds each limit too, so its tick stays on the track; with no limit it is the same as before.
  const scale = shown ? Math.max(shown.max, ...shown.rows.map((r) => limits[r.category] ?? 0)) : 0;
  // A charge on this month's bill not yet due is in no total, so it is listed with the later bills, once.
  const due = compared?.due ?? [];
  const upcoming = [...due, ...later];
  const groups = new Map(view?.categories.map((g) => [g.category, g.transactions.filter((tx) => !due.includes(tx))]));

  return (
    <div className="flex flex-col gap-4">
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
        (empty ? (
          <p role="status" className="my-0 text-muted">
            {importing ? t("finances.spending.importing") : t("finances.month.empty")}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {committed !== undefined && spentSince !== undefined ? (
                <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-x-3 gap-y-2">
                  {(
                    [
                      ["finances.spending.committed", committed],
                      ["finances.spending.spentSince", spentSince],
                    ] as const
                  ).map(([key, cents]) => (
                    <div key={key} className="flex min-w-0 flex-col">
                      <dt className="text-sm font-semibold">{t(key)}</dt>
                      <dd className="m-0 text-2xl font-bold leading-tight [overflow-wrap:anywhere]">{money(cents)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="flex flex-col">
                  <span className="text-3xl font-bold leading-tight [overflow-wrap:anywhere]">{money(compared?.spent ?? view.spentCents)}</span>
                  <span className="text-sm font-semibold">
                    {month === thisMonth
                      ? t("finances.month.spentUntil", { day: today.getDate(), month: monthName(month, locale) })
                      : t("finances.month.spent", { month: monthName(month, locale) })}
                  </span>
                </div>
              )}
              {gap && <p className="my-0 text-sm">{t(gap.key === "earlier" ? "finances.spending.gapEarlier" : "finances.spending.gapLater", { amount: money(gap.amount) })}</p>}
              {comparison && <p className="my-0 text-sm text-muted">{comparison}</p>}
            </div>
            {donut.length > 0 ? (
              <Card>
                <Donut key={month} items={donut} />
              </Card>
            ) : (
              <p className="my-0 text-muted">{t("finances.spending.noSpending")}</p>
            )}
            <UncategorisedCard rows={missing} onEdit={setEditing} />
            {shown && shown.rows.length > 0 && (
              <section aria-labelledby={listId} className="mt-2 flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 id={listId} className="m-0 text-2xl font-bold leading-snug">
                    {t("finances.spending.byCategory")}
                  </h3>
                  {markers && (
                    <span aria-hidden="true" className="flex flex-wrap gap-x-3 text-xs font-semibold text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-4 rounded-pill bg-chart-ink" />
                        {monthName(month, locale)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 border-s-2 border-chart-ink" />
                        {cut === null ? last : t("finances.spending.legendBefore", { month: last, day: cut })}
                      </span>
                    </span>
                  )}
                </div>
                <Card>
                  <ul className="m-0 flex flex-col p-0">
                    {shown.rows.map((r) => (
                      <CategoryBar
                        key={r.category}
                        category={r.category}
                        spent={r.spent}
                        max={scale}
                        marker={markers ? r.previousSpent : undefined}
                        note={
                          markers
                            ? cut === null
                              ? t("finances.report.value", { month: last, amount: money(r.previousSpent) })
                              : t("finances.spending.until", { month: last, day: cut, amount: money(r.previousSpent) })
                            : undefined
                        }
                        transactions={groups.get(r.category) ?? []}
                        month={month}
                        limit={limits[r.category]}
                        onEdit={setEditing}
                      />
                    ))}
                  </ul>
                </Card>
              </section>
            )}
            <LeftOutGroup transfers={view.transfers} savings={view.savings} income={view.income} upcoming={upcoming} onEdit={setEditing} />
          </>
        ))}
      {editing && <EditTransactionDialog tx={editing} save={edit} onClose={closed} />}
    </div>
  );
}
