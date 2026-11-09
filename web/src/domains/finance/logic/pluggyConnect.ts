/** What Pluggy Connect takes and calls back with; only the parts the app uses. */
export interface PluggyOptions {
  connectToken: string;
  includeSandbox: boolean;
  onSuccess(data: { item: { id: string } }): void | Promise<void>;
  onError(error: unknown): void;
  onClose(): void;
}

interface PluggyWindow {
  PluggyConnect?: new (options: PluggyOptions) => { init(): void };
}

export interface PinnedScript {
  url: string;
  integrity: string;
}

/**
 * The exact version and its hash, from ADR 0019. The script runs in the app's origin, where the session tokens are
 * kept, so the pin is the guard. A version bump recomputes the hash.
 */
export const PINNED_SCRIPT: PinnedScript = {
  url: "https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js",
  integrity: "sha384-EfJtVYPBw2vssrS8cou8sSUccnxm72OwXqa4V+b1injWH0avP4mtCJr2XM6Sb2/7",
};

/** Only the e2e build sets both variables, to point at a stub; a URL without its hash is ignored. */
export function pinnedScript(env: { VITE_PLUGGY_CONNECT_URL?: string; VITE_PLUGGY_CONNECT_SRI?: string }): PinnedScript {
  const { VITE_PLUGGY_CONNECT_URL: url, VITE_PLUGGY_CONNECT_SRI: integrity } = env;
  return url && integrity ? { url, integrity } : PINNED_SCRIPT;
}

/**
 * Opens Pluggy Connect. The script is added to the page on the first call only, never before, and a failed load is
 * tried again on the next call. The returned promise rejects when the script cannot load.
 */
export function createPluggyConnect(doc: Document, win: PluggyWindow, script: PinnedScript) {
  let loading: Promise<void> | null = null;

  function load(): Promise<void> {
    return new Promise((resolve, reject) => {
      const el = doc.createElement("script");
      el.setAttribute("src", script.url);
      el.setAttribute("integrity", script.integrity);
      el.setAttribute("crossorigin", "anonymous");
      el.onload = () => resolve();
      el.onerror = () => reject(new Error("pluggy connect did not load"));
      doc.head.appendChild(el);
    });
  }

  return async function open(options: PluggyOptions): Promise<void> {
    loading ??= load();
    try {
      await loading;
    } catch (error) {
      loading = null;
      throw error;
    }
    if (!win.PluggyConnect) throw new Error("pluggy connect is missing");
    new win.PluggyConnect(options).init();
  };
}

/** The browser's own, created on first use so nothing touches `document` at import. */
let browserOpen: ReturnType<typeof createPluggyConnect> | null = null;
export function openPluggyConnect(options: PluggyOptions): Promise<void> {
  browserOpen ??= createPluggyConnect(document, window as PluggyWindow, pinnedScript(import.meta.env));
  return browserOpen(options);
}
