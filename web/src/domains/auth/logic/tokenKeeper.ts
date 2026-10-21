import type { RefreshResult } from "../api/cognito";
import type { Session, SessionStore } from "./session";

/** Refresh a token that has less than this left, so a request does not race the expiry. */
export const REFRESH_MARGIN_MS = 60_000;

export type RefreshOutcome = "refreshed" | "rejected" | "unavailable";

export interface TokenKeeperDeps {
  session: SessionStore;
  refresh(refreshToken: string): Promise<RefreshResult>;
  now(): number;
}

export interface TokenKeeper {
  /**
   * The session to send a request with, refreshed first when it expires within the margin. Null when there
   * is none, or Cognito rejected it. An unreachable Cognito keeps the old session (the person may be offline).
   */
  usableSession(): Promise<Session | null>;
  /** After a 401 on a request that used `used`: refresh once, however many callers ask at the same time. */
  afterUnauthorized(used: Session): Promise<RefreshOutcome>;
  /** The API turned down even a freshly refreshed token: the session is over. */
  rejectSession(): void;
}

/**
 * The refresh rules, with no transport. Both the fetch helper and the Axios client share one keeper, so two
 * requests that both need a new token send one refresh to Cognito, not two with the same refresh token.
 */
export function createTokenKeeper(deps: TokenKeeperDeps): TokenKeeper {
  let inflight: Promise<RefreshOutcome> | null = null;

  async function doRefresh(used: Session): Promise<RefreshOutcome> {
    const current = deps.session.load();
    if (current === null) return "rejected";
    // Another request already replaced the token this one used; just use the new one.
    if (current.idToken !== used.idToken) return "refreshed";

    const result = await deps.refresh(current.refreshToken);
    if (result.kind === "ok") {
      deps.session.save({
        idToken: result.tokens.idToken,
        refreshToken: result.tokens.refreshToken ?? current.refreshToken,
        expiresAt: deps.now() + result.tokens.expiresInSeconds * 1000,
      });
      return "refreshed";
    }
    if (result.kind === "not-authorized") {
      deps.session.clear();
      return "rejected";
    }
    return "unavailable";
  }

  function refreshOnce(used: Session): Promise<RefreshOutcome> {
    inflight ??= doRefresh(used).finally(() => {
      inflight = null;
    });
    return inflight;
  }

  return {
    async usableSession() {
      const session = deps.session.load();
      if (session === null) return null;
      if (!deps.session.expiresWithin(session, REFRESH_MARGIN_MS)) return session;
      if ((await refreshOnce(session)) === "rejected") return null;
      return deps.session.load();
    },
    afterUnauthorized: refreshOnce,
    rejectSession: () => deps.session.clear(),
  };
}
