import { ChevronDown } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { Card } from "../../../shared/ui/Card";
import { FormError } from "../../../shared/ui/FormError";
import { formErrorId } from "../../../shared/ui/formErrorId";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import type { CommitmentMonth } from "../api/api";
import { useCommitments } from "../hooks/useCommitments";
import { readIncome, type IncomeProblem } from "../logic/income";
import { formatCents } from "../logic/money";
import { currentMonth, monthLabel } from "../logic/month";

const FORM = "finances-income";
const PROBLEM_KEY = { empty: "finances.income.empty", zero: "finances.income.zero", junk: "finances.income.junk" } as const;

/**
 * Installments: what is already committed in the coming months, and the optional Monthly income that turns it into
 * a share. Neutral on purpose: no danger colour or alarm icon, even above 100%. The app states a fact, it never commands.
 */
export function Commitments() {
  const { t, locale } = useI18n();
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
      {state.kind === "ready" &&
        (state.data.months.every((m) => m.installments.length === 0 && m.bills.length === 0) ? (
          <p className="my-0 text-muted">{t("finances.commit.empty")}</p>
        ) : (
          state.data.months.map((m) => <MonthCard key={m.month} month={m} locale={locale} />)
        ))}
    </section>
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

/** The head is one full-width disclosure button laid out like `CategoryCard`: `CollapsibleCard`'s icon tile leaves a letter per line at 320px and the largest text. */
function MonthCard({ month, locale }: { month: CommitmentMonth; locale: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const pct = month.percentOfIncome;
  return (
    <Card as="section" aria-labelledby={`${id}-title`} className="mt-0 flex flex-col gap-2">
      <h4 className="m-0 text-base font-bold leading-snug">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-start gap-3 rounded-control bg-transparent p-0 text-start font-[inherit] text-inherit"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span id={`${id}-title`} className="first-letter:uppercase [overflow-wrap:anywhere]">
              {monthLabel(month.month, locale)}
            </span>
            <span className="text-lg">{formatCents(month.committedCents, locale)}</span>
            {pct !== undefined && <span className="text-sm font-normal text-muted">{t("finances.commit.pct", { pct: Math.round(pct) })}</span>}
          </span>
          <ChevronDown
            aria-hidden="true"
            size={22}
            className={`mt-1 shrink-0 text-muted motion-safe:transition-transform motion-safe:duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h4>
      <ul id={`${id}-body`} hidden={!open} className="m-0 flex list-none flex-col gap-2 p-0">
        {month.installments.map((i, index) => (
          // A line has no plan id, so name + number can collide; the server-ordered list is never reordered here.
          <Line key={index} name={t("finances.commit.installment", { name: i.name, n: i.number, m: i.total })} cents={i.amountCents} locale={locale} />
        ))}
        {month.bills.map((b) => (
          <Line key={b.id} name={b.name} cents={b.expectedCents} locale={locale} />
        ))}
      </ul>
    </Card>
  );
}

function Line({ name, cents, locale }: { name: string; cents: number; locale: string }) {
  return (
    <li className="flex flex-wrap justify-between gap-x-3">
      <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
      <span className="font-semibold">{formatCents(cents, locale)}</span>
    </li>
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
