import { HomeDay } from "../../domains/home/components/HomeDay";
import { HomeGate } from "../../domains/home/components/HomeGate";
import { TodaySkeleton } from "../../domains/home/components/HomeSkeleton";
import { useI18n } from "../../shared/i18n";
import { PageLoading } from "../../shared/ui/PageLoading";
import { useSession } from "./SessionProvider";

/**
 * Today: the Check-in and the Day Plan. It stays in the main bundle with the sign-in path; every other screen is
 * its own module under `pages/`, loaded on demand (see AppRoutes).
 */
export function TodayPage() {
  const { t } = useI18n();
  const { after } = useSession();
  return (
    <PageLoading message={t("dayplan.loading")}>
      {after === "already-here" && <p role="status">{t("invite.alreadyHere")}</p>}
      <HomeGate reserve skeleton={<TodaySkeleton />}>{() => <HomeDay />}</HomeGate>
    </PageLoading>
  );
}
