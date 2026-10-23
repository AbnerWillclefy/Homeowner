import { ChoresSection } from "../../../domains/chores/components/ChoresSection";
import { HomeGate } from "../../../domains/home/components/HomeGate";
import { ChoresPageSkeleton } from "../../../domains/home/components/HomeSkeleton";
import { useI18n } from "../../../shared/i18n";
import { PageLoading } from "../../../shared/ui/PageLoading";

/** Chores: the list, add and edit. */
export function ChoresPage() {
  const { t } = useI18n();
  return (
    <PageLoading message={t("chores.loading")}>
      <HomeGate skeleton={<ChoresPageSkeleton />}>{() => <ChoresSection />}</HomeGate>
    </PageLoading>
  );
}
