import { Banner, Button, EmptyState, Select, Skeleton } from "@homeowner/bedrock";
import { ChevronLeft, ChevronRight, Receipt, SearchX } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { useMediaQuery } from "../../shared/useMediaQuery";
import { TYPES, type Transaction } from "./api";
import { EditSheet } from "./components/EditSheet";
import { TransactionsList, TransactionsTable } from "./components/TransactionRows";
import { useTransactions } from "./hooks/useTransactions";
import { SPENDING_CATEGORIES, spendingKey } from "./logic/categories";
import { filterRows, type Filter } from "./logic/filter";
import { addMonths, currentMonth, monthFromParam, monthLabel } from "./logic/month";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";
const ALL: Filter = { type: "all", category: "all" };

export function TransactionsPage() {
  const { t, locale } = useI18n();
  const desktop = useMediaQuery(DESKTOP);
  const [params, setParams] = useSearchParams();
  const thisMonth = currentMonth(new Date());
  const month = monthFromParam(params.get("month"), thisMonth);
  const { data, loading, failed, reload, notice, edit } = useTransactions(month);
  const [filter, setFilter] = useState<Filter>(ALL);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const step = (n: number) => setParams({ month: addMonths(month, n) });
  const label = monthLabel(month, locale);
  const caption = t("tx.caption", { month: label });
  const rows = data ? filterRows(data.transactions, filter) : [];
  const List = desktop ? TransactionsTable : TransactionsList;

  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t("nav.transactions")}</h1>

      <div role="group" aria-label={t("tx.month.group")} className="flex items-center justify-between gap-2">
        <Button variant="secondary" icon={ChevronLeft} onClick={() => step(-1)}>
          <span className="sr-only">{t("tx.month.prev")}</span>
        </Button>
        <p className="body-strong text-center" aria-live="polite">{label}</p>
        <Button variant="secondary" icon={ChevronRight} disabled={month >= thisMonth} onClick={() => step(1)}>
          <span className="sr-only">{t("tx.month.next")}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
        <Select
          label={t("tx.filter.type")}
          value={filter.type}
          onValueChange={(v) => setFilter({ ...filter, type: v as Filter["type"] })}
          options={[{ value: "all", label: t("tx.filter.all") }, ...TYPES.map((v) => ({ value: v, label: t(`tx.type.${v}`) }))]}
        />
        <Select
          label={t("tx.filter.category")}
          value={filter.category}
          onValueChange={(v) => setFilter({ ...filter, category: v as Filter["category"] })}
          options={[{ value: "all", label: t("tx.filter.allCategories") }, ...SPENDING_CATEGORIES.map((id) => ({ value: id, label: t(spendingKey(id)) }))]}
        />
      </div>

      {notice && <Banner tone="danger">{t(notice === "gone" ? "tx.edit.gone" : "tx.edit.failed")}</Banner>}

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("tx.loading")}</span>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : failed || !data ? (
        <EmptyState icon={Receipt} kind="no-results" title={t("tx.error.title")} message={t("tx.error.message")} action={{ label: t("tx.error.retry"), onClick: reload }} />
      ) : data.transactions.length === 0 ? (
        <EmptyState icon={Receipt} title={t("tx.empty.title")} message={t("tx.empty.message")} />
      ) : rows.length === 0 ? (
        <EmptyState icon={SearchX} kind="no-results" title={t("tx.noResults.title")} message={t("tx.noResults.message")} action={{ label: t("tx.noResults.clear"), onClick: () => setFilter(ALL) }} />
      ) : (
        <List rows={rows} caption={caption} onEdit={setEditing} />
      )}

      {editing && <EditSheet key={editing.id} tx={editing} onSave={(body) => void edit(editing, body)} onClose={() => setEditing(null)} />}
    </section>
  );
}
