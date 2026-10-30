import type { Environment } from "../config";

/**
 * Persistent error when the build's environment and the API's disagree. The app stays usable on purpose, so the
 * maintainer can see what is wrong. Renders nothing while the API's environment is unknown or the same.
 */
export function MismatchBanner({ build, server }: { build: Environment; server: string | undefined }) {
  if (server === undefined || server === build) return null;
  return (
    <div role="alert" className="border-b-4 border-danger bg-surface-raised px-4 py-3 text-sm font-semibold text-danger md:px-6">
      This build says {build} but the API says {server}. Check VITE_API_URL and VITE_ENVIRONMENT before doing anything.
    </div>
  );
}
