import { useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { FormError } from "../../../shared/ui/FormError";
import { formErrorId } from "../../../shared/ui/formErrorId";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import type { Commitments as CommitmentsData } from "../api/api";
import { useCommitments } from "../hooks/useCommitments";
import { barPercent, scaleMax } from "../logic/chart";
import { committedBars } from "../logic/committedBars";
import { readIncome, type IncomeProblem } from "../logic/income";
import { formatCents } from "../logic/money";
import { currentMonth, monthLabel, monthName } from "../logic/month";
import { plansInProgress } from "../logic/plansInProgress";
import { HATCH } from "./charts/Bar";
import { FinanceCard } from "./FinanceCard";

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
    <section aria-labelledby="finances-commit-heading" className="mt-4 flex flex-col gap-3">
      <h3 id="finances-commit-heading" className="my-0 text-2xl font-bold leading-snug [overflow-wrap:anywhere]">
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

// The column chart's drawing area inside its viewBox.
const VW = 300;
const VH = 170;
const TOP = 34;
const BOTTOM = 146;

function ComingMonths({ data, from }: { data: CommitmentsData; from: string }) {
  const { t, locale } = useI18n();
  const money = (cents: number) => formatCents(cents, locale);
  const income = data.monthlyIncomeCents;
  const bars = committedBars(data.months);
  const plans = plansInProgress(data.months);
  // One scale for every month, so the columns compare; the income line is on it too.
  const max = scaleMax(
    bars.map((b) => b.total),
    income ? [income] : [],
  );
  const h = (cents: number) => ((BOTTOM - TOP) * barPercent(cents, max)) / 100;
  const slot = VW / Math.max(bars.length, 1);
  const width = Math.min(28, slot * 0.6);
  const first = bars[0];
  const percent = (cents: number) => (income ? Math.round((cents / income) * 100) : null);
  const summary = bars
    .map((b) => `${t("finances.commit.month", { month: monthLabel(b.month, locale), total: money(b.total) })}. ${t("finances.commit.split", { bills: money(b.bills), installments: money(b.installments) })}`)
    .join(" ");
  return (
    <>
      {bars.length === 0 ? (
        <Card>
          <p className="my-0 text-muted">{t("finances.commit.empty")}</p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          {first && income !== null && (
            <p className="my-0">
              {t("finances.commit.share", { month: monthName(first.month, locale), percent: percent(first.total) ?? 0 })}
            </p>
          )}
          <p aria-hidden="true" className="m-0 flex flex-wrap gap-x-4 text-sm font-semibold text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-chart-ink" />
              {t("finances.commit.legend.installments")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm border border-chart-muted" style={{ backgroundImage: HATCH }} />
              {t("finances.commit.legend.bills")}
            </span>
            {income !== null && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-chart-ink" />
                {t("finances.commit.legend.income")}
              </span>
            )}
          </p>
          <svg role="img" aria-label={summary} viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full overflow-visible">
            <defs>
              <pattern id="finances-commit-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" strokeWidth="2" className="stroke-chart-muted" />
              </pattern>
            </defs>
            {income !== null && (
              <g aria-hidden="true">
                <line x1={0} x2={VW} y1={BOTTOM - h(income)} y2={BOTTOM - h(income)} strokeWidth={1.5} strokeDasharray="4 3" className="stroke-chart-ink" />
                <text x={VW} y={BOTTOM - h(income) - 5} textAnchor="end" fontSize="10" className="fill-muted">
                  {t("finances.commit.incomeLabel", { amount: money(income) })}
                </text>
              </g>
            )}
            {bars.map((b, i) => {
              const cx = slot * i + slot / 2;
              const billsH = h(b.bills);
              const instH = h(b.installments);
              const pct = percent(b.total);
              return (
                <g key={b.month} aria-hidden="true">
                  {billsH > 0 && <rect x={cx - width / 2} y={BOTTOM - billsH} width={width} height={billsH} fill="url(#finances-commit-hatch)" strokeWidth={1} className="stroke-chart-muted" />}
                  {instH > 0 && <rect x={cx - width / 2} y={BOTTOM - billsH - instH} width={width} height={instH} rx={2} className="fill-chart-ink" />}
                  {pct !== null && (
                    <text x={cx} y={BOTTOM - billsH - instH - 6} textAnchor="middle" fontSize="10" fontWeight="700" className="fill-text">
                      {pct}%
                    </text>
                  )}
                  <text x={cx} y={VH - 6} textAnchor="middle" fontSize="10" className="fill-muted">
                    {new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(Number(b.month.slice(0, 4)), Number(b.month.slice(5)) - 1, 1))}
                  </text>
                </g>
              );
            })}
          </svg>
          {/* The current month counts only unpaid Bills (Handler.Commitments), so it is not read as the whole month. */}
          {first?.month === from && <p className="my-0 text-sm text-muted">{t("finances.commit.currentNote")}</p>}
        </Card>
      )}
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
                  <span className="font-bold [overflow-wrap:anywhere]">{t("finances.commit.planAmount", { amount: money(p.amountCents) })}</span>
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
