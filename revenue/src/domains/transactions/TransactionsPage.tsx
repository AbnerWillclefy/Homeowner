import { Banner, Card, EmptyState, Skeleton } from "@homeowner/bedrock";
import { Receipt, SearchX } from "lucide-react";
import { useState } from "react";
import { HideValuesToggle } from "../../shared/HideValues";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { MonthSelect } from "../../shared/month/MonthSelect";
import { monthLabel } from "../../shared/month/month";
import { useMonthParam } from "../../shared/month/useMonthParam";
import { PageHeader } from "../../shared/PageHeader";
import { useMediaQuery } from "../../shared/useMediaQuery";
import type { Transaction } from "./api";
import { EditSheet } from "./components/EditSheet";
import { Toolbar } from "./components/Toolbar";
import { TotalsRow } from "./components/TotalsRow";
import { TransactionsList, TransactionsTable } from "./components/TransactionRows";
import { useTransactions } from "./hooks/useTransactions";
import { filterRows, isFiltered, NO_FILTER } from "./logic/filter";
import { sourceCount, totalsOf } from "./logic/totals";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";

export function TransactionsPage() {
  const { t, locale } = useI18n();
  const desktop = useMediaQuery(DESKTOP);
  const { month } = useMonthParam();
  const { data, loading, failed, reload, notice, edit } = useTransactions(month);
  const [filter, setFilter] = useState(NO_FILTER);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const label = monthLabel(month, locale);
  const all = data?.transactions ?? [];
  const rows = filterRows(all, filter);
  const totals = totalsOf(all);
  const plural = (key: "tx.count" | "tx.sources", n: number) => t(n === 1 ? `${key}.one` : `${key}.other`, { n });
  const subtitle = data && all.length > 0 ? t("tx.subtitle", { month: label, count: plural("tx.count", all.length), sources: plural("tx.sources", sourceCount(all)) }) : label;
  const clear = () => setFilter(NO_FILTER);
  const List = desktop ? TransactionsTable : TransactionsList;
  const Wrap = desktop ? Card : "div";

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("nav.transactions")} subtitle={subtitle} tools={<><MonthSelect /><HideValuesToggle /></>} />

      {notice && <Banner tone="danger">{t(notice === "gone" ? "tx.edit.gone" : "tx.edit.failed")}</Banner>}

      <div className="grid gap-6 desktop:grid-cols-12">
        {desktop && data && all.length > 0 && (
          <TotalsRow totals={totals} reviewing={filter.uncategorised} onReview={() => setFilter({ ...filter, ...(filter.uncategorised ? { uncategorised: false } : { uncategorised: true, type: "all", category: "all" }) })} />
        )}
        <Wrap className="desktop:col-span-12 flex flex-col gap-4">
          {loading ? (
            <div role="status" className="flex flex-col gap-4">
              <span className="sr-only">{t("tx.loading")}</span>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : failed || !data ? (
            <EmptyState icon={Receipt} kind="no-results" title={t("tx.error.title")} message={t("tx.error.message")} action={{ label: t("tx.error.retry"), onClick: reload }} />
          ) : all.length === 0 ? (
            <EmptyState icon={Receipt} title={t("tx.empty.title")} message={t("tx.empty.message")} />
          ) : (
            <>
              <Toolbar filter={filter} onChange={setFilter} desktop={desktop} uncategorised={totals.uncategorised} />
              {(desktop || isFiltered(filter)) && (
                <p className="body flex flex-wrap items-center justify-between gap-2 text-text-muted" role="status">
                  <span>{t("tx.result", { n: rows.length, total: all.length })}</span>
                  {isFiltered(filter) && (
                    <button type="button" onClick={clear} className="touch-target body-strong cursor-pointer rounded-sm text-brand outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                      {t("tx.clearAll")}
                    </button>
                  )}
                </p>
              )}
              {rows.length === 0 ? (
                <EmptyState icon={SearchX} kind="no-results" title={t("tx.noResults.title")} message={t("tx.noResults.message")} action={{ label: t("tx.noResults.clear"), onClick: clear }} />
              ) : (
                <List rows={rows} caption={t("tx.caption", { month: label })} onEdit={setEditing} />
              )}
            </>
          )}
        </Wrap>
      </div>

      {editing && <EditSheet key={editing.id} tx={editing} onSave={(body) => void edit(editing, body)} onClose={() => setEditing(null)} />}
    </section>
  );
}
