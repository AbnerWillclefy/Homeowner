import { EmptyState, SegmentedControl, Skeleton } from "@homeowner/bedrock";
import { formatAmount } from "@homeowner/bedrock/finance";
import { CreditCard } from "lucide-react";
import { useSearchParams } from "react-router";
import { useHideValues } from "../../shared/HideValues";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { monthLabel } from "../../shared/month/month";
import { useMonthParam } from "../../shared/month/useMonthParam";
import { PageHeader } from "../../shared/PageHeader";
import { useMediaQuery } from "../../shared/useMediaQuery";
import { BillDaysCard } from "./components/BillDaysCard";
import { BillHistory } from "./components/BillHistory";
import { CardBillCard } from "./components/CardBillCard";
import { CardRows } from "./components/CardRows";
import { useCardBills, usePastBills, useSaveBillDays } from "./hooks/useCardBills";
import { billRows, pickCard } from "./logic/cardBill";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";

/** "Faturas" at `/card-bills`: one card's bill at a time (`?card=<sourceId>`, the first by default; `?month=YYYY-MM` picks the month). */
export function CardBillsPage() {
  const { t, locale } = useI18n();
  const desktop = useMediaQuery(DESKTOP);
  const { hidden } = useHideValues();
  const [params, setParams] = useSearchParams();
  const { month } = useMonthParam();
  const { bills, sources, transactions, loading, failed, rowsFailed, reload } = useCardBills(month);
  const saveDays = useSaveBillDays();
  const bill = pickCard(bills ?? [], params.get("card"));
  const source = sources.find((s) => s.id === bill?.sourceId);
  const rows = bill && !rowsFailed ? billRows(transactions, bill, month) : null;
  const history = usePastBills(bill?.sourceId);

  const open = (bills ?? []).filter((b) => !b.fromBank && !b.closed);
  const count = bills?.length ?? 0;
  const subtitle = bills && bills.length > 0
    ? [
        t(count === 1 ? "cardBills.subtitle.one" : "cardBills.subtitle.many", { count }),
        // The total is money in a string, so a hidden one leaves it out.
        ...(hidden || open.length === 0 ? [] : [t("cardBills.subtitle.open", { total: formatAmount(open.reduce((n, b) => n + b.amountCents, 0), { locale }) })]),
      ].join(" · ")
    : undefined;
  const pick = (sourceId: string) => setParams((old) => { const next = new URLSearchParams(old); next.set("card", sourceId); return next; }, { replace: true });
  const cards = bills && bills.length > 1 && bill && (
    <SegmentedControl label={t("cardBills.card.group")} options={bills.map((b) => ({ value: b.sourceId, label: b.name }))} value={bill.sourceId} onValueChange={pick} />
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.cardBills")}
        subtitle={subtitle}
        month
        hideValues
        tools={desktop && cards}
      />
      {!desktop && cards}

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("cardBills.loading")}</span>
          {[0, 1].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : failed || !bills ? (
        <EmptyState icon={CreditCard} kind="no-results" title={t("cardBills.error.title")} message={t("cardBills.error.message")} action={{ label: t("bills.error.retry"), onClick: reload }} />
      ) : !bill ? (
        <EmptyState icon={CreditCard} title={t("cardBills.empty.title")} message={t("cardBills.empty.message")} />
      ) : (
        <div className="grid gap-6 desktop:grid-cols-12">
          <div className="flex flex-col gap-6 desktop:col-span-8">
            <CardBillCard bill={bill} source={source} rows={rows} />
            <CardRows rows={rows} caption={t("cardBills.rows.caption", { name: bill.name, month: monthLabel(month, locale) })} />
          </div>
          <div className="flex flex-col gap-6 desktop:col-span-4">
            <BillHistory {...history} />
            {source && <BillDaysCard key={source.id} card={source} save={(c, d) => saveDays(source.id, c, d)} />}
          </div>
        </div>
      )}
    </section>
  );
}
