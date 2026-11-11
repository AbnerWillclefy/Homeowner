import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { FINANCES_SAVINGS_PATH, FINANCES_SETTINGS_PATH, FINANCES_SPENDING_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import type { Savings } from "../api/api";
import { formatCents } from "../logic/money";
import { monthName } from "../logic/month";
import { spendingKey, type SpendingCategory } from "../logic/spendingCategories";
import { suggestionOf, whenText, type MonthPart, type SuggestionRow } from "../logic/suggestion";

const link = (to: string, children: ReactNode, className = "") => (
  <Button asChild variant="link" className={className}>
    <Link to={to}>{children}</Link>
  </Button>
);

/**
 * The body of the month's suggestion card in Resumo: the Monthly contribution, where it goes this month and what the
 * month's leftover means for it. It only informs: no control here changes anything. `incomeSet` and `leftoverCents`
 * come from the leftover card's read (null while it has not loaded).
 */
export function SavingsSuggestion({ savings, month, incomeSet, leftoverCents }: { savings: Savings; month: string; incomeSet: boolean | null; leftoverCents: number | null }) {
  const { t, locale } = useI18n();
  const money = (cents: number) => formatCents(cents, locale);
  const suggestion = suggestionOf(savings, { incomeSet, leftoverCents });
  if (suggestion.kind === "noContribution")
    return (
      <>
        <p className="my-0">{t("finances.suggestion.noContribution")}</p>
        <Button asChild className="self-start">
          <Link to={FINANCES_SAVINGS_PATH}>{t("finances.savings.contribution.set")}</Link>
        </Button>
      </>
    );
  const { baseCents, rows, month: part } = suggestion;
  const name = monthName(month, locale);
  const footerLeft = leftLink(part, rows, t);
  return (
    <>
      <p className="my-0">
        <span className="text-3xl font-bold [overflow-wrap:anywhere]">{money(baseCents)}</span>{" "}
        <span className="text-muted">
          {t("finances.savings.contribution.title")} · {t("finances.savings.contribution.perMonth")}
        </span>
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((row, i) => (
          <Row key={row.kind === "goal" ? row.id : row.kind} row={row} first={i === 0} />
        ))}
      </ul>
      <MonthSentence part={part} name={name} money={money} />
      <p className="my-0 flex flex-wrap items-center justify-between gap-x-3 border-t border-border pt-3 text-sm font-semibold">
        {footerLeft}
        <Button asChild variant="link" className="ms-auto">
          <Link to={FINANCES_SAVINGS_PATH}>
            {t("finances.savings.open")}
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </Button>
      </p>
    </>
  );
}

/** The one link on the left of the footer: what the month's state, or money with no Goal, asks the User to do next. */
function leftLink(part: MonthPart, rows: SuggestionRow[], t: ReturnType<typeof useI18n>["t"]): ReactNode {
  if (part.kind === "below") return link(FINANCES_SPENDING_PATH, t("finances.suggestion.spending"));
  if (part.kind === "noIncome") return link(FINANCES_SETTINGS_PATH, t("finances.commit.incomeSet"));
  if (rows.some((r) => r.kind === "unassigned")) return link(FINANCES_SAVINGS_PATH, t("finances.suggestion.noGoalAction"));
  return null;
}

function Row({ row, first }: { row: SuggestionRow; first: boolean }) {
  const { t, locale } = useI18n();
  const cls = `m-0 flex flex-col border-t border-chart-track py-2.5 ${first ? "border-t-0 pt-0" : ""}`;
  const head = (label: string, cents: number | null) => (
    <span className="flex flex-wrap justify-between gap-x-3">
      <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{label}</span>
      {cents !== null && <span className="font-bold">{formatCents(cents, locale)}</span>}
    </span>
  );
  const note = (text: string | null) => text && <span className="text-sm text-muted [overflow-wrap:anywhere]">{text}</span>;
  switch (row.kind) {
    case "reserve":
      return (
        <li className={cls}>
          {head(t("finances.savings.reserve.title"), row.cents)}
          {note(whenText(t, locale, row.when, "reserve"))}
        </li>
      );
    case "noTarget":
      return (
        <li className={cls}>
          {head(t("finances.savings.reserve.title"), null)}
          {note(t("finances.savings.noTarget"))}
          {link(FINANCES_SAVINGS_PATH, t("finances.savings.reserve.set"), "self-start text-sm")}
        </li>
      );
    case "goal":
      return (
        <li className={cls}>
          {head(row.name, row.cents)}
          {note(whenText(t, locale, row.when, "goal"))}
        </li>
      );
    case "unassigned":
      return (
        <li className={cls}>
          {head(t("finances.suggestion.noGoal"), row.cents)}
          {note(t("finances.suggestion.noGoalNote"))}
        </li>
      );
  }
}

/** Facts with numbers, in neutral words: a category over its limit is a line of text, never a warning. */
function MonthSentence({ part, name, money }: { part: MonthPart; name: string; money: (cents: number) => string }) {
  const { t } = useI18n();
  switch (part.kind) {
    case "none":
      return null;
    case "noIncome":
      return <p className="my-0 text-sm text-muted">{t("finances.suggestion.noIncome")}</p>;
    case "above":
      return (
        <p className="my-0 text-sm">
          {t("finances.suggestion.above", { month: name, leftover: money(part.leftoverCents) })}
          {part.monthsSooner !== null && (
            <>
              {" "}
              {part.reaches === "reserve"
                ? t("finances.suggestion.soonerReserve", { count: part.monthsSooner })
                : t("finances.suggestion.soonerGoal", { count: part.monthsSooner, name: part.reaches.goal })}
            </>
          )}
        </p>
      );
    case "below":
      return (
        <>
          <p className="my-0 text-sm">
            {part.leftoverCents === null || part.shortfallCents === null
              ? t("finances.suggestion.belowNoAmount", { month: name })
              : t("finances.suggestion.below", { month: name, leftover: money(part.leftoverCents), shortfall: money(part.shortfallCents) })}
          </p>
          {part.over.length === 0 ? (
            <p className="my-0 text-sm text-muted">{t("finances.suggestion.noneOver")}</p>
          ) : (
            <>
              <h4 className="my-0 text-sm font-bold">{t("finances.suggestion.overHeading")}</h4>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {part.over.map((o) => (
                  <li key={o.category} className="m-0 flex flex-wrap justify-between gap-x-3 text-sm text-muted">
                    <span className="min-w-0 [overflow-wrap:anywhere]">{t(spendingKey(o.category as SpendingCategory))}</span>
                    <span>{t("finances.suggestion.over", { amount: money(o.overCents) })}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      );
  }
}
