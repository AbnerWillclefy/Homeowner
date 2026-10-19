import type { Home } from "../../domains/home/api/api";
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

/** Home: its settings, the Invite to share, and Leave. */
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
            <HomeSettingsForm
              key={current.id}
              home={current}
              onSaved={(saved: Home) => {
                setRecovered("no");
                home.setHome(saved);
              }}
            />
            <InviteShare />
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
 * Me: one titled card each for the Baseline, Preferences, Restrictions and the settings (Appearance and
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
        <PageHeader title={t("me.heading")} />
        <MeProfile />
        <SettingsCard />
        {/* Signing out is on purpose: the guard then sends the person to sign-in without remembering this tab. */}
        <SignedIn email={auth.state.email} offline={auth.state.offline} onSignOut={auth.signOut} />
      </div>
    </PageLoading>
  );
}
