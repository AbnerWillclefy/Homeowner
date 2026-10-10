import { useHealth, type HealthState } from "./useHealth";

const STATUS_TEXT: Record<HealthState["kind"], string> = {
  loading: "Checking the service...",
  ok: "Service status: ok",
  unavailable: "Service status: unavailable. The service is up but cannot reach its database.",
  unreachable: "Service status: unreachable. Check your connection and try again.",
};

export default function App() {
  const { state, retry } = useHealth();

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
    </main>
  );
}
