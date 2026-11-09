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
import { barPercent } from "../logic/chart";
import { billGroups } from "../logic/billGroups";
import { billState } from "../logic/billState";
import { incomeSplit } from "../logic/incomeSplit";
import { formatCents } from "../logic/money";
import { addMonths, currentDay, daysInMonth, formatDay, monthName } from "../logic/month";
import { monthView, spent as spentOf } from "../logic/monthView";
import { nextUnpaid } from "../logic/nextUnpaid";
import { paceSentence } from "../logic/paceSentence";
import { sameDays } from "../logic/sameDays";
import { spendingKey } from "../logic/spendingCategories";
import { formatSyncTime } from "../logic/syncTime";
import { topCategories } from "../logic/topCategories";
import { CumulativeLine } from "./charts/CumulativeLine";
import { HATCH } from "./charts/Bar";
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

/** A legend swatch, drawn as the bar draws its part. */
const Swatch = ({ part }: { part: "spent" | "unpaid" | "left" }) => (
  <span
    aria-hidden="true"
    className={`size-3.5 shrink-0 rounded-sm border ${part === "spent" ? "border-chart-ink bg-chart-ink" : part === "unpaid" ? "border-chart-muted" : "border-border bg-chart-track"}`}
    style={part === "unpaid" ? { backgroundImage: HATCH } : undefined}
  />
);

/**
 * Resumo: how the picked month is going, from the same cached reads Gastos and Contas use, plus its own
 * GET /me/finance/daily for the pace chart. A past month is read whole: no today, no pace sentence.
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
  useReportFetching(current.refreshing || previous.refreshing || bills.refreshing || commitments.refreshing || daily.refreshing);

  const money = (cents: number) => formatCents(cents, locale);
  const rows = current.state.kind === "ready" ? current.state.data.transactions : null;
  const before = previous.state.kind === "ready" ? previous.state.data.transactions : null;
  const compared = rows && before ? sameDays(rows, before, month, today) : null;
  const spent = compared?.spent ?? (current.state.kind === "ready" ? current.state.data.spentCents : 0);
  const unpaid = bills.state.kind === "ready" ? billGroups(bills.state.data, day).toPayCents : 0;
  const income = commitments.state.kind === "ready" ? commitments.state.data.monthlyIncomeCents : null;
  // A card bill due later this month is not spent yet, but it is still to pay.
  const dueCents = compared?.due.reduce((sum, tx) => sum + spentOf(tx), 0) ?? 0;
  const split = incomeSplit(income, spent, unpaid + dueCents);
  const usual = daily.state.kind === "ready" ? daily.state.data : null;
  const averageMonths = usual?.averageMonths ?? 0;
  const averageToday = usual?.average[dayOfMonth - 1];
  const view = current.state.kind === "ready" ? monthView(current.state.data) : null;
  const sentence = compared ? paceSentence(t, locale, compared, dayOfMonth, month, averageToday === undefined ? undefined : { cents: averageToday, months: averageMonths }) : null;
  const next = bills.state.kind === "ready" ? nextUnpaid(bills.state.data, day, 3) : [];
  const billCount = bills.state.kind === "ready" ? bills.state.data.length : 0;
  const top = view ? topCategories(view, 3) : [];
  const topMax = top[0]?.spentCents ?? 0;
  const retryAll = () => void Promise.all([current.reload(), bills.reload(), commitments.reload()]);
  const name = monthName(month, locale);

  return (
    <>
      <Block heading={t("finances.summary.split.heading", { month: name })} states={[current.state, bills.state, commitments.state]} retry={retryAll} failed={t("finances.summary.split.failed")}>
        {split ? (
          <>
            <p className="my-0">
              {split.over > 0
                ? bold(t("finances.summary.split.overSentence", { amount: MARK }), money(split.over))
                : bold(t("finances.summary.split.leftSentence", { amount: MARK }), money(split.left))}
            </p>
            <SplitBar solid={split.spent} hatched={split.unpaid} max={split.scale} />
            <dl className="m-0 flex flex-col gap-2">
              {(
                [
                  ["spent", t(isCurrent ? "finances.summary.split.spent" : "finances.summary.split.spentMonth"), split.spent],
                  ["unpaid", t("finances.summary.split.unpaid"), split.unpaid],
                  ["left", t(split.over > 0 ? "finances.summary.split.over" : "finances.summary.split.left"), split.over > 0 ? split.over : split.left],
                ] as const
              ).map(([part, label, cents]) => (
                <div key={part} className="flex flex-wrap items-center gap-x-2.5">
                  <Swatch part={part} />
                  <dt className="min-w-0 flex-1">{label}</dt>
                  <dd className="m-0 font-bold">{money(cents)}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="my-0">{t("finances.summary.split.none")}</p>
        )}
        <p className="my-0 flex flex-wrap items-center justify-between gap-x-3 border-t border-border pt-3 text-sm font-semibold text-muted">
          {income !== null && <span>{t("finances.commit.income", { amount: money(income) })}</span>}
          <Button asChild variant="link">
            <Link to={FINANCES_SETTINGS_PATH}>{t(income === null ? "finances.commit.incomeSet" : "finances.commit.incomeChange")}</Link>
          </Button>
        </p>
      </Block>

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
