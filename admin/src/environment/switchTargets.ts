import type { AdminUrls, Environment } from "../config";

export interface SwitchTarget {
  environment: Environment;
  /** The other environment's admin URL with this page's path and query, or null when it is not configured. */
  href: string | null;
}

/**
 * The environments to offer a switch to. Staging and production each offer only the other one, even when its
 * URL is missing (href is then null, so the screen can say so). Local offers whichever others the map has.
 */
export function switchTargets(
  current: Environment,
  urls: AdminUrls,
  location: { pathname: string; search: string },
): SwitchTarget[] {
  const others: Environment[] =
    current === "staging" ? ["production"] : current === "production" ? ["staging"] : (["staging", "production"] as const).filter((e) => urls[e] !== undefined);
  return others.map((environment) => {
    const origin = urls[environment];
    return { environment, href: origin === undefined ? null : `${origin}${location.pathname}${location.search}` };
  });
}
