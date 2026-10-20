import type { Page, Route } from "@playwright/test";

/** A request as a fake sees it. */
export interface FakeRequest {
  method: string;
  url: URL;
  path: string;
  /** The parsed JSON body, or null when there is none or it is not JSON. */
  body: unknown;
  /** The raw Authorization header, or null. */
  authorization: string | null;
  /** The X-Amz-Target header (which Cognito action), or null. */
  target: string | null;
  /** Every request header, lower-cased. */
  headers: Record<string, string>;
}

export interface FakeReply {
  status: number;
  /** Serialised as JSON when present. */
  body?: unknown;
  headers?: Record<string, string>;
}

/** Something that answers for one server. */
export interface Fake {
  name: string;
  /** True when this fake owns the URL. The first owner in registration order answers. */
  matches(url: URL): boolean;
  /** The reply, or null when the fake has no handler for this method and path (counted as unmocked, answered 501). */
  handle(request: FakeRequest): FakeReply | null | Promise<FakeReply | null>;
}

export interface UnmockedRequest {
  method: string;
  url: string;
}

export interface Router {
  add(fake: Fake): void;
  /** Returns and clears the requests nothing covered. The fixture fails the test if any remain at the end. */
  takeUnmocked(): UnmockedRequest[];
  install(page: Page, baseURL: string): Promise<void>;
}

const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
// The real API allows only the first two; X-Amz-Target is what the browser sends to Cognito.
const ALLOW_HEADERS = "Authorization, Content-Type, X-Amz-Target";

/** The page may be gone by the time a handler runs (for example useHealth aborts its fetch on unmount). */
async function quietly(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch {
    // Target closed or already handled: nothing left to answer.
  }
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": ALLOW_METHODS,
    "access-control-allow-headers": ALLOW_HEADERS,
    vary: "Origin",
  };
}

function parseBody(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createRouter(): Router {
  const fakes: Fake[] = [];
  let unmocked: UnmockedRequest[] = [];

  async function answer(route: Route, appOrigin: string): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());

    // The built app, its icons and manifest: served by the preview server.
    if (url.origin === appOrigin) {
      await quietly(() => route.continue());
      return;
    }

    const origin = request.headers()["origin"];
    const fake = fakes.find((candidate) => candidate.matches(url));
    if (!fake) {
      unmocked.push({ method: request.method(), url: request.url() });
      await quietly(() => route.abort());
      return;
    }

    if (request.method() === "OPTIONS") {
      await quietly(() => route.fulfill({ status: 204, headers: corsHeaders(origin) }));
      return;
    }

    const reply = await fake.handle({
      method: request.method(),
      url,
      path: url.pathname,
      body: parseBody(request.postData()),
      authorization: request.headers()["authorization"] ?? null,
      target: request.headers()["x-amz-target"] ?? null,
      headers: request.headers(),
    });
    if (reply === null) {
      unmocked.push({ method: request.method(), url: request.url() });
      await quietly(() =>
        route.fulfill({
          status: 501,
          headers: { ...corsHeaders(origin), "content-type": "application/json" },
          body: JSON.stringify({ error: "not mocked" }),
        }),
      );
      return;
    }

    await quietly(() =>
      route.fulfill({
        status: reply.status,
        headers: {
          ...corsHeaders(origin),
          ...(reply.body === undefined ? {} : { "content-type": "application/json" }),
          ...reply.headers,
        },
        body: reply.body === undefined ? undefined : JSON.stringify(reply.body),
      }),
    );
  }

  return {
    add(fake) {
      fakes.push(fake);
    },
    takeUnmocked() {
      const taken = unmocked;
      unmocked = [];
      return taken;
    },
    async install(page, baseURL) {
      const appOrigin = new URL(baseURL).origin;
      await page.route("**/*", (route) => answer(route, appOrigin));
    },
  };
}
