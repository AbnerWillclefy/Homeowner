import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import { useSavings } from "../hooks/useSavings";
import { ContributionCard } from "./ContributionCard";
import { GoalsCard } from "./GoalsCard";
import { InvestmentsCard } from "./InvestmentsCard";
import { ReserveCard } from "./ReserveCard";

/** The Economias tab body, at /finances/economias: Monthly contribution, Emergency reserve target, Goals and Investments. */
export function SavingsCards() {
  const { t } = useI18n();
  const savings = useSavings();
  const { state, refreshing, reload } = savings;
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing);
  if (state.kind === "loading")
    return skeleton ? (
      <div aria-hidden="true">
        <SkeletonBar className="h-5 w-full" />
      </div>
    ) : null;
  if (state.kind === "failed")
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="my-0 font-semibold">
          {t("finances.savings.failed")}
        </p>
        <Button variant="secondary" onClick={() => void reload()}>
          {t("finances.load.retry")}
        </Button>
      </div>
    );
  const data = state.data;
  return (
    <div className="flex flex-col gap-4">
      <ContributionCard savings={data} save={savings.saveContribution} />
      <ReserveCard savings={data} save={savings.saveReserve} />
      <GoalsCard goals={data.goals} save={savings.saveGoal} remove={savings.removeGoal} reorder={savings.reorder} />
      <InvestmentsCard investments={data.investments} save={savings.saveInvestment} remove={savings.removeInvestment} />
    </div>
  );
}
