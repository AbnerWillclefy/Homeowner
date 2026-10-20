import { Settings } from "lucide-react";
import type { Home } from "../../domains/home/api/api";
import { useParams } from "react-router";
import { BackToHome } from "../../domains/residents/components/BackToHome";
import { ResidentPage } from "../../domains/residents/components/ResidentPage";
import { ResidentPageSkeleton } from "../../domains/residents/components/ResidentPageSkeleton";
import { ResidentsCard } from "../../domains/residents/components/ResidentsCard";
import { CollapsibleCard } from "../../shared/ui/CollapsibleCard";
import { SignedIn } from "../../domains/auth/components/SignedIn";
import { ChoresSection } from "../../domains/chores/components/ChoresSection";
import { HomeDay } from "../../domains/home/components/HomeDay";
import { HomeGate } from "../../domains/home/components/HomeGate";
import { HomeSettingsForm } from "../../domains/home/components/HomeSettingsForm";
import { LeaveHome } from "../../domains/home/components/LeaveHome";
import { useI18n } from "../../shared/i18n";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageLoading } from "../../shared/ui/PageLoading";
import { ChoresPageSkeleton, HomeSkeleton, TodaySkeleton } from "../../domains/home/components/HomeSkeleton";
import { formatAllocationTime } from "../../domains/home/logic/allocationTimes";
import { InviteShare } from "../../domains/invite/components/InviteShare";
import { MeHeader } from "../../domains/profile/components/MeHeader";
import { MeProfile } from "../../domains/profile/components/MeProfile";
import { SettingsCard } from "../../domains/settings/components/Settings";
import { useAppAuth } from "./AuthProvider";
import { useSession } from "./SessionProvider";
import { useShell } from "./ShellContext";

/** Today: the Check-in and the Day Plan. */
export function TodayPage() {
  const { t } = useI18n();
  const { planVersion, planChanged } = useShell();
  const { after } = useSession();
  return (
    <PageLoading message={t("dayplan.loading")}>
      {after === "already-here" && <p role="status">{t("invite.alreadyHere")}</p>}
      <HomeGate skeleton={<TodaySkeleton />}>{() => <HomeDay version={planVersion} onPlanChanged={planChanged} />}</HomeGate>
    </PageLoading>
  );
}

/** Chores: the list, add and edit. */
export function ChoresPage() {
  const { t } = useI18n();
  return (
    <PageLoading message={t("chores.loading")}>
      <HomeGate skeleton={<ChoresPageSkeleton />}>{() => <ChoresSection />}</HomeGate>
    </PageLoading>
  );
}

/** Home: its Residents, the Invite to share, its settings (folded) and Leave last. */
export function HomePage() {
  const { recovered, setRecovered } = useSession();
  const { home } = useShell();
  const { t, locale } = useI18n();
  return (
    <PageLoading message={t("home.loading")}>
      <HomeGate skeleton={<HomeSkeleton />}>
        {(current: Home) => (
          <div className="flex flex-col gap-4">
            <PageHeader title={t("home.settings.heading")}>
              {t("home.summary", {
                time: formatAllocationTime(current.allocationTime, locale),
                zone: current.timezone.replaceAll("_", " "),
              })}
            </PageHeader>
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
                  home.setHome(saved);
                }}
              />
            </CollapsibleCard>
            <LeaveHome
              onLeft={() => {
                setRecovered("no");
                home.clearHome();
              }}
            />
          </div>
        )}
      </HomeGate>
    </PageLoading>
  );
}

/**
 * A housemate's page, nested under the Home tab. The back link is outside the Home gate so it is there while the
 * Home loads and when it fails. The id comes from the address; the route always has one.
 */
export function ResidentRoute() {
  const { t } = useI18n();
  const { id } = useParams();
  if (id === undefined) return null;
  return (
    <PageLoading message={t("resident.loading")}>
      <BackToHome />
      <HomeGate skeleton={<ResidentPageSkeleton />}>{(current: Home) => <ResidentPage id={id} timeZone={current.timezone} />}</HomeGate>
    </PageLoading>
  );
}

/**
 * Me: the header (Avatar, name, email, Streak), then one titled card each for the Baseline, Preferences, Restrictions and the settings (Appearance and
 * Language), then the account card with sign out last. MePage owns the column, so the cards after
 * the Restrictions still show when the details fail to load.
 */
export function MePage() {
  const { t } = useI18n();
  const auth = useAppAuth();
  if (auth.state.kind !== "signed-in") return null;
  return (
    <PageLoading message={t("profile.loading")}>
      <div className="flex flex-col gap-4">
        <MeHeader />
        <MeProfile />
        <SettingsCard />
        {/* Signing out is on purpose: the guard then sends the person to sign-in without remembering this tab. */}
        <SignedIn email={auth.state.email} offline={auth.state.offline} onSignOut={auth.signOut} />
      </div>
    </PageLoading>
  );
}
