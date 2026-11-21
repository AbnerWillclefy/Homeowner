import { Button, Card, EmptyState, Sheet, Skeleton } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { ChevronLeft, Pencil, Tags } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useHiddenProps } from "../../shared/HideValues";
import { ScreenPlaceholder } from "../../shared/ScreenPlaceholder";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { formatDay } from "../../shared/month/month";
import { useMonthParam } from "../../shared/month/useMonthParam";
import { PageHeader } from "../../shared/PageHeader";
import { CategoryHistory } from "./components/CategoryHistory";
import { LimitBar } from "./components/LimitBar";
import { LimitForm } from "./components/LimitForm";
import { useHistory, useLimit, useSpending } from "./hooks/useCategories";
import { spendingKey, type SpendingCategory } from "./logic/categories";
import { categoryOf } from "./logic/route";
import { ofCategory } from "./logic/uncategorised";

/** `/categories/:category`. An id that is not a Spending Category is "not found", never a crash. */
export function CategoryPage() {
  const category = categoryOf(useParams().category);
  return category === null ? <ScreenPlaceholder titleKey="page.notFound" /> : <Detail category={category} />;
}

/**
 * One Spending Category: what it took against its limit and its Transactions, with the months before beside them.
 * The limit is set in a sheet from the header, as it changes rarely. History is its own read, so it can fail alone.
 */
function Detail({ category }: { category: SpendingCategory }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const { search } = useLocation();
  const [editing, setEditing] = useState(false);
  const { month } = useMonthParam();
  const spending = useSpending(month);
  const history = useHistory(month);
  const setLimit = useLimit(month);
  const name = t(spendingKey(category));
  const limit = spending.data?.limits[category];
  const spent = spending.data?.categories.find((c) => c.category === category)?.spentCents ?? 0;
  const rows = spending.data ? ofCategory(spending.data.transactions, category) : [];

  return (
    <section className="flex flex-col gap-6">
      <Link to={{ pathname: "/categories", search }} className="body-strong inline-flex min-h-11 items-center gap-1 self-start rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t("categories.back")}
      </Link>
      <PageHeader
        title={name}
        month
        hideValues
        tools={
          <>
            {spending.data && (
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                <span className="sr-only desktop:not-sr-only">{t("categories.editOne")}</span>
              </Button>
            )}
          </>
        }
      />

      {spending.loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("categories.loading")}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : spending.failed || !spending.data ? (
        <EmptyState icon={Tags} kind="no-results" title={t("categories.error.title")} message={t("categories.error.message")} action={{ label: t("categories.error.retry"), onClick: spending.reload }} />
      ) : (
        <div className="grid items-start gap-6 desktop:grid-cols-12">
          <div className="flex flex-col gap-6 desktop:col-span-8">
            <Card>
              <h2 className="section-title">{t("categories.spent.heading")}</h2>
              <p><Amount cents={spent} size="lg" locale={locale} {...hidden} /></p>
              {limit !== undefined && <LimitBar label={t("categories.limit.label", { name })} spent={spent} limit={limit} />}
            </Card>
            <Card>
              <h2 className="section-title">{t("categories.transactions.heading")}</h2>
              {rows.length === 0 ? (
                <p className="text-text-muted">{t("categories.transactions.empty")}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {rows.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-4 py-2">
                      <span className="flex min-w-0 flex-col">
                        <span className="body-strong [overflow-wrap:anywhere]">{tx.description}</span>
                        <span className="caption text-text-muted">{formatDay(tx.postedOn, locale)}</span>
                      </span>
                      <Amount cents={-tx.amountCents} size="sm" locale={locale} {...hidden} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <Card className="desktop:col-span-4">
            <h2 className="section-title">{t("categories.history.heading")}</h2>
            {history.data ? (
              <CategoryHistory history={history.data} category={category} />
            ) : history.failed ? (
              <EmptyState icon={Tags} kind="no-results" title={t("categories.history.error")} message={t("categories.error.message")} action={{ label: t("categories.error.retry"), onClick: history.reload }} />
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
          </Card>
        </div>
      )}
      {editing && (
        <Sheet open onOpenChange={setEditing} title={t("categories.edit.field", { name })} closeLabel={t("app.close")}>
          <LimitForm limit={limit} onSave={(cents) => setLimit(category, cents)} />
        </Sheet>
      )}
    </section>
  );
}
