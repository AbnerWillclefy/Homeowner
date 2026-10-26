import { useLocation } from "react-router";
import type { AdminUrls, Environment } from "../config";
import { switchTargets } from "./switchTargets";

function capitalised(environment: Environment): string {
  return environment.charAt(0).toUpperCase() + environment.slice(1);
}

/**
 * A plain link (not a router link: it leaves this origin) to the other environment's admin, on the same page.
 * With no URL configured it is disabled text, not a broken link.
 */
export function EnvironmentSwitch({ current, urls }: { current: Environment; urls: AdminUrls }) {
  const { pathname, search } = useLocation();
  const targets = switchTargets(current, urls, { pathname, search });
  if (targets.length === 0) return null;
  return (
    <ul className="m-0 flex list-none gap-4 p-0">
      {targets.map(({ environment, href }) => (
        <li key={environment} className="m-0">
          {href === null ? (
            <span className="text-muted">{capitalised(environment)} URL not configured</span>
          ) : (
            <a
              href={href}
              aria-label={`Switch to ${environment} admin`}
              className="inline-flex min-h-11 items-center text-accent underline underline-offset-4"
            >
              Switch to {environment}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
