/** Names a non-production build on every screen: staging's CloudFront URL is random, so it cannot. Untranslated on purpose. */
export function EnvironmentBadge({ environment }: { environment: string | undefined }) {
  if (!environment || environment === "production") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 flex justify-center">
      <span className="rounded-b-md bg-text px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-surface">
        {environment.toUpperCase()}
      </span>
    </div>
  );
}
