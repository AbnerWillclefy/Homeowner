import { SignedIn } from "./auth/SignedIn";
import { SignedOutFlow } from "./auth/SignedOutFlow";
import { useAuth } from "./auth/useAuth";
import { Reminders } from "./push/Reminders";
import { useHealth, type HealthState } from "./useHealth";

const STATUS_TEXT: Record<HealthState["kind"], string> = {
  loading: "Checking the service...",
  ok: "Service status: ok",
  unavailable: "Service status: unavailable. The service is up but cannot reach its database.",
  unreachable: "Service status: unreachable. Check your connection and try again.",
};

export default function App() {
  const { state, retry } = useHealth();
  const auth = useAuth();

  return (
    <main className="home">
      <h1>Homeowner</h1>
      <p>Share the housework in your Home fairly.</p>
      <p role="status" data-state={state.kind}>
        {STATUS_TEXT[state.kind]}
      </p>
      {(state.kind === "unavailable" || state.kind === "unreachable") && (
        <button type="button" onClick={retry}>
          Try again
        </button>
      )}

      {auth.state.kind === "loading" && <p role="status">Checking your sign-in...</p>}
      {auth.state.kind === "signed-out" && (
        <SignedOutFlow register={auth.register} confirm={auth.confirm} resend={auth.resend} logIn={auth.logIn} />
      )}
      {auth.state.kind === "signed-in" && (
        <>
          <SignedIn email={auth.state.email} offline={auth.state.offline} onSignOut={auth.signOut} />
          {/* Reminders and the launch re-subscribe call protected routes, so they exist only while signed in. */}
          <Reminders />
        </>
      )}
    </main>
  );
}
