import { Outlet, useLocation, useNavigate } from "react-router";
import { useInvite } from "../../domains/invite/components/PendingInviteProvider";
import { SignedOutInvite } from "../../domains/invite/components/SignedOutInvite";
import { SettingsCard } from "../../domains/settings/components/Settings";
import { PageFrame } from "./PageFrame";
import { SIGN_IN_PATH } from "../logic/routes";

/**
 * The signed-out screens: full screen, no nav, one centred column with the app name. A pending Invite is
 * checked and welcomed above them. `min-h-dvh` (not a fixed height) lets the page scroll at the largest text
 * size and with the soft keyboard open. Appearance and language need no account, so they sit below.
 */
export function AuthLayout() {
  const invite = useInvite();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <PageFrame className="flex min-h-dvh flex-col justify-center">
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
      <div className="mt-8">
        <SettingsCard />
      </div>
    </PageFrame>
  );
}
