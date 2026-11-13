import { EmptyState } from "@homeowner/bedrock";
import { Inbox } from "lucide-react";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { Allowance } from "./components/Allowance";
import { BillsBlock } from "./components/BillsBlock";
import { Block } from "./components/Block";
import { LeftOutGroup } from "./components/LeftOutGroup";
import { Leftover } from "./components/Leftover";
import { MonthPicker } from "./components/MonthPicker";
import { Pace } from "./components/Pace";
import { useBills, useCommitments, useMonthTransactions } from "./hooks/useOverviewData";
import { useOverviewMonth } from "./hooks/useOverviewMonth";
import { monthView } from "./logic/monthView";

/** The month at a glance. Three reads, three independent blocks: a failed one shows its own alert with Retry. */
export function OverviewPage() {
  const { t } = useI18n();
  const { month, thisMonth, today, step } = useOverviewMonth();
  const commitments = useCommitments(month);
  const bills = useBills(month);
  const transactions = useMonthTransactions(month);
  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t("nav.overview")}</h1>
      <MonthPicker month={month} thisMonth={thisMonth} step={step} />
      <Block failed={t("overview.failed.month")} query={commitments}>
        {({ month: data, monthlyIncomeCents }) => (
          <>
            <Allowance cents={data.dailyAllowanceCents} hasIncome={monthlyIncomeCents !== null} />
            <Leftover data={data} income={monthlyIncomeCents} />
            {data.pace && <Pace pace={data.pace} month={month} />}
          </>
        )}
      </Block>
      <Block failed={t("overview.failed.bills")} query={bills}>
        {(list) => <BillsBlock bills={list} month={month} today={today} />}
      </Block>
      <Block failed={t("overview.failed.transactions")} query={transactions}>
        {(data) => {
          const view = monthView(data);
          return view.isEmpty ? (
            <EmptyState icon={Inbox} title={t("overview.empty.title")} message={t("overview.empty.message")} />
          ) : (
            <LeftOutGroup transfers={view.transfers} savings={view.savings} income={view.income} />
          );
        }}
      </Block>
    </section>
  );
}
