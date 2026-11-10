import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { FINANCES_SETTINGS_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { FormError } from "../../../shared/ui/FormError";
import { formErrorId } from "../../../shared/ui/formErrorId";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import type { Commitments as CommitmentsData } from "../api/api";
import { useCommitments } from "../hooks/useCommitments";
import { useFinanceMonth } from "../hooks/useFinanceMonth";
import { barPercent } from "../logic/chart";
import { readIncome, type IncomeProblem } from "../logic/income";
import { formatCents } from "../logic/money";
import { monthName } from "../logic/month";
import { plansInProgress } from "../logic/plansInProgress";
import { FinanceCard } from "./FinanceCard";
import { MonthCard } from "./MonthCard";

const FORM = "finances-income";
const PROBLEM_KEY = { empty: "finances.income.empty", zero: "finances.income.zero", junk: "finances.income.junk" } as const;

/**
 * "Próximos meses": what each of the next twelve months already has to pay and what is left of the Monthly income,
 * one folding card per month, then the Installment plans in progress. Neutral on purpose: no danger colour or alarm
 * icon, even above the income. The app states a fact, it never commands.
 */
export function Commitments() {
  const { t } = useI18n();
  const { thisMonth: from } = useFinanceMonth();
  const { state, refreshing, reload } = useCommitments(from);
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing);

  return (
    <section aria-labelledby="finances-commit-heading" className="mt-4 flex flex-col gap-3">
      <h3 id="finances-commit-heading" className="my-0 text-2xl font-bold leading-snug [overflow-wrap:anywhere]">
        {t("finances.commit.heading")}
      </h3>
      <p className="my-0 text-muted">{t("finances.commit.intro")}</p>
      {state.kind === "loading" && skeleton && (
        <div aria-hidden="true">
          <SkeletonBar className="h-5 w-full" />
        </div>
      )}
      {state.kind === "failed" && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="my-0 font-semibold">
            {t("finances.commit.failed")}
          </p>
          <Button variant="secondary" onClick={() => void reload()}>
            {t("finances.load.retry")}
          </Button>
        </div>
      )}
      {state.kind === "ready" && <ComingMonths data={state.data} from={from} />}
    </section>
  );
}

function ComingMonths({ data, from }: { data: CommitmentsData; from: string }) {
  const { t, locale } = useI18n();
  const income = data.monthlyIncomeCents;
  const plans = plansInProgress(data.months);
  return (
    <>
      {income === null && (
        <Card className="flex flex-col items-start gap-3">
          <p className="my-0">{t("finances.commit.noIncome")}</p>
          <Button asChild>
            <Link to={FINANCES_SETTINGS_PATH}>{t("finances.commit.incomeSet")}</Link>
          </Button>
        </Card>
      )}
      <div className="flex flex-col gap-3">
        {data.months.map((m) => (
          <MonthCard key={m.month} data={m} current={m.month === from} income={income} />
        ))}
      </div>
      <p className="my-0 text-sm text-muted">{t("finances.commit.footnote")}</p>
      {plans.length > 0 && (
        <Card as="section" aria-labelledby="finances-plans-heading" className="mt-2 flex flex-col gap-1">
          <h4 id="finances-plans-heading" className="my-0 mb-2 text-lg font-bold leading-snug">
            {t("finances.commit.plans")}
          </h4>
          <ul className="m-0 flex list-none flex-col p-0">
            {plans.map((p) => (
              // A line has no plan id, so a plan is its name and total.
              <li key={`${p.name}/${p.total}`} className="flex flex-col gap-1.5 border-t border-chart-track py-3 first:border-t-0 first:pt-0 last:pb-0">
                <span className="flex flex-wrap justify-between gap-x-3">
                  <span className="font-bold [overflow-wrap:anywhere]">{p.name}</span>
                  <span className="font-bold [overflow-wrap:anywhere]">{t("finances.commit.planAmount", { amount: formatCents(p.amountCents, locale) })}</span>
                </span>
                {/* One segment per installment while they fit, filled up to the next one. */}
                {p.total <= 12 ? (
                  <span aria-hidden="true" className="flex gap-0.5">
                    {Array.from({ length: p.total }, (_, i) => (
                      <span key={i} className={`h-2 flex-1 rounded-pill ${i < p.next ? "bg-chart-ink" : "bg-chart-track"}`} />
                    ))}
                  </span>
                ) : (
                  <span aria-hidden="true" className="flex h-2 rounded-pill bg-chart-track">
                    <span className="rounded-pill bg-chart-ink" style={{ width: `${barPercent(p.next, p.total)}%` }} />
                  </span>
                )}
                <span className="text-sm text-muted">{t("finances.commit.plan", { n: p.next, m: p.total, month: monthName(p.last, locale) })}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

/** The optional Monthly income, which the leftover of each month is worked out from. It shares the coming months' read. */
export function MonthlyIncome() {
  const { t } = useI18n();
  const { thisMonth: from } = useFinanceMonth();
  const { state, reload, saveIncome } = useCommitments(from);
  // The installments' own alert is on another view, so the failure is said here too.
  if (state.kind === "failed")
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="my-0 font-semibold">
          {t("finances.commit.failed")}
        </p>
        <Button variant="secondary" onClick={() => void reload()}>
          {t("finances.load.retry")}
        </Button>
      </div>
    );
  if (state.kind !== "ready") return null;
  return (
    <IncomeForm
      // A new key after a save puts the stored value back in the field.
      key={state.data.monthlyIncomeCents ?? "none"}
      income={state.data.monthlyIncomeCents}
      onSave={saveIncome}
    />
  );
}

function IncomeForm({ income, onSave }: { income: number | null; onSave: (cents: number | null) => Promise<boolean> }) {
  const { t, locale } = useI18n();
  const [problem, setProblem] = useState<IncomeProblem | "failed" | null>(null);
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);

  async function write(cents: number | null, which: "save" | "clear") {
    setBusy(which);
    setProblem((await onSave(cents)) ? null : "failed");
    setBusy(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = readIncome(String(new FormData(event.currentTarget).get("income") ?? ""));
    if ("problem" in read) setProblem(read.problem);
    else void write(read.cents, "save");
  }

  return (
    <FinanceCard id="finances-income-heading" title={t("finances.income.label")} hint={t("finances.income.hint")}>
      <form onSubmit={submit} noValidate>
        <label htmlFor="finances-income-input" className="mt-0">
          {t("finances.income.field")}
        </label>
        <input
          id="finances-income-input"
          name="income"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={income === null ? "" : new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(income / 100)}
          aria-invalid={problem !== null && problem !== "failed"}
          aria-describedby={problem ? formErrorId(FORM) : undefined}
        />
        <FormError form={FORM}>{problem && t(problem === "failed" ? "finances.income.failed" : PROBLEM_KEY[problem])}</FormError>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {income !== null && (
            <Button variant="secondary" disabled={busy !== null} pending={busy === "clear"} onClick={() => void write(null, "clear")}>
              {t("finances.income.clear")}
            </Button>
          )}
          <Button type="submit" disabled={busy !== null} pending={busy === "save"}>
            {t("finances.income.save")}
          </Button>
        </div>
      </form>
    </FinanceCard>
  );
}
