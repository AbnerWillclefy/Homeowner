import { useId, useMemo, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import { StatTile } from "../../../shared/ui/StatTile";
import type { Transaction } from "../api/api";
import { useMonth, type EditOutcome } from "../hooks/useMonth";
import { difference } from "../logic/difference";
import { formatCents } from "../logic/money";
import { addMonths, currentMonth, monthLabel, monthName } from "../logic/month";
import { monthView } from "../logic/monthView";
import { categoryRows, sameDays, uncategorised } from "../logic/sameDays";
import { CategoryBar } from "./CategoryBar";
import { EditTransactionDialog } from "./EditTransactionDialog";
import { LeftOutGroup } from "./LeftOutGroup";
import { MonthPicker } from "./MonthPicker";
import { UncategorisedCard } from "./UncategorisedCard";

/**
 * Gastos: the month's spending against the same days of the month before, built from the two cached months. While
 * the previous month loads or fails there is no comparison and no markers, never a wrong "a mais".
 */
export function Spending() {
  const { t, locale } = useI18n();
  const today = new Date(); // each render, so a resumed app cuts last month at the device's day, not the mount day
  const thisMonth = currentMonth(today);
  const [month, setMonth] = useState(thisMonth);
  const previousMonth = addMonths(month, -1);
  const { state, refreshing, reload, edit } = useMonth(month);
  const previous = useMonth(previousMonth);
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing || previous.refreshing);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [gone, setGone] = useState(false);
  const listId = useId();

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

  function go(n: number) {
    setGone(false);
    setMonth(addMonths(month, n));
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
  const groups = new Map(view?.categories.map((g) => [g.category, g.transactions]));

  return (
    // No outer card: the bars inside get the full width, which they need at the largest text.
    <div className="flex flex-col gap-3">
      <MonthPicker
        month={month}
        today={thisMonth}
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
        (empty ? (
          <p className="my-0 text-muted">{t("finances.month.empty")}</p>
        ) : (
          <>
            <StatTile
              value={money(compared?.spent ?? view.spentCents)}
              label={
                <>
                  {t("finances.month.spent", { month: monthLabel(month, locale) })}
                  {comparison && <span className="block font-normal text-muted">{comparison}</span>}
                </>
              }
            />
            <UncategorisedCard rows={missing} onEdit={setEditing} />
            {shown && shown.rows.length > 0 && (
              <Card as="section" aria-labelledby={listId} className="mt-0 flex flex-col gap-4">
                <h4 id={listId} className="m-0 text-base font-bold leading-snug">
                  {t("finances.spending.byCategory")}
                </h4>
                <ul className="m-0 flex flex-col gap-4 p-0">
                  {shown.rows.map((r) => (
                    <CategoryBar
                      key={r.category}
                      category={r.category}
                      spent={r.spent}
                      max={shown.max}
                      marker={markers ? r.previousSpent : undefined}
                      note={
                        markers
                          ? cut === null
                            ? t("finances.report.value", { month: last, amount: money(r.previousSpent) })
                            : t("finances.spending.until", { month: last, day: cut, amount: money(r.previousSpent) })
                          : undefined
                      }
                      transactions={groups.get(r.category) ?? []}
                      onEdit={setEditing}
                    />
                  ))}
                </ul>
              </Card>
            )}
            <LeftOutGroup transfers={view.transfers} income={view.income} onEdit={setEditing} />
          </>
        ))}
      {editing && <EditTransactionDialog tx={editing} save={edit} onClose={closed} />}
    </div>
  );
}
