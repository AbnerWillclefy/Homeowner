import { Banner, Button, Dialog, EmptyState, Skeleton } from "@homeowner/bedrock";
import { CalendarCheck, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { useMediaQuery } from "../../shared/useMediaQuery";
import type { Bill, BillInput } from "./api";
import { BillFormSheet } from "./components/BillFormSheet";
import { BillsList, BillsTable } from "./components/BillRows";
import { BillSuggestions } from "./components/BillSuggestions";
import { BillSummary } from "./components/BillSummary";
import { CardBills } from "./components/CardBills";
import { useBills, useBillSuggestions, useCardBills } from "./hooks/useBills";
import { summarise } from "./logic/billState";
import { addMonths, monthFromParam, monthLabel, saoPauloDay } from "./logic/month";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";

type Open = { bill: Bill | null; initial?: BillInput; merchantKey?: string } | null;

/** "Contas a pagar" at `/bills` (a reminder opens it; `?month=YYYY-MM` picks the month). A past month is history: read-only. */
export function BillsPage() {
  const { t, locale } = useI18n();
  const desktop = useMediaQuery(DESKTOP);
  const [params, setParams] = useSearchParams();
  const [now] = useState(() => new Date());
  const today = saoPauloDay(now);
  const thisMonth = today.slice(0, 7);
  const month = monthFromParam(params.get("month"), thisMonth);
  const current = month === thisMonth;
  const { data, loading, failed, reload, notice, setPaid, save, remove } = useBills(month);
  const cards = useCardBills(month);
  const { suggestions, dismiss } = useBillSuggestions();
  const [form, setForm] = useState<Open>(null);
  const [deleting, setDeleting] = useState<Bill | null>(null);
  const [dismissFailed, setDismissFailed] = useState(false);

  const step = (n: number) => setParams({ month: addMonths(month, n) });
  const label = monthLabel(month, locale);
  const rows = data ? [...data].sort((a, b) => a.dueDate.localeCompare(b.dueDate)) : [];
  const List = desktop ? BillsTable : BillsList;

  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t("nav.bills")}</h1>

      <div role="group" aria-label={t("bills.month.group")} className="flex items-center justify-between gap-2">
        <Button variant="secondary" icon={ChevronLeft} onClick={() => step(-1)}>
          <span className="sr-only">{t("bills.month.prev")}</span>
        </Button>
        <p className="body-strong text-center" aria-live="polite">{label}</p>
        <Button variant="secondary" icon={ChevronRight} disabled={current} onClick={() => step(1)}>
          <span className="sr-only">{t("bills.month.next")}</span>
        </Button>
      </div>

      {(notice || dismissFailed) && <Banner tone="danger">{t(notice === "gone" ? "bills.gone" : "bills.failed")}</Banner>}

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("bills.loading")}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : failed || !data ? (
        <EmptyState icon={CalendarCheck} kind="no-results" title={t("bills.error.title")} message={t("bills.error.message")} action={{ label: t("bills.error.retry"), onClick: reload }} />
      ) : (
        <>
          {current && (
            <BillSuggestions
              suggestions={suggestions}
              onAdd={(s) => setForm({ bill: null, initial: { name: s.name, expectedCents: s.amountCents, dueDay: s.dueDay }, merchantKey: s.merchantKey })}
              onDismiss={(s) => void dismiss(s).then((ok) => setDismissFailed(!ok))}
            />
          )}
          {rows.length === 0 ? (
            <EmptyState icon={CalendarCheck} title={t("bills.empty.title")} message={t(current ? "bills.empty.message" : "bills.empty.past")} />
          ) : (
            <>
              <BillSummary {...summarise(rows)} />
              <List rows={rows} caption={t("bills.caption", { month: label })} today={current ? today : null} onPaid={(b, paid) => void setPaid(b, paid)} onEdit={(bill) => setForm({ bill })} onDelete={setDeleting} />
            </>
          )}
          {current && (
            <Button variant="secondary" icon={Plus} onClick={() => setForm({ bill: null })}>
              {t("bills.add")}
            </Button>
          )}
          <CardBills cards={cards} />
        </>
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
