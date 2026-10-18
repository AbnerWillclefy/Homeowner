import type { Page } from "@playwright/test";
import { SESSION_KEY, type Session } from "../../src/domains/auth/logic/session";
import { makeIdToken } from "./tokens";

// Year 2100. A token with under a minute left makes authedFetch call Cognito, which would be an unmocked request.
const FAR_FUTURE_MS = Date.UTC(2100, 0, 1);

/**
 * Puts a signed-in session in the browser before the app starts. It writes only once per browser tab, and only
 * while the key is absent, so a session the app later clears (expired token, sign-out) stays cleared across
 * reloads and navigations instead of being silently restored.
 */
export async function seedSession(page: Page, options: { email?: string; expiresAt?: number } = {}): Promise<void> {
  const email = options.email ?? "e2e@example.test";
  const expiresAt = options.expiresAt ?? FAR_FUTURE_MS;
  const session: Session = {
    idToken: makeIdToken({ email, sub: "user-1", exp: Math.floor(expiresAt / 1000) }),
    refreshToken: "e2e-refresh-token",
    expiresAt,
  };
  await page.addInitScript(
    ({ key, value }) => {
      const marker = "e2e.session.seeded";
      if (sessionStorage.getItem(marker) !== null) return;
      sessionStorage.setItem(marker, "1");
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: SESSION_KEY, value: JSON.stringify(session) },
  );
}

/** The session the app has stored in the browser, or null when there is none. */
export async function storedSession(page: Page): Promise<Session | null> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY);
  return raw === null ? null : (JSON.parse(raw) as Session);
}
