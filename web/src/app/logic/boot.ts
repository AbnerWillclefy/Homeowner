import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";

/** One answer inside `GET /boot`: the status and the JSON body its own endpoint would have given. */
export interface BootSection {
  status: number;
  body: unknown;
}

/** Keyed by the path the PWA requests, query included (`/me/finance/bills?month=2030-01`). */
export type BootSections = Record<string, BootSection>;

/** shortcut: one fixed window, upgrade if slow phones miss it. */
export const BOOT_WINDOW_MS = 10_000;

/** `path?a=1&b=2` with the query sorted, so the order of the params never decides a match. */
function keyOf(url: string, params?: unknown): string {
  const [path = "", query = ""] = url.split("?");
  const search = new URLSearchParams(query);
  if (typeof params === "object" && params !== null) {
    for (const [name, value] of Object.entries(params)) search.append(name, String(value));
  }
  search.sort();
  const sorted = search.toString();
  return sorted === "" ? path : `${path}?${sorted}`;
}

/**
 * The launch reads, served from one `GET /boot` (ADR 0016). `take` hands a read its section as a ready response, once;
 * anything else (a failed section, a later refetch, a mutation) returns null and goes to the network.
 */
export function createBoot(now: () => number = Date.now) {
  let pending: Promise<BootSections | null> | null = null;
  let sections: BootSections = {};
  let answeredAt = 0;
  // Bumped by `clear`, so a boot that answers after the session ended is dropped.
  let generation = 0;

  return {
    /** Runs the request. A thrown error counts as a failed boot. Resolves to the sections `take` can still serve, or null. */
    start(load: () => Promise<BootSections | null>): Promise<BootSections | null> {
      const mine = ++generation;
      pending = load()
        .catch(() => null)
        .then((answer) => {
          if (mine !== generation) return null;
          sections = {};
          for (const [key, section] of Object.entries(answer ?? {})) {
            if (section.status < 500) sections[keyOf(key)] = section;
          }
          answeredAt = now();
          return answer === null ? null : { ...sections };
        });
      return pending;
    },

    async take(request: AxiosRequestConfig): Promise<AxiosResponse | null> {
      if ((request.method ?? "GET").toUpperCase() !== "GET" || request.url === undefined) return null;
      await pending;
      if (now() - answeredAt > BOOT_WINDOW_MS) return null;
      const key = keyOf(request.url, request.params);
      const section = sections[key];
      if (section === undefined) return null;
      delete sections[key];
      return {
        status: section.status,
        statusText: "",
        data: section.body,
        headers: {},
        config: request as InternalAxiosRequestConfig,
      };
    },

    /** Forgets everything: the session ended, so nothing a Resident read may reach the next one. */
    clear(): void {
      generation++;
      pending = null;
      sections = {};
    },
  };
}

export const boot = createBoot();
