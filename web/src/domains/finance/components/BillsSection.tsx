import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { FormError } from "../../../shared/ui/FormError";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import type { Bill, BillSuggestion } from "../api/api";
import { useBillSuggestions } from "../hooks/useBillSuggestions";
import { useBills } from "../hooks/useBills";
import { billGroups } from "../logic/billGroups";
import { useFinanceMonth } from "../hooks/useFinanceMonth";
import { currentDay, monthName } from "../logic/month";
import { BillFormDialog } from "./BillFormDialog";
import { BillRow } from "./BillRow";
import { BillSuggestions } from "./BillSuggestions";
import { BillSummary } from "./BillSummary";
import { DeleteBillDialog } from "./DeleteBillDialog";
import { DueStrip } from "./DueStrip";
import { MonthPicker } from "./MonthPicker";

// `opener` is the "⋯" button focus returns to on close; null when the dialog's opener keeps focus itself.
type Open = { kind: "form"; bill: Bill | null; opener: HTMLElement | null; suggestion?: BillSuggestion } | { kind: "delete"; bill: Bill; opener: HTMLElement | null } | null;

const GROUPS = ["overdue", "due", "paid"] as const;

/**
 * "Contas a pagar": a month picker, paid against still to pay, the due dates, then the month's Bills in groups, with add,
 * edit, delete and the paid mark. A past month is history: read-only, no today, and `current` (Próximos meses) is left out.
 */
export function BillsSection({ current, picker = false }: { current?: ReactNode; picker?: boolean }) {
  const { t, locale } = useI18n();
  const [now] = useState(() => new Date());
  const { month, thisMonth } = useFinanceMonth();
  const isCurrent = month === thisMonth;
  const today = isCurrent ? currentDay(now) : null;
  const { state, refreshing, reload, save, remove, setPaid } = useBills(month);
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing);
  const { suggestions, dismiss } = useBillSuggestions();
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function mark(bill: Bill, paid: boolean) {
    setBusy(bill.id);
    setFailed(false);
    if ((await setPaid(bill.id, paid)).kind !== "ok") setFailed(true);
    setBusy(null);
  }

  const groups = state.kind === "ready" ? billGroups(state.data, today) : null;

  return (
    <>
    <section aria-labelledby="finances-bills-heading" className="mt-0 flex flex-col gap-4">
      {/* In the tab the month picker is above, shared by every view; the setup flow has its own. */}
      <h3 id="finances-bills-heading" className={picker ? "my-0 text-lg font-bold leading-snug [overflow-wrap:anywhere]" : "sr-only"}>
        {t("finances.bills.heading")}
      </h3>
      {picker && <MonthPicker groupLabel={t("finances.bills.month.heading")} />}
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
          {isCurrent && (
            <BillSuggestions
              suggestions={suggestions}
              dismiss={dismiss}
              onAdd={(suggestion) => setOpen({ kind: "form", bill: null, opener: null, suggestion })}
            />
          )}
          {state.data.length === 0 ? (
            <p className="my-0 text-muted">{t(isCurrent ? "finances.bills.empty" : "finances.bills.past.empty")}</p>
          ) : (
            <>
              <Card as="section" aria-labelledby="finances-bills-month" className="mt-0 flex flex-col gap-3">
                <h4 id="finances-bills-month" className="my-0 text-lg font-bold leading-snug">
                  {t("finances.bills.month.title", { month: monthName(month, locale) })}
                </h4>
                <BillSummary paidCents={groups.paidCents} toPayCents={groups.toPayCents} toPayCount={groups.overdue.bills.length + groups.due.bills.length} />
                <DueStrip bills={state.data} month={month} today={today} />
              </Card>
              {GROUPS.filter((g) => groups[g].bills.length > 0).map((g) => (
                <section key={g} aria-labelledby={`finances-bills-${g}`} className="mt-2 flex flex-col gap-2">
                  <h4 id={`finances-bills-${g}`} className="my-0 text-xl font-bold leading-snug">
                    {t(g === "due" && !isCurrent ? "finances.bills.group.unpaid" : `finances.bills.group.${g}`)}{" "}
                    <span className="font-semibold text-muted">{groups[g].bills.length}</span>
                  </h4>
                  <Card>
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
                  </Card>
                </section>
              ))}
            </>
          )}
          {isCurrent && (
            <Button variant="secondary" fullWidth leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => setOpen({ kind: "form", bill: null, opener: null })}>
              {t("finances.bills.add")}
            </Button>
          )}
        </>
      )}
      {open?.kind === "form" && (
        <BillFormDialog
          bill={open.bill}
          returnFocusRef={{ current: open.opener }}
          initial={open.suggestion && { name: open.suggestion.name, expectedCents: open.suggestion.amountCents, dueDay: open.suggestion.dueDay }}
          save={async (input) => {
            const outcome = await save(open.bill?.id ?? null, input);
            // Best-effort: an edited name could make the server suggest the merchant again.
            if (outcome.kind === "ok" && open.suggestion) await dismiss(open.suggestion.merchantKey);
            return outcome;
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {open?.kind === "delete" && <DeleteBillDialog bill={open.bill} returnFocusRef={{ current: open.opener }} remove={remove} onClose={() => setOpen(null)} />}
    </section>
    {isCurrent && current}
    </>
  );
}
