import type { Home } from "../api/home";
import { SignedIn } from "../auth/SignedIn";
import { ChoresSection } from "../chores/ChoresSection";
import { HomeDay } from "../home/HomeDay";
import { HomeGate } from "../home/HomeGate";
import { HomeSettingsForm } from "../home/HomeSettingsForm";
import { LeaveHome } from "../home/LeaveHome";
import { useI18n } from "../i18n";
import { InviteShare } from "../invite/InviteShare";
import { MeProfile } from "../profile/MeProfile";
import { AppearanceCard, LanguageCard } from "../settings/Settings";
import { useAppAuth } from "./AuthProvider";
import { useSession } from "./SessionProvider";
import { useShell } from "./ShellContext";

/** Today: the Check-in and the Day Plan. */
export function TodayPage() {
  const { t } = useI18n();
  const { planVersion, planChanged } = useShell();
  const { after } = useSession();
  return (
    <>
      {after === "already-here" && <p role="status">{t("invite.alreadyHere")}</p>}
      <HomeGate>{() => <HomeDay version={planVersion} onPlanChanged={planChanged} />}</HomeGate>
    </>
  );
}

/** Chores: the list, add and edit. */
export function ChoresPage() {
  return <HomeGate>{() => <ChoresSection />}</HomeGate>;
}

/** Home: its settings, the Invite to share, and Leave. */
export function HomePage() {
  const { recovered, setRecovered } = useSession();
  const { home } = useShell();
  const { t } = useI18n();
  return (
    <HomeGate>
      {(current: Home) => (
        <div className="flex flex-col gap-4">
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
  );
}

/**
 * Me: one titled card each for the Baseline, Preferences, Restrictions, Appearance and Language,
 * then the account card with sign out last. MePage owns the column, so the cards after
 * the Restrictions still show when the details fail to load.
 */
export function MePage() {
  const auth = useAppAuth();
  if (auth.state.kind !== "signed-in") return null;
  return (
    <div className="flex flex-col gap-4">
      <MeProfile />
      <AppearanceCard />
      <LanguageCard />
      {/* Signing out is on purpose: the guard then sends the person to sign-in without remembering this tab. */}
      <SignedIn email={auth.state.email} offline={auth.state.offline} onSignOut={auth.signOut} />
    </div>
  );
}
