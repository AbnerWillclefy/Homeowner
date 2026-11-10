import { ArrowRight, CalendarDays, Clock, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { FINANCES_BILLS_PATH, FINANCES_SETTINGS_PATH, FINANCES_SPENDING_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import type { QueryViewState } from "../../../shared/query/view";
import { useBills } from "../hooks/useBills";
import { useCommitments } from "../hooks/useCommitments";
import { useDaily } from "../hooks/useDaily";
import { useFinanceMonth } from "../hooks/useFinanceMonth";
import { useMonth } from "../hooks/useMonth";
import { useSavings } from "../hooks/useSavings";
import { barPercent } from "../logic/chart";
import { billState } from "../logic/billState";
import { formatCents } from "../logic/money";
import { addMonths, currentDay, daysInMonth, formatDay, monthName } from "../logic/month";
import { monthRows } from "../logic/monthRows";
import { monthView } from "../logic/monthView";
import { nextUnpaid } from "../logic/nextUnpaid";
import { paceSentence } from "../logic/paceSentence";
import { sameDays } from "../logic/sameDays";
import { spendingKey } from "../logic/spendingCategories";
import { formatSyncTime } from "../logic/syncTime";
import { topCategories } from "../logic/topCategories";
import { SavingsSuggestion } from "./SavingsSuggestion";
import { CumulativeLine } from "./charts/CumulativeLine";
import { SplitBar } from "./charts/SplitBar";

/** A card that has not loaded: a quiet bar, or the failure with its own retry, so one failed read never hides the rest. */
function Block({ heading, states, retry, failed, children }: { heading: string; states: QueryViewState<unknown>[]; retry: () => void; failed: string; children: ReactNode }) {
  const { t } = useI18n();
  const skeleton = useReportFirstLoad(states.some((s) => s.kind === "loading"));
  const broken = states.some((s) => s.kind === "failed");
  return (
    <Card as="section" aria-label={heading} className="mt-0 flex flex-col gap-3">
      <h3 className="my-0 text-lg font-bold leading-snug [overflow-wrap:anywhere]">{heading}</h3>
      {!broken && states.some((s) => s.kind === "loading") && skeleton && (
        <div aria-hidden="true">
          <SkeletonBar className="h-5 w-full" />
        </div>
      )}
      {broken && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="my-0 font-semibold">
            {failed}
          </p>
          <Button variant="secondary" onClick={retry}>
            {t("finances.load.retry")}
          </Button>
        </div>
      )}
      {!broken && states.every((s) => s.kind === "ready") && children}
    </Card>
  );
}

/** "See all" at the end of a card: a link to another view, keeping the picked month. */
function More({ to, children }: { to: string; children: ReactNode }) {
  const { search } = useLocation();
  return (
    <Button asChild variant="link" className="self-end text-sm">
      <Link to={{ pathname: to, search }}>
        {children}
        <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </Button>
  );
}

// Stands in for the amount in a translated sentence, so the amount can be set in bold where the locale puts it.
const MARK = "\u0000";
const bold = (sentence: string, amount: string) => {
  const [before, after] = sentence.split(MARK);
  return (
    <>
      {before}
      <strong>{amount}</strong>
      {after}
    </>
  );
};

const GROUP_LABEL = {
  cards: "finances.commit.group.cards",
  bills: "finances.commit.group.bills",
  planned: "finances.commit.group.plannedCurrent",
  spent: "finances.commit.group.spent",
} as const;

/**
 * Resumo: how the picked month is going, from the same cached reads Gastos and Contas use, plus its own
 * GET /me/finance/daily for the pace chart. A past month is read whole: no today, no pace sentence, and no leftover
 * card. The leftover is the current month's, the first month of "Próximos meses", read from that same cached query.
 */
export function Summary({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const { t, locale } = useI18n();
  const today = new Date(); // each render, like Gastos, so a resumed app is not stuck on the mount day
  const { month, thisMonth } = useFinanceMonth();
  const isCurrent = month === thisMonth;
  const day = isCurrent ? currentDay(today) : null;
  const dayOfMonth = isCurrent ? today.getDate() : daysInMonth(month);
  const previousMonth = addMonths(month, -1);
  const current = useMonth(month);
  const previous = useMonth(previousMonth);
  const bills = useBills(month);
  const commitments = useCommitments(thisMonth);
  const daily = useDaily(month);
  const savings = useSavings();
  useReportFetching(current.refreshing || previous.refreshing || bills.refreshing || commitments.refreshing || daily.refreshing || savings.refreshing);

  const money = (cents: number) => formatCents(cents, locale);
  const transactions = current.state.kind === "ready" ? current.state.data.transactions : null;
  const before = previous.state.kind === "ready" ? previous.state.data.transactions : null;
  const compared = transactions && before ? sameDays(transactions, before, month, today) : null;
  const first = commitments.state.kind === "ready" ? commitments.state.data.months[0] : undefined;
  const income = commitments.state.kind === "ready" ? commitments.state.data.monthlyIncomeCents : null;
  const leftover = first ? monthRows(first) : null;
  const usual = daily.state.kind === "ready" ? daily.state.data : null;
  const averageMonths = usual?.averageMonths ?? 0;
  const averageToday = usual?.average[dayOfMonth - 1];
  const view = current.state.kind === "ready" ? monthView(current.state.data) : null;
  const sentence = compared ? paceSentence(t, locale, compared, dayOfMonth, month, averageToday === undefined ? undefined : { cents: averageToday, months: averageMonths }) : null;
  const next = bills.state.kind === "ready" ? nextUnpaid(bills.state.data, day, 3) : [];
  const billCount = bills.state.kind === "ready" ? bills.state.data.length : 0;
  const top = view ? topCategories(view, 3) : [];
  const topMax = top[0]?.spentCents ?? 0;
  const name = monthName(month, locale);

  return (
    <>
      {isCurrent && (
        <Block heading={t("finances.summary.left.heading", { month: name })} states={[commitments.state]} retry={() => void commitments.reload()} failed={t("finances.summary.left.failed")}>
          {leftover && (
            <>
              {income === null || leftover.leftoverCents === null ? (
                <>
                  <p className="my-0">{t("finances.summary.left.noIncome")}</p>
                  <Button asChild className="self-start">
                    <Link to={FINANCES_SETTINGS_PATH}>{t("finances.commit.incomeSet")}</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="my-0 text-3xl font-bold [overflow-wrap:anywhere]">{money(leftover.leftoverCents)}</p>
                  <p className="my-0 text-sm text-muted">
                    {leftover.overCents > 0
                      ? bold(t("finances.summary.left.over", { amount: MARK }), money(leftover.overCents))
                      : bold(t("finances.summary.left.sentence", { amount: MARK }), money(leftover.leftoverCents))}
                  </p>
                  <SplitBar solid={Math.max(0, leftover.totalCents)} hatched={0} max={Math.max(income, leftover.totalCents)} />
                  <p className="my-0 flex flex-wrap justify-between gap-x-3 text-sm text-muted">
                    <span>
                      {t("finances.commit.total")} {money(leftover.totalCents)}
                    </span>
                    <span>
                      {t("finances.commit.monthlyIncome")} {money(income)}
                    </span>
                  </p>
                </>
              )}
              <dl className="m-0 flex flex-col gap-2 border-t border-border pt-3">
                {(["cards", "bills", "planned", "spent"] as const).map((id) => (
                  <div key={id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <dt className="min-w-0 [overflow-wrap:anywhere]">{t(GROUP_LABEL[id])}</dt>
                    <dd className="m-0 font-bold">{money(leftover.groups.find((g) => g.id === id)?.cents ?? 0)}</dd>
                  </div>
                ))}
                {income === null && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-border pt-2">
                    <dt className="font-semibold">{t("finances.commit.total")}</dt>
                    <dd className="m-0 font-bold">{money(leftover.totalCents)}</dd>
                  </div>
                )}
              </dl>
              <p className="my-0 flex flex-wrap items-center justify-between gap-x-3 border-t border-border pt-3 text-sm font-semibold">
                {income !== null && (
                  <Button asChild variant="link">
                    <Link to={FINANCES_SETTINGS_PATH}>{t("finances.commit.incomeChange")}</Link>
                  </Button>
                )}
                <Button asChild variant="link">
                  <Link to={FINANCES_BILLS_PATH}>{t("finances.summary.left.months")}</Link>
                </Button>
              </p>
            </>
          )}
        </Block>
      )}

      {isCurrent && (
        <Block heading={t("finances.suggestion.heading", { month: name })} states={[savings.state]} retry={() => void savings.reload()} failed={t("finances.suggestion.failed")}>
          {savings.state.kind === "ready" && (
            <SavingsSuggestion
              savings={savings.state.data}
              month={month}
              incomeSet={commitments.state.kind === "ready" ? income !== null : null}
              leftoverCents={leftover?.leftoverCents ?? null}
            />
          )}
        </Block>
      )}

      <Block heading={t("finances.summary.pace.heading")} states={[current.state, previous.state]} retry={() => void Promise.all([current.reload(), previous.reload()])} failed={t("finances.summary.pace.failed")}>
        {sentence && <p className="my-0">{sentence}</p>}
        {daily.state.kind === "failed" && (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="my-0 font-semibold">
              {t("finances.summary.pace.failed")}
            </p>
            <Button variant="secondary" onClick={() => void daily.reload()}>
              {t("finances.load.retry")}
            </Button>
          </div>
        )}
        {daily.state.kind === "loading" && (
          <div aria-hidden="true">
            <SkeletonBar className="h-32 w-full" />
          </div>
        )}
        {usual && (
          <>
            <CumulativeLine
              title={t("finances.summary.pace.title")}
              series={[
                { label: name, points: usual.current },
                { label: monthName(previousMonth, locale), points: usual.previous },
                ...(averageMonths > 0
                  ? [{ label: t(averageMonths === 1 ? "finances.summary.pace.label.one" : "finances.summary.pace.label.other", { n: averageMonths }), points: usual.average }]
                  : []),
              ]}
            />
            {averageMonths < 3 && <p className="my-0 text-sm text-muted">{t(averageMonths === 0 ? "finances.summary.pace.note.none" : "finances.summary.pace.note.some")}</p>}
          </>
        )}
      </Block>

      <Block heading={t("finances.summary.bills.heading")} states={[bills.state]} retry={() => void bills.reload()} failed={t("finances.bills.load.failed")}>
        {next.length === 0 ? (
          <p className="my-0 text-muted">{t("finances.summary.bills.empty")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {next.map((bill) => {
              const date = formatDay(bill.dueDate, locale);
              const overdue = billState(bill, day) === "overdue";
              const Icon = overdue ? CalendarDays : Clock;
              return (
                <li key={bill.id} className="m-0 flex flex-wrap items-center gap-x-3 border-t border-chart-track py-2.5 first:border-t-0">
                  <Icon aria-hidden="true" size={20} className="shrink-0" />
                  <span className="flex min-w-0 flex-1 basis-32 flex-col">
                    <span className="font-bold [overflow-wrap:anywhere]">{bill.name}</span>
                    <span className="text-sm font-semibold text-muted">{overdue ? t("finances.bills.state.overdue", { date }) : t("finances.bills.due", { date })}</span>
                  </span>
                  <span className="ms-auto font-bold">{money(bill.expectedCents)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <More to={FINANCES_BILLS_PATH}>
          {billCount === 0 ? t("finances.summary.bills.all") : billCount === 1 ? t("finances.summary.bills.allOne") : t("finances.summary.bills.allMany", { n: billCount })}
        </More>
      </Block>

      <Block heading={t("finances.summary.top.heading")} states={[current.state]} retry={() => void current.reload()} failed={t("finances.month.failed")}>
        {top.length === 0 ? (
          <p className="my-0 text-muted">{t("finances.month.empty")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {top.map((c) => (
              <li key={c.category} className="m-0 flex flex-col gap-1.5">
                <span className="flex flex-wrap justify-between gap-x-3">
                  <span className="font-semibold [overflow-wrap:anywhere]">{t(spendingKey(c.category))}</span>
                  <span className="font-bold">{money(c.spentCents)}</span>
                </span>
                <span aria-hidden="true" className="flex h-2 rounded-pill bg-chart-track">
                  <span className="rounded-pill bg-chart-ink forced-colors:bg-[CanvasText]" style={{ width: `${barPercent(c.spentCents, topMax)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <More to={FINANCES_SPENDING_PATH}>{t("finances.summary.top.all")}</More>
      </Block>

      {lastSyncedAt && (
        <p role="status" className="my-0 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted">
          <RefreshCw aria-hidden="true" size={16} />
          {t("finances.lastSync", { when: formatSyncTime(lastSyncedAt, locale) })}
        </p>
      )}
    </>
  );
}
