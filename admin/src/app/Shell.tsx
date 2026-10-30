import { useAdminMe } from "../api/adminMe";
import { useAuth } from "../auth/AuthContext";
import { SignIn } from "../auth/SignIn";
import { config } from "../config";
import { EnvironmentBadge } from "../environment/EnvironmentBadge";
import { EnvironmentSwitch } from "../environment/EnvironmentSwitch";
import { MismatchBanner } from "../environment/MismatchBanner";
import { Button } from "../shared/Button";
import { AppRoutes } from "./AppRoutes";
import { Gate } from "./Gate";

/**
 * Everything that shows on every page: the skip link, the mismatch banner, and a header with the environment
 * badge and switch. The badge comes from the build, so it shows on sign-in and the not-allowed screen too.
 */
export function Shell() {
  const { signedIn, signOut } = useAuth();
  // Only asked once signed in. Gate reads the same cached answer.
  const me = useAdminMe(signedIn);
  const serverEnvironment = me.data?.kind === "ok" ? me.data.environment : undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-20 focus:rounded-control focus:bg-surface-raised focus:px-4 focus:py-3 focus:font-semibold"
      >
        Skip to main content
      </a>
      <MismatchBanner build={config.environment} server={serverEnvironment} />
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/50 bg-surface-raised px-4 py-2 md:px-6">
        <span className="font-mono text-sm font-semibold">
          homeowner<span className="text-muted">/admin</span>
        </span>
        <EnvironmentBadge environment={config.environment} />
        <EnvironmentSwitch current={config.environment} urls={config.adminUrls} />
        {signedIn && (
          <Button variant="secondary" className="ml-auto" onClick={signOut}>
            Sign out
          </Button>
        )}
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        {signedIn ? (
          <Gate>
            <AppRoutes />
          </Gate>
        ) : (
          <SignIn />
        )}
      </main>
    </div>
  );
}
