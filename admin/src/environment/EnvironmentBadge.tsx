import type { Environment } from "../config";

// Whole class strings, so Tailwind finds them. Text always names the environment: colour is never the only cue.
const LOOK: Record<Environment, string> = {
  production: "bg-danger text-surface-raised border-danger",
  staging: "bg-accent text-accent-contrast border-accent",
  local: "bg-surface-raised text-text border-border",
};

export function EnvironmentBadge({ environment }: { environment: Environment }) {
  return (
    <span className={`inline-flex items-center rounded-pill border px-3 py-1 text-sm font-bold tracking-wide ${LOOK[environment]}`}>
      <span className="sr-only">Environment: </span>
      {environment.toUpperCase()}
    </span>
  );
}
