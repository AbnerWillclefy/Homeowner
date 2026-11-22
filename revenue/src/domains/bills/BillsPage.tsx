import { Banner, Card, Dialog, EmptyState, Skeleton, SegmentedControl } from "@homeowner/bedrock";
import { formatAmount } from "@homeowner/bedrock/finance";
import { CalendarCheck, Plus } from "lucide-react";
import { useState } from "react";
import { useHideValues } from "../../shared/HideValues";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { addMonths, monthLabel } from "../../shared/month/month";
import { useMonthParam } from "../../shared/month/useMonthParam";
import { PageHeader } from "../../shared/PageHeader";
import type { Bill, BillInput } from "./api";
import { BillFormSheet } from "./components/BillFormSheet";
import { BillRows, NextMonthRows } from "./components/BillRows";
import { BillSuggestions } from "./components/BillSuggestions";
import { BillSummary } from "./components/BillSummary";
import { useBills, useBillSuggestions, useNextMonthBills } from "./hooks/useBills";
import { filterBills, summarise, type StatusFilter } from "./logic/billState";

const FILTERS = ["all", "pending", "paid"] as const;

type Open = { bill: Bill | null; initial?: BillInput; merchantKey?: string } | null;

/** "Contas a pagar" at `/bills` (a reminder opens it; `?month=YYYY-MM` picks the month). A past month is history: read-only. */
export function BillsPage() {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  const { month, thisMonth, today: day } = useMonthParam();
  const current = month === thisMonth;
  const today = current ? day : null;
  const { data, loading, failed, reload, notice, setPaid, save, remove } = useBills(month);
  const next = addMonths(month, 1);
  const nextRows = useNextMonthBills(next, current);
  const { suggestions, dismiss } = useBillSuggestions();
  const [form, setForm] = useState<Open>(null);
  const [deleting, setDeleting] = useState<Bill | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [dismissFailed, setDismissFailed] = useState<string | null>(null); // the month the dismissal failed in
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const label = monthLabel(month, locale);
  const rows = data ? [...data].sort((a, b) => a.dueDate.localeCompare(b.dueDate)) : [];
  const summary = summarise(rows);
  const shown = filterBills(rows, filter, today);
  const count = t(rows.length === 1 ? "bills.count.one" : "bills.count.many", { count: rows.length });
  // The total is money in a string, so a hidden one leaves it out.
  const subtitle = data && [label, count, ...(hidden || rows.length === 0 ? [] : [formatAmount(summary.paidCents + summary.toPayCents, { locale })])].join(" · ");
  const onPaid = (b: Bill, paid: boolean) => {
    setBusy((s) => new Set(s).add(b.id));
    setDismissFailed(null);
    void setPaid(b, paid).finally(() => setBusy((s) => { const n = new Set(s); n.delete(b.id); return n; }));
  };

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.bills")}
        subtitle={subtitle}
        month
        hideValues
        action={current ? { label: t("bills.add"), icon: Plus, onClick: () => setForm({ bill: null }) } : undefined}
      />

      {(notice || dismissFailed === month) && (
        <Banner tone="danger">{t(notice === "gone" ? "bills.gone" : notice ? "bills.failed" : "bills.suggestions.dismissFailed")}</Banner>
      )}

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("bills.loading")}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : failed || !data ? (
        <EmptyState icon={CalendarCheck} kind="no-results" title={t("bills.error.title")} message={t("bills.error.message")} action={{ label: t("bills.error.retry"), onClick: reload }} />
      ) : (
        <div className="grid gap-6 desktop:grid-cols-12">
          <Card className="desktop:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-title">{current ? t("bills.thisMonth") : label}</h2>
              {rows.length > 0 && (
                <SegmentedControl label={t("bills.filter.label")} options={FILTERS.map((f) => ({ value: f, label: t(`bills.filter.${f}`) }))} value={filter} onValueChange={(v) => setFilter(v as StatusFilter)} />
              )}
            </div>
            {rows.length === 0 ? (
              <EmptyState icon={CalendarCheck} title={t("bills.empty.title")} message={t(current ? "bills.empty.message" : "bills.empty.past")} />
            ) : shown.length === 0 ? (
              <p className="body text-text-muted">{t(filter === "paid" ? "bills.filter.emptyPaid" : "bills.filter.emptyPending")}</p>
            ) : (
              <BillRows rows={shown} caption={t("bills.caption", { month: label })} today={today} busy={busy} onPaid={onPaid} onEdit={(bill) => setForm({ bill })} onDelete={setDeleting} />
            )}
            {nextRows.length > 0 && (
              <>
                <hr className="border-border" />
                <h3 className="body-strong">{monthLabel(next, locale)}</h3>
                <NextMonthRows rows={[...nextRows].sort((a, b) => a.dueDate.localeCompare(b.dueDate))} caption={t("bills.caption", { month: monthLabel(next, locale) })} />
              </>
            )}
          </Card>

          {/* Below 1024px the column dissolves, so the summary leads the page and the suggestions close it. */}
          <div className="max-desktop:contents desktop:col-span-4 desktop:flex desktop:flex-col desktop:gap-6">
            {rows.length > 0 && <div className="max-desktop:order-first"><BillSummary {...summary} month={label} /></div>}
            {current && (
              <BillSuggestions
                suggestions={suggestions}
                onAdd={(s) => setForm({ bill: null, initial: { name: s.name, expectedCents: s.amountCents, dueDay: s.dueDay }, merchantKey: s.merchantKey })}
                onDismiss={(s) => void dismiss(s).then((ok) => setDismissFailed(ok ? null : month))}
              />
            )}
          </div>
        </div>
      )}

      {form && (
        <BillFormSheet
          key={form.bill?.id ?? form.merchantKey ?? "new"}
          bill={form.bill}
          initial={form.initial}
          save={async (input) => {
            const outcome = await save(form.bill?.id ?? null, input);
            // Best-effort: an edited name could make the server suggest the merchant again.
            const s = suggestions.find((x) => x.merchantKey === form.merchantKey);
            if (outcome.kind === "ok" && s) await dismiss(s);
            return outcome;
          }}
          onClose={() => setForm(null)}
        />
      )}
      {deleting && (
        <Dialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t("bills.delete.title")}
          description={t("bills.delete.body", { name: deleting.name })}
          cancelLabel={t("bills.form.cancel")}
          confirmLabel={t("bills.delete")}
          onConfirm={() => void remove(deleting.id)}
        />
      )}
    </section>
  );
}
