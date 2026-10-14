import { ONBOARDING_STEPS, type OnboardingStep } from "../../domains/onboarding/api/api";

export const TODAY_PATH = "/";
export const CHORES_PATH = "/chores";
export const HOME_PATH = "/home";
export const ME_PATH = "/me";
export const SIGN_IN_PATH = "/signin";
export const SIGN_UP_PATH = "/signup";
export const CONFIRM_PATH = "/confirm";
export const WELCOME_PREFIX = "/welcome";

/** The four tabs, in nav order. */
export const SHELL_PATHS = [TODAY_PATH, CHORES_PATH, HOME_PATH, ME_PATH] as const;

/** The full-screen signed-out screens. */
export const AUTH_PATHS = [SIGN_IN_PATH, SIGN_UP_PATH, CONFIRM_PATH] as const;

/** Drops the search, the hash and a trailing slash, so `/chores/?x=1#y` is `/chores`. */
export function normalizePath(path: string): string {
  const bare = path.split("#")[0]!.split("?")[0]!;
  if (bare.length > 1 && bare.endsWith("/")) return bare.replace(/\/+$/, "") || "/";
  return bare === "" ? "/" : bare;
}

export const isAuthPath = (path: string): boolean => (AUTH_PATHS as readonly string[]).includes(normalizePath(path));
export const isShellPath = (path: string): boolean => (SHELL_PATHS as readonly string[]).includes(normalizePath(path));

export function isWelcomePath(path: string): boolean {
  const p = normalizePath(path);
  return p === WELCOME_PREFIX || p.startsWith(`${WELCOME_PREFIX}/`);
}

export const stepPath = (step: OnboardingStep): string => `${WELCOME_PREFIX}/${step}`;

/** The onboarding step a path names, or null for anything else (including `/welcome` and unknown ids). */
export function stepFromPath(path: string): OnboardingStep | null {
  const p = normalizePath(path);
  if (!p.startsWith(`${WELCOME_PREFIX}/`)) return null;
  const id = p.slice(WELCOME_PREFIX.length + 1);
  return (ONBOARDING_STEPS as readonly string[]).includes(id) ? (id as OnboardingStep) : null;
}

/**
 * The path a signed-out person wanted, kept only if it is safe to return to: a same-origin path that is neither
 * an auth screen nor onboarding. Anything else is null, so router state can never become an open redirect.
 */
export function safeWantedPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const p = normalizePath(value);
  if (isAuthPath(p) || isWelcomePath(p)) return null;
  return p;
}

/** What the three auth screens carry in router state between hops. */
export interface AuthRouteState {
  /** Where the person was headed before they were sent to sign in. */
  from?: string;
  email?: string;
}

/** The state for the next auth screen: `patch`, with `from` always forwarded from `prev`. */
export function authState(prev: unknown, patch: Omit<AuthRouteState, "from"> = {}): AuthRouteState {
  const from = safeWantedPath((prev as AuthRouteState | null | undefined)?.from);
  return from === null ? { ...patch } : { ...patch, from };
}

/** A direct hit on /confirm has no email to confirm, so the page sends the person to sign-up. */
export function confirmNeedsEmail(state: unknown): boolean {
  const email = (state as AuthRouteState | null | undefined)?.email;
  return typeof email !== "string" || email === "";
}
