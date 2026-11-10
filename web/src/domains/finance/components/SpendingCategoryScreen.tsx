import { ChevronLeft } from "lucide-react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { categoryFromPath, FINANCES_SPENDING_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { PageLoading } from "../../../shared/ui/PageLoading";
import { useBudget } from "../hooks/useBudget";
import { useFinance } from "../hooks/useFinance";
import { useFinanceMonth } from "../hooks/useFinanceMonth";
import { useHistory } from "../hooks/useHistory";
import { useMonth } from "../hooks/useMonth";
import { limitText } from "../logic/limit";
import { formatCents } from "../logic/money";
import { addMonths, monthLabel } from "../logic/month";
import { sameDays } from "../logic/sameDays";
import { type SpendingCategory, spendingKey } from "../logic/spendingCategories";
import { CategoryHistory } from "./CategoryHistory";
import { FinanceStatusGate } from "./FinanceSetup";
import { LimitForm } from "./LimitForm";

/**
 * One Spending Category, at /finances/gastos/<id>: the six months ending at the picked month, then its monthly
 * limit. The month comes from `?month=`, so Back returns to Gastos on the same month.
 */
export function SpendingCategoryScreen() {
  const { search } = useLocation();
  const category = categoryFromPath(`${FINANCES_SPENDING_PATH}/${useParams().category ?? ""}`);
  // An unknown id is not a Spending Category: back to Gastos, keeping the month.
  if (category === null) return <Navigate to={{ pathname: FINANCES_SPENDING_PATH, search }} replace />;
  return <Screen category={category} />;
}

function Screen({ category }: { category: SpendingCategory }) {
  const { t, locale } = useI18n();
  const finance = useFinance();
  const navigate = useNavigate();
  const { search, key } = useLocation();
  const { month, thisMonth } = useFinanceMonth();
  const { state, reload } = useMonth(month);
  const previous = useMonth(addMonths(month, -1));
  const history = useHistory(month);
  const setLimit = useBudget(month);
  // "default" is the first entry of the session (a reload or a deep link): there is no earlier view to return to.
  const canGoBack = key !== "default";
  const limit = state.kind === "ready" ? state.data.limits[category] : undefined;
  // The same spent value the Gastos bar shows: the same days of last month once it is known.
  const spent =
    state.kind !== "ready"
      ? 0
      : previous.state.kind === "ready"
        ? (sameDays(state.data.transactions, previous.state.data.transactions, month, new Date()).byCategory.get(category)?.spent ?? 0)
        : state.data.transactions.reduce((sum, tx) => (tx.spendingCategory === category && tx.type === "expense" ? sum - tx.amountCents : sum), 0);
  const standing = limit === undefined ? null : limitText(spent, limit);

  return (
    <PageLoading message={t("finances.loading")}>
      <div className="mb-2">
        <Button variant="ghost" className="-ms-3 gap-1 px-3" onClick={() => (canGoBack ? navigate(-1) : navigate({ pathname: FINANCES_SPENDING_PATH, search }))}>
          <ChevronLeft aria-hidden="true" size={20} />
          {t("finances.category.back")}
        </Button>
      </div>
      <PageHeader title={t(spendingKey(category))}>{monthLabel(month, locale)}</PageHeader>
      <div className="flex flex-col gap-4">
        <FinanceStatusGate finance={finance}>
          {() => (
            <>
              <Card className="flex flex-col gap-3">
                <CategoryHistory category={category} history={history} marked={month} thisMonth={thisMonth} />
              </Card>
              <Card className="flex flex-col gap-3">
                <h3 className="m-0 text-xl font-bold">{t("finances.category.limitHeading")}</h3>
                {state.kind === "failed" && (
                  <div className="flex flex-col items-start gap-2">
                    <p role="alert" className="my-0 text-sm font-semibold">
                      {t("finances.month.failed")}
                    </p>
                    <Button variant="secondary" onClick={() => void reload()}>
                      {t("finances.load.retry")}
                    </Button>
                  </div>
                )}
                {state.kind === "ready" && (
                  <>
                    {standing && limit !== undefined && (
                      <p className="my-0 text-sm text-muted [overflow-wrap:anywhere]">
                        {t(`finances.limit.${standing.key}`, { limit: formatCents(limit, locale), amount: formatCents(standing.amount, locale) })}
                      </p>
                    )}
                    <LimitForm limit={limit} onSave={(cents) => setLimit(category, cents)} />
                  </>
                )}
              </Card>
            </>
          )}
        </FinanceStatusGate>
      </div>
    </PageLoading>
  );
}
