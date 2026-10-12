import { Outlet, useLocation, useNavigate } from "react-router";
import { Card } from "../components/ui/Card";
import { useI18n } from "../i18n";
import { useInvite } from "../invite/PendingInviteProvider";
import { SignedOutInvite } from "../invite/SignedOutInvite";
import { AppearanceSetting, LanguageSetting } from "../settings/Settings";
import { HealthBanner } from "./HealthBanner";
import { SIGN_IN_PATH } from "./routes";

/**
 * The signed-out screens: full screen, no nav, one centred column with the app name. A pending Invite is
 * checked and welcomed above them. `min-h-dvh` (not a fixed height) lets the page scroll at the largest text
 * size and with the soft keyboard open. Appearance and language need no account, so they sit below.
 */
export function AuthLayout() {
  const { t } = useI18n();
  const invite = useInvite();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <main tabIndex={-1} className="page flex min-h-dvh w-full flex-col justify-center focus:outline-none">
      <header className="text-center">
        <h1>{t("app.name")}</h1>
        <p>{t("home.tagline")}</p>
      </header>
      <HealthBanner />
      {invite.token === null ? (
        <Outlet />
      ) : (
        <SignedOutInvite
          token={invite.token}
          onDismiss={() => {
            // A dead Invite: forget it and show sign-in (with an Invite pending, the landing is sign-up).
            invite.clear();
            navigate(SIGN_IN_PATH, { replace: true, state: location.state });
          }}
        >
          <Outlet />
        </SignedOutInvite>
      )}
      <Card as="section" aria-label={t("settings.heading")}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-x-4">
          <AppearanceSetting />
          <LanguageSetting />
        </div>
      </Card>
    </main>
  );
}
