import { Navigate, useLocation, useNavigate } from "react-router";
import { Confirm } from "../../domains/auth/components/Confirm";
import { SignIn } from "../../domains/auth/components/SignIn";
import { SignUp } from "../../domains/auth/components/SignUp";
import { useToast } from "../../shared/ui/useToast";
import { useAppAuth } from "./AuthProvider";
import { CONFIRM_PATH, SIGN_IN_PATH, SIGN_UP_PATH, authState, confirmNeedsEmail, type AuthRouteState } from "../logic/routes";

/** The state of the screen we are on; every hop forwards `from` (see authState). */
function useAuthNav() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const current = (state ?? {}) as AuthRouteState;
  return { current, go: (path: string, patch: Parameters<typeof authState>[1] = {}) => navigate(path, { state: authState(state, patch) }) };
}

export function SignInPage() {
  const auth = useAppAuth();
  const { current, go } = useAuthNav();
  return (
    <SignIn
      initialEmail={current.email}
      logIn={auth.logIn}
      onNeedsConfirm={(email) => go(CONFIRM_PATH, { email })}
      onNeedsSignUp={() => go(SIGN_UP_PATH)}
    />
  );
}

export function SignUpPage() {
  const auth = useAppAuth();
  const { go } = useAuthNav();
  return (
    <SignUp register={auth.register} onRegistered={(email) => go(CONFIRM_PATH, { email })} onHaveLogin={() => go(SIGN_IN_PATH)} />
  );
}

export function ConfirmPage() {
  const auth = useAppAuth();
  const toast = useToast();
  const { state } = useLocation();
  const { current, go } = useAuthNav();
  // A direct hit has no email to confirm.
  if (confirmNeedsEmail(state)) return <Navigate to={SIGN_UP_PATH} replace state={authState(state)} />;
  return (
    <Confirm
      email={current.email ?? ""}
      confirm={auth.confirm}
      resend={auth.resend}
      onConfirmed={(email) => {
        // A toast outlives this screen, so it is still there on the sign-in screen.
        toast.show({ messageKey: "signIn.confirmedNotice", tone: "success" });
        go(SIGN_IN_PATH, { email });
      }}
      onBack={() => go(SIGN_UP_PATH)}
    />
  );
}
