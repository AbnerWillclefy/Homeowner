import type { Environment } from "../config";

// Whole class strings, so Tailwind finds them. Text always names the environment: colour is never the only cue.
const LOOK: Record<Environment, string> = {
  production: "bg-danger text-surface-raised border-danger",
  staging: "bg-accent text-accent-contrast border-accent",
  local: "bg-surface-raised text-text border-border",
};

export function EnvironmentBadge({ environment }: { environment: Environment }) {
  return (
    <span className={`inline-flex items-center rounded-control border px-2 py-0.5 font-mono text-xs font-semibold tracking-wider ${LOOK[environment]}`}>
      <span className="sr-only">Environment: </span>
      {environment.toUpperCase()}
    </span>
  );
}
