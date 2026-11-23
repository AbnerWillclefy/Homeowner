import { EmptyState, SegmentedControl } from "@homeowner/bedrock";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { monthLabel } from "../../shared/month/month";
import { useMonthParam } from "../../shared/month/useMonthParam";
import { PageHeader } from "../../shared/PageHeader";
import { useMediaQuery } from "../../shared/useMediaQuery";
import { useBills } from "../bills/hooks/useBills";
import { useSpending } from "../categories/hooks/useCategories";
import { useSavings } from "../goals/hooks/useSavings";
import { useNetWorth } from "../net-worth/hooks/useNetWorth";
import { BillsAlert } from "./components/BillsAlert";
import { Block } from "./components/Block";
import { CardBillsCard } from "./components/CardBillsCard";
import { GoalsCard } from "./components/GoalsCard";
import { HeroCard } from "./components/HeroCard";
import { NetWorthCard } from "./components/NetWorthCard";
import { ResultCard } from "./components/ResultCard";
import { SpendingCard } from "./components/SpendingCard";
import { useCommitments, useHistory } from "./hooks/useOverviewData";
import { formatDay, monthName } from "./logic/month";

const DESKTOP = "(min-width: 1024px)";
const TABS = ["result", "cats", "worth"] as const;

/**
 * The month at a glance. On a phone: the hero, the bills alert and one of the result, spending and net-worth cards, chosen by
 * the "Resumo" switch (local state; goals and card bills live on their own screens). On the 12-column grid: what is left to spend, the bills and the month's result on the left; spending,
 * net worth, card bills and goals on the right. Every read is its own card, so a failed one shows its own alert with Retry.
 */
export function OverviewPage() {
  const { t, locale } = useI18n();
  const { month, thisMonth, today } = useMonthParam();
  const current = month === thisMonth;
  const commitments = useCommitments(month);
  const bills = useBills(month);
  const spending = useSpending(month);
  const history = useHistory(month);
  const netWorth = useNetWorth("30d");
  const savings = useSavings();
  const label = monthLabel(month, locale);
  const desktop = useMediaQuery(DESKTOP);
  const [tab, setTab] = useState<(typeof TABS)[number]>("result");

  const hero = (
    <Block label={t("overview.hero.label")} failed={t("overview.failed.month")} state={commitments}>
      {({ month: data, monthlyIncomeCents }) => <HeroCard data={data} income={monthlyIncomeCents} month={month} />}
    </Block>
  );
  const billsAlert = (
    <Block label={t("nav.bills")} failed={t("overview.failed.bills")} state={bills}>
      {(list) => <BillsAlert key={month} bills={list} today={current ? today : null} setPaid={bills.setPaid} notice={bills.notice} />}
    </Block>
  );
  const result = (
    <Block label={t("overview.result.heading")} failed={t("overview.failed.result")} state={history}>
      {(months) => <ResultCard history={months} month={month} current={current} />}
    </Block>
  );
  const split = (
    <Block label={t("overview.spending.heading", { month: monthName(month, locale).toLocaleLowerCase(locale) })} failed={t("overview.failed.transactions")} state={spending}>
      {(data) =>
        data.transactions.length === 0 ? (
          <EmptyState icon={Inbox} title={t("overview.empty.title")} message={t("overview.empty.message")} />
        ) : (
          <SpendingCard spending={data} month={month} />
        )
      }
    </Block>
  );
  const worth = (
    <Block label={t("nav.netWorth")} failed={t("overview.failed.netWorth")} state={netWorth}>
      {(data) => <NetWorthCard data={data} month={month} current={current} />}
    </Block>
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.overview")}
        subtitle={current ? t("overview.subtitle.today", { month: label, day: formatDay(today, locale) }) : label}
        month
        hideValues
      />
      {desktop ? (
        <div className="grid gap-6 desktop:grid-cols-12">
          <div className="flex flex-col gap-6 desktop:col-span-5">
            {hero}
            {billsAlert}
            {result}
          </div>
          <div className="flex flex-col gap-6 desktop:col-span-7">
            {split}
            <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16.25rem),1fr))]">
              {worth}
              <Block label={t("overview.cards.heading")} failed={t("overview.failed.cards")} state={commitments}>
                {({ month: data }) => <CardBillsCard data={data} />}
              </Block>
            </div>
            <Block label={t("nav.goals")} failed={t("overview.failed.goals")} state={savings}>
              {(data) => <GoalsCard savings={data} />}
            </Block>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {hero}
          {billsAlert}
          <SegmentedControl
            block
            label={t("overview.summary")}
            value={tab}
            onValueChange={(next) => setTab(next as (typeof TABS)[number])}
            options={TABS.map((v) => ({ value: v, label: t(`overview.tab.${v}`) }))}
          />
          {tab === "result" ? result : tab === "cats" ? split : worth}
        </div>
      )}
    </section>
  );
}
