import { Outlet, useLocation, useNavigate } from "react-router";
import { useInvite } from "../invite/PendingInviteProvider";
import { SignedOutInvite } from "../invite/SignedOutInvite";
import { Settings } from "../settings/Settings";
import { PageFrame } from "./PageFrame";
import { SIGN_IN_PATH } from "./routes";

/** The signed-out screens: full screen, no nav. A pending Invite is checked and welcomed above them. */
export function AuthLayout() {
  const invite = useInvite();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <PageFrame>
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
      {/* Appearance and language need no account. */}
      <Settings />
    </PageFrame>
  );
}
