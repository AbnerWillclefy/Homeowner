import { Settings } from "lucide-react";
import type { Home } from "../../../domains/home/api/api";
import { HomeGate } from "../../../domains/home/components/HomeGate";
import { HomeSettingsForm } from "../../../domains/home/components/HomeSettingsForm";
import { HomeSkeleton } from "../../../domains/home/components/HomeSkeleton";
import { LeaveHome } from "../../../domains/home/components/LeaveHome";
import { formatAllocationTime } from "../../../domains/home/logic/allocationTimes";
import { InviteShare } from "../../../domains/invite/components/InviteShare";
import { ResidentsCard } from "../../../domains/residents/components/ResidentsCard";
import { useI18n } from "../../../shared/i18n";
import { CollapsibleCard } from "../../../shared/ui/CollapsibleCard";
import { PageLoading } from "../../../shared/ui/PageLoading";
import { TabBody } from "../TabBody";
import { TabHeader } from "../TabHeader";
import { useSession } from "../SessionProvider";
import { useShell } from "../ShellContext";

/** Home: its Residents, the Invite to share, its settings (folded) and Leave last. */
export function HomePage() {
  const { recovered, setRecovered } = useSession();
  const { home } = useShell();
  const { t, locale } = useI18n();
  return (
    <PageLoading message={t("home.loading")}>
      <HomeGate skeleton={<HomeSkeleton />}>
        {(current: Home) => (
          <>
            <TabHeader title={t("home.settings.heading")} />
            <TabBody>
            {/* A paragraph, not the header's subtitle: the subtitle is one truncated line, and this holds the zone. */}
            <p className="my-0 text-muted">
              {t("home.summary", {
                time: formatAllocationTime(current.allocationTime, locale),
                zone: current.timezone.replaceAll("_", " "),
              })}
            </p>
            {recovered !== "no" && (
              <p role="status">{t(recovered === "chores-dropped" ? "home.create.recovered.chores" : "home.create.recovered")}</p>
            )}
            <ResidentsCard />
            <InviteShare />
            <CollapsibleCard
              id="home-settings-card-heading"
              icon={Settings}
              title={t("home.settings.card.title")}
              hint={t("home.settings.card.hint")}
            >
              <HomeSettingsForm
                key={current.id}
                home={current}
                onSaved={(saved: Home) => {
                  setRecovered("no");
                  void home.setHome(saved);
                }}
              />
            </CollapsibleCard>
            <LeaveHome
              onLeft={() => {
                setRecovered("no");
                void home.clearHome();
              }}
            />
            </TabBody>
          </>
        )}
      </HomeGate>
    </PageLoading>
  );
}
