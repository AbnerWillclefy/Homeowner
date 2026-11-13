import { Button, EmptyState, Skeleton } from "@homeowner/bedrock";
import { ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { useMediaQuery } from "../../shared/useMediaQuery";
import { addMonths, monthFromParam, monthLabel, saoPauloDay } from "../bills/logic/month";
import { BillDaysSheet } from "./components/BillDaysSheet";
import { CardBillCard } from "./components/CardBillCard";
import { useCardBills, useSaveBillDays } from "./hooks/useCardBills";
import { billRows } from "./logic/cardBill";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";

/** "Faturas" at `/card-bills` (`?month=YYYY-MM` picks the month): each card's bill, labelled by where its amount comes from, and the rows in it. */
export function CardBillsPage() {
  const { t, locale } = useI18n();
  const desktop = useMediaQuery(DESKTOP);
  const [params, setParams] = useSearchParams();
  const [now] = useState(() => new Date());
  const thisMonth = saoPauloDay(now).slice(0, 7);
  const month = monthFromParam(params.get("month"), thisMonth);
  const { bills, sources, transactions, loading, failed, rowsFailed, reload } = useCardBills(month);
  const saveDays = useSaveBillDays();
  const [editing, setEditing] = useState<string | null>(null); // a card's sourceId
  const label = monthLabel(month, locale);
  const step = (n: number) => setParams({ month: addMonths(month, n) });
  const editingSource = sources.find((s) => s.id === editing);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t("nav.cardBills")}</h1>
      <p className="text-text-muted">{t("cardBills.intro")}</p>

      <div role="group" aria-label={t("bills.month.group")} className="flex items-center justify-between gap-2">
        <Button variant="secondary" icon={ChevronLeft} onClick={() => step(-1)}>
          <span className="sr-only">{t("bills.month.prev")}</span>
        </Button>
        <p className="body-strong text-center" aria-live="polite">{label}</p>
        <Button variant="secondary" icon={ChevronRight} disabled={month === thisMonth} onClick={() => step(1)}>
          <span className="sr-only">{t("bills.month.next")}</span>
        </Button>
      </div>

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("cardBills.loading")}</span>
          {[0, 1].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : failed || !bills ? (
        <EmptyState icon={CreditCard} kind="no-results" title={t("cardBills.error.title")} message={t("cardBills.error.message")} action={{ label: t("bills.error.retry"), onClick: reload }} />
      ) : bills.length === 0 ? (
        <EmptyState icon={CreditCard} title={t("cardBills.empty.title")} message={t("cardBills.empty.message")} />
      ) : (
        <div className="flex flex-col gap-4">
          {bills.map((bill) => (
            <CardBillCard
              key={bill.sourceId}
              bill={bill}
              source={sources.find((s) => s.id === bill.sourceId)}
              rows={billRows(transactions, bill.sourceId, month)}
              rowsFailed={rowsFailed}
              monthName={label}
              desktop={desktop}
              onEditDays={() => setEditing(bill.sourceId)}
            />
          ))}
        </div>
      )}

      {editingSource && (
        <BillDaysSheet key={editingSource.id} card={editingSource} save={(c, d) => saveDays(editingSource.id, c, d)} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
