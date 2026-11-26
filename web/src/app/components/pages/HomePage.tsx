import { List } from "@homeowner/bedrock";
import type { Home } from "../../../domains/home/api/api";
import { HomeGate } from "../../../domains/home/components/HomeGate";
import { HomeSettingsRow } from "../../../domains/home/components/HomeSettingsRow";
import { HomeSkeleton } from "../../../domains/home/components/HomeSkeleton";
import { LeaveHome } from "../../../domains/home/components/LeaveHome";
import { formatAllocationTime } from "../../../domains/home/logic/allocationTimes";
import { InviteShare } from "../../../domains/invite/components/InviteShare";
import { ResidentsCard } from "../../../domains/residents/components/ResidentsCard";
import { useI18n } from "../../../shared/i18n";
import { PageLoading } from "../../../shared/ui/PageLoading";
import { TabBody } from "../TabBody";
import { TabHeader } from "../TabHeader";
import { useSession } from "../SessionProvider";
import { useShell } from "../ShellContext";

/** Home: its Residents with the Invite, the Home's settings as a Row that opens a Sheet, and Leave last. */
export function HomePage() {
  const { recovered, setRecovered } = useSession();
  const { home } = useShell();
  const { t, locale } = useI18n();
  return (
    <PageLoading message={t("home.loading")}>
      <HomeGate skeleton={<HomeSkeleton />}>
        {(current: Home) => (
          <>
            <TabHeader
              title={t("home.settings.heading")}
              subtitle={t("home.summary", {
                time: formatAllocationTime(current.allocationTime, locale),
                zone: current.timezone.replaceAll("_", " "),
              })}
            />
            <TabBody>
              {recovered !== "no" && (
                <p role="status" className="my-0">
                  {t(recovered === "chores-dropped" ? "home.create.recovered.chores" : "home.create.recovered")}
                </p>
              )}
              <ResidentsCard>
                <InviteShare />
              </ResidentsCard>
              <section aria-labelledby="home-group-heading" className="mt-0 flex flex-col gap-2">
                <h2 id="home-group-heading" className="my-0 text-sm font-medium text-muted">
                  {t("home.group.home")}
                </h2>
                <List>
                  <HomeSettingsRow
                    key={current.id}
                    home={current}
                    onShow={(shown: Home) => {
                      setRecovered("no");
                      void home.setHome(shown);
                    }}
                  />
                </List>
              </section>
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
