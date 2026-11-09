import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { FINANCES_SETTINGS_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { Card } from "../../../shared/ui/Card";
import { FormError } from "../../../shared/ui/FormError";
import { formErrorId } from "../../../shared/ui/formErrorId";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import type { Commitments as CommitmentsData } from "../api/api";
import { useCommitments } from "../hooks/useCommitments";
import { scaleMax } from "../logic/chart";
import { committedBars } from "../logic/committedBars";
import { readIncome, type IncomeProblem } from "../logic/income";
import { formatCents } from "../logic/money";
import { currentMonth, monthLabel, monthName } from "../logic/month";
import { plansInProgress } from "../logic/plansInProgress";
import { SplitBar } from "./charts/SplitBar";

const FORM = "finances-income";
const PROBLEM_KEY = { empty: "finances.income.empty", zero: "finances.income.zero", junk: "finances.income.junk" } as const;

/**
 * "Próximos meses": what is already committed in the coming months (Bills and Installment plans) against the Monthly
 * income line, then the Installment plans in progress. Neutral on purpose: no danger colour or alarm icon, even above
 * the income. The app states a fact, it never commands.
 */
export function Commitments() {
  const { t } = useI18n();
  const [from] = useState(() => currentMonth(new Date()));
  const { state, refreshing, reload } = useCommitments(from);
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing);

  return (
    <section aria-labelledby="finances-commit-heading" className="mt-0 flex flex-col gap-3">
      <h3 id="finances-commit-heading" className="my-0 text-lg font-bold leading-snug [overflow-wrap:anywhere]">
        {t("finances.commit.heading")}
      </h3>
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
  const bars = committedBars(data.months);
  const plans = plansInProgress(data.months);
  // One scale for every month, so the bars compare; the income line is on it too.
  const max = scaleMax(
    bars.map((b) => b.total),
    income ? [income] : [],
  );
  return (
    <>
      <p className="my-0 flex flex-wrap items-center gap-x-3">
        {income !== null && <span className="font-semibold">{t("finances.commit.income", { amount: formatCents(income, locale) })}</span>}
        <Button asChild variant="link">
          <Link to={FINANCES_SETTINGS_PATH}>{t(income === null ? "finances.commit.incomeSet" : "finances.commit.incomeChange")}</Link>
        </Button>
      </p>
      {bars.length === 0 ? (
        <p className="my-0 text-muted">{t("finances.commit.empty")}</p>
      ) : (
        <Card className="flex flex-col gap-4">
          {income !== null && <p className="my-0 text-sm text-muted">{t("finances.commit.incomeMarker")}</p>}
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {bars.map((b) => (
              <li key={b.month} className="flex flex-col gap-1">
                <span className="font-semibold first-letter:uppercase [overflow-wrap:anywhere]">
                  {t("finances.commit.month", { month: monthLabel(b.month, locale), total: formatCents(b.total, locale) })}
                </span>
                <SplitBar solid={b.bills} hatched={b.installments} max={max} markers={income ? [income] : []} />
                <span className="text-sm text-muted [overflow-wrap:anywhere]">
                  {t("finances.commit.split", { bills: formatCents(b.bills, locale), installments: formatCents(b.installments, locale) })}
                </span>
                {/* The current month counts only unpaid Bills (Handler.Commitments), so it is not read as the whole month. */}
                {b.month === from && <span className="text-sm text-muted">{t("finances.commit.currentNote")}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {plans.length > 0 && (
        <section aria-labelledby="finances-plans-heading" className="flex flex-col gap-2">
          <h4 id="finances-plans-heading" className="my-0 text-base font-bold leading-snug">
            {t("finances.commit.plans")}
          </h4>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {plans.map((p) => (
              // A line has no plan id, so a plan is its name and total.
              <li key={`${p.name}/${p.total}`} className="flex flex-col">
                <span className="[overflow-wrap:anywhere]">
                  {t("finances.commit.plan", { name: p.name, n: p.next, m: p.total, month: monthName(p.last, locale) })}
                </span>
                <span className="text-sm text-muted">{t("finances.commit.planAmount", { amount: formatCents(p.amountCents, locale) })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** The optional Monthly income, which turns the installments into a share of it. It shares the installments' read. */
export function MonthlyIncome() {
  const { t } = useI18n();
  const [from] = useState(() => currentMonth(new Date()));
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
    <Card>
      <form onSubmit={submit} noValidate>
        <label htmlFor="finances-income-input" className="mt-0">
          {t("finances.income.label")}
        </label>
        <input
          id="finances-income-input"
          name="income"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={income === null ? "" : new Intl.NumberFormat(locale, { minimumFractionDigits: 2, useGrouping: false }).format(income / 100)}
          aria-invalid={problem !== null && problem !== "failed"}
          aria-describedby={problem ? formErrorId(FORM) : undefined}
        />
        <FormError form={FORM}>{problem && t(problem === "failed" ? "finances.income.failed" : PROBLEM_KEY[problem])}</FormError>
        <ButtonRow
          className="mt-4"
          start={
            income !== null && (
              <Button variant="secondary" disabled={busy !== null} pending={busy === "clear"} onClick={() => void write(null, "clear")}>
                {t("finances.income.clear")}
              </Button>
            )
          }
          end={
            <Button type="submit" disabled={busy !== null} pending={busy === "save"}>
              {t("finances.income.save")}
            </Button>
          }
        />
      </form>
    </Card>
  );
}
