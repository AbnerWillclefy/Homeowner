import { createHash } from "node:crypto";
import type { Fake } from "./router";

/** The host the e2e build loads the stub from (web/.env.e2e, VITE_PLUGGY_CONNECT_URL). */
export const PLUGGY_CDN_HOST = "cdn.pluggy.test";

/**
 * A stand-in for Pluggy Connect. `init()` does what the spec chose with `page.addInitScript`: set
 * `window.__pluggyMode` to "success" (calls onSuccess with `window.__pluggyItemId`, default "item-e2e-1"), "error",
 * or leave it unset to close the widget with nothing connected. It records what it was given on `window.__pluggyOptions`.
 */
export const PLUGGY_STUB = `window.PluggyConnect = class PluggyConnect {
  constructor(options) {
    this.options = options;
    window.__pluggyOptions = { connectToken: options.connectToken, includeSandbox: options.includeSandbox };
  }
  init() {
    const mode = window.__pluggyMode;
    if (mode === "success") this.options.onSuccess({ item: { id: window.__pluggyItemId || "item-e2e-1" } });
    else if (mode === "error") this.options.onError({ message: "widget failed" });
    else this.options.onClose();
  }
};
`;

/** What `web/.env.e2e` must hold as VITE_PLUGGY_CONNECT_SRI: the stub's own hash, so the browser still checks `integrity`. */
export const PLUGGY_STUB_SRI = `sha384-${createHash("sha384").update(PLUGGY_STUB).digest("base64")}`;

export interface FakePluggyCdn extends Fake {
  /** Every request the CDN received, in order. Empty until the User taps Connect banks. */
  requests: string[];
}

/** The Pluggy CDN: serves the stub script and nothing else. Not automatic: a spec asks for it with the `pluggyCdn` fixture. */
export function createFakePluggyCdn(): FakePluggyCdn {
  const requests: string[] = [];
  return {
    name: "pluggy-cdn",
    requests,
    matches: (url) => url.host === PLUGGY_CDN_HOST,
    handle(request) {
      requests.push(`${request.method} ${request.path}`);
      if (request.method === "GET" && request.path === "/pluggy-connect.js") {
        return { status: 200, text: PLUGGY_STUB, headers: { "content-type": "text/javascript" } };
      }
      return null;
    },
  };
}
