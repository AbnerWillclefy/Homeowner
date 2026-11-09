import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { FormError } from "../../../shared/ui/FormError";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import type { Bill } from "../api/api";
import { useBills } from "../hooks/useBills";
import { billGroups } from "../logic/billGroups";
import { formatCents } from "../logic/money";
import { addMonths, currentDay, currentMonth } from "../logic/month";
import { BillFormDialog } from "./BillFormDialog";
import { BillRow } from "./BillRow";
import { BillSummary } from "./BillSummary";
import { DeleteBillDialog } from "./DeleteBillDialog";
import { DueStrip } from "./DueStrip";
import { MonthPicker } from "./MonthPicker";

// `opener` is the "⋯" button focus returns to on close; null when the dialog's opener keeps focus itself.
type Open = { kind: "form"; bill: Bill | null; opener: HTMLElement | null } | { kind: "delete"; bill: Bill; opener: HTMLElement | null } | null;

const GROUPS = ["overdue", "due", "paid"] as const;

/**
 * "Contas a pagar": a month picker, paid against still to pay, the due dates, then the month's Bills in groups, with add,
 * edit, delete and the paid mark. A past month is history: read-only, no today, and `current` (Próximos meses) is left out.
 */
export function BillsSection({ current }: { current?: ReactNode }) {
  const { t, locale } = useI18n();
  const [now] = useState(() => new Date());
  const thisMonth = currentMonth(now);
  const [month, setMonth] = useState(thisMonth);
  const isCurrent = month === thisMonth;
  const today = isCurrent ? currentDay(now) : null;
  const { state, refreshing, reload, save, remove, setPaid } = useBills(month);
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function mark(bill: Bill, paid: boolean) {
    setBusy(bill.id);
    setFailed(false);
    if ((await setPaid(bill.id, paid)).kind !== "ok") setFailed(true);
    setBusy(null);
  }

  function go(n: number) {
    setOpen(null);
    setFailed(false);
    setMonth(addMonths(month, n));
  }

  const groups = state.kind === "ready" ? billGroups(state.data, today) : null;

  return (
    <>
    <section aria-labelledby="finances-bills-heading" className="mt-0 flex flex-col gap-3">
      <h3 id="finances-bills-heading" className="my-0 text-lg font-bold leading-snug [overflow-wrap:anywhere]">
        {t("finances.bills.heading")}
      </h3>
      <MonthPicker
        month={month}
        today={thisMonth}
        groupLabel={t("finances.bills.month.heading")}
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
            {t("finances.bills.load.failed")}
          </p>
          <Button variant="secondary" onClick={() => void reload()}>
            {t("finances.load.retry")}
          </Button>
        </div>
      )}
      {/* Mounted only on a failure, so the tab has no second empty alert beside the connect flow's own. */}
      {failed && <FormError form="finances-bills">{t("finances.bills.failed")}</FormError>}
      {state.kind === "ready" && groups && (
        <>
          {state.data.length === 0 ? (
            <p className="my-0 text-muted">{t(isCurrent ? "finances.bills.empty" : "finances.bills.past.empty")}</p>
          ) : (
            <>
              <Card className="flex flex-col gap-4">
                <BillSummary paidCents={groups.paidCents} toPayCents={groups.toPayCents} />
                <DueStrip bills={state.data} month={month} today={today} />
              </Card>
              {GROUPS.filter((g) => groups[g].bills.length > 0).map((g) => (
                <section key={g} aria-labelledby={`finances-bills-${g}`} className="flex flex-col">
                  <h4 id={`finances-bills-${g}`} className="my-0 flex flex-wrap justify-between gap-x-3 text-base font-bold leading-snug">
                    <span>{t(g === "due" && !isCurrent ? "finances.bills.group.unpaid" : `finances.bills.group.${g}`)}</span>
                    <span>{formatCents(groups[g].totalCents, locale)}</span>
                  </h4>
                  <ul className="m-0 flex list-none flex-col p-0">
                    {groups[g].bills.map((bill) => (
                      <BillRow
                        key={bill.id}
                        bill={bill}
                        today={today}
                        readOnly={!isCurrent}
                        busy={busy === bill.id}
                        onPaid={(paid) => void mark(bill, paid)}
                        onEdit={(opener) => setOpen({ kind: "form", bill, opener })}
                        onDelete={(opener) => setOpen({ kind: "delete", bill, opener })}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
          {isCurrent && (
            <Button variant="secondary" leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => setOpen({ kind: "form", bill: null, opener: null })}>
              {t("finances.bills.add")}
            </Button>
          )}
        </>
      )}
      {open?.kind === "form" && (
        <BillFormDialog
          bill={open.bill}
          returnFocusRef={{ current: open.opener }}
          save={(input) => save(open.bill?.id ?? null, input)}
          onClose={() => setOpen(null)}
        />
      )}
      {open?.kind === "delete" && <DeleteBillDialog bill={open.bill} returnFocusRef={{ current: open.opener }} remove={remove} onClose={() => setOpen(null)} />}
    </section>
    {isCurrent && current}
    </>
  );
}
