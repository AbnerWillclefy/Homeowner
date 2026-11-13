import { Banner, Button, Dialog, EmptyState, Skeleton } from "@homeowner/bedrock";
import { Plus, Target } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../shared/i18n/I18nProvider";
import type { Investment, SavingsGoal } from "./api";
import { ContributionCard } from "./components/ContributionCard";
import { GoalFormSheet } from "./components/GoalFormSheet";
import { InvestmentFormSheet } from "./components/InvestmentFormSheet";
import { InvestmentsSection } from "./components/InvestmentsSection";
import { GoalsList } from "./components/GoalsList";
import { ReserveCard } from "./components/ReserveCard";
import { useSavings } from "./hooks/useSavings";

type Open = { goal: SavingsGoal | null } | null;

/** "Objetivos" at `/goals`: the Monthly contribution, the Emergency reserve target, the Goals (whose order decides who is served first) and the Investments that fill them. */
export function GoalsPage() {
  const { t } = useI18n();
  const { data, loading, failed, reload, saveReserve, saveContribution, saveGoal, removeGoal, reorder, saveInvestment, removeInvestment, pickServes, takeBankValue } = useSavings();
  const [form, setForm] = useState<Open>(null);
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null);
  const [investmentForm, setInvestmentForm] = useState<{ investment: Investment | null } | null>(null);
  const [deletingInvestment, setDeletingInvestment] = useState<Investment | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t("nav.goals")}</h1>

      {deleteFailed && <Banner tone="danger">{t("goals.failed")}</Banner>}

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("goals.loading")}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : failed || !data ? (
        <EmptyState icon={Target} kind="no-results" title={t("goals.error.title")} message={t("goals.error.message")} action={{ label: t("goals.error.retry"), onClick: reload }} />
      ) : (
        <>
          <div className="grid gap-4 desktop:grid-cols-2">
            <ContributionCard savings={data} save={saveContribution} />
            <ReserveCard savings={data} save={saveReserve} />
          </div>
          <section aria-labelledby="goals-title" className="flex flex-col gap-3">
            <h2 id="goals-title" className="section-title">{t("goals.title")}</h2>
            {data.goals.length === 0 ? (
              <EmptyState icon={Target} title={t("goals.empty.title")} message={t("goals.empty.message")} />
            ) : (
              <>
                <p className="caption text-text-muted">{t("goals.hint")}</p>
                <GoalsList goals={data.goals} reorder={reorder} onEdit={(goal) => setForm({ goal })} onDelete={(goal) => { setDeleteFailed(false); setDeleting(goal); }} />
              </>
            )}
            <Button variant="secondary" icon={Plus} className="self-start" onClick={() => setForm({ goal: null })}>
              {t("goals.add")}
            </Button>
          </section>
          <InvestmentsSection
            investments={data.investments}
            pick={pickServes}
            takeBankValue={takeBankValue}
            onAdd={() => setInvestmentForm({ investment: null })}
            onEdit={(investment) => setInvestmentForm({ investment })}
            onDelete={(investment) => { setDeleteFailed(false); setDeletingInvestment(investment); }}
          />
        </>
      )}

      {form && <GoalFormSheet key={form.goal?.id ?? "new"} goal={form.goal} save={(input) => saveGoal(form.goal?.id ?? null, input)} onClose={() => setForm(null)} />}
      {investmentForm && (
        <InvestmentFormSheet key={investmentForm.investment?.id ?? "new"} investment={investmentForm.investment} save={(input) => saveInvestment(investmentForm.investment?.id ?? null, input)} onClose={() => setInvestmentForm(null)} />
      )}
      {deletingInvestment && (
        <Dialog
          open
          onOpenChange={(open) => !open && setDeletingInvestment(null)}
          title={t("investments.delete.title")}
          description={t("investments.delete.body", { name: deletingInvestment.name })}
          cancelLabel={t("goals.form.cancel")}
          confirmLabel={t("goals.delete")}
          onConfirm={() => void removeInvestment(deletingInvestment.id).then((r) => setDeleteFailed(r.kind === "failed"))}
        />
      )}
      {deleting && (
        <Dialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t("goals.delete.title")}
          description={t("goals.delete.body", { name: deleting.name })}
          cancelLabel={t("goals.form.cancel")}
          confirmLabel={t("goals.delete")}
          onConfirm={() => void removeGoal(deleting.id).then((r) => setDeleteFailed(r.kind === "failed"))}
        />
      )}
    </section>
  );
}
