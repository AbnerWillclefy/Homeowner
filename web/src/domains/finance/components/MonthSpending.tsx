import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import { StatTile } from "../../../shared/ui/StatTile";
import type { Transaction } from "../api/api";
import { useMonth, type EditOutcome } from "../hooks/useMonth";
import { formatCents } from "../logic/money";
import { addMonths, currentMonth, monthLabel } from "../logic/month";
import { monthView } from "../logic/monthView";
import { CategoryCard } from "./CategoryCard";
import { EditTransactionDialog } from "./EditTransactionDialog";
import { LeftOutGroup } from "./LeftOutGroup";

/** The month's spending by Spending Category, with a month picker and a Transaction edit. Shown once there are Sources. */
export function MonthSpending() {
  const { t, locale } = useI18n();
  const [today] = useState(() => currentMonth(new Date()));
  const [month, setMonth] = useState(today);
  const { state, refreshing, reload, edit } = useMonth(month);
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [gone, setGone] = useState(false);
  const view = useMemo(() => (state.kind === "ready" ? monthView(state.data) : null), [state]);

  function closed(outcome: EditOutcome | "cancelled") {
    setEditing(null);
    setGone(outcome === "gone");
  }

  function go(n: number) {
    setGone(false);
    setMonth(addMonths(month, n));
  }

  const label = monthLabel(month, locale);
  return (
    // No outer card: the category cards inside it get the full width, which they need at the largest text.
    <section aria-labelledby="finances-month-heading" className="mt-0 flex flex-col gap-3">
      <h3 id="finances-month-heading" className="my-0 text-lg font-bold leading-snug [overflow-wrap:anywhere]">
        {t("finances.month.heading")}
      </h3>
      {/* The month on its own line, so the two buttons never squeeze it into one letter per line. */}
      <div role="group" aria-label={t("finances.month.heading")} className="flex flex-col gap-2">
        <span className="text-center font-semibold capitalize [overflow-wrap:anywhere]" aria-live="polite">
          {label}
        </span>
        <div className="flex items-center justify-between gap-2">
        <Button
          icon
          variant="secondary"
          aria-label={t("finances.month.prev")}
          onClick={() => go(-1)}
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </Button>
        <Button
          icon
          variant="secondary"
          aria-label={t("finances.month.next")}
          disabled={month >= today}
          onClick={() => go(1)}
        >
          <ChevronRight aria-hidden="true" size={20} />
        </Button>
        </div>
      </div>

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
          <p className="my-0 text-muted">{t("finances.month.empty")}</p>
        ) : (
          <>
            <StatTile value={formatCents(view.spentCents, locale)} label={t("finances.month.spent", { month: label })} />
            {view.categories.map((group) => (
              <CategoryCard key={group.category} group={group} onEdit={setEditing} />
            ))}
            <LeftOutGroup title={t("finances.month.transfers")} rows={view.transfers} onEdit={setEditing} />
            <LeftOutGroup title={t("finances.month.income")} rows={view.income} onEdit={setEditing} />
          </>
        ))}
      {editing && <EditTransactionDialog tx={editing} save={edit} onClose={closed} />}
    </section>
  );
}
