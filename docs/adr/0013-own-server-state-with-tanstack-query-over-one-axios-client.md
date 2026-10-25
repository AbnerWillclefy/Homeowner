# Own server state with TanStack Query over one Axios client

Every screen today fetches in its own hook and keeps its own copy of what the server said. The same data (the Day Plan, the Residents, `GET /me`) is read, held and reloaded in several places, and each hook re-invents loading, failure and reload. Epic #271 moves server state to TanStack Query on top of one HTTP client that carries the sign-in rules, so a screen stops caring how a token is refreshed.

This **amends [ADR 0010](0010-organise-the-pwa-by-domain-module.md)**, which says `authedFetch` lives in `auth/request.ts`: the client now lives in `domains/auth/api/client.ts`, and `request.ts` stays only until the last caller has moved.

## Decision

- **TanStack Query owns server state.** A screen reads it with a query and does not copy it into component state.
- **Actions write their answers to the cache.** Most of the API's writes answer with the new state (a Day Plan action answers with the plan, `PUT /me/name` with `Me`), so the action puts that answer in the cache with `setQueryData` instead of refetching.
- **Queries are stale at once and retries are off.** Opening a screen reads the server again, as the app does today, and a failure shows the Resident's Retry rather than waiting through hidden retries. A single query may override these defaults when this ADR names it. The one exception is `GET /me`: sign-in resolves it into the cache, and the Shell's `useMe` mounts straight after. With `refetchOnMount: true` the entry (stale at once) would be read a second time, so `meQuery` sets `refetchOnMount: refetchUnlessSucceeded`, that is `(query) => query.state.status !== "success"`. A cached success is not read again on mount, a failed or empty entry still is, and window focus still refreshes it. The exception now also covers the queries the app starts at launch on Today (the onboarding position, the Home, the Day Plan, the Check-in, the Streak, the Residents and the Demands), which use the same rule: see [ADR 0016](0016-start-todays-reads-at-launch-not-in-route-loaders.md). A short `staleTime` was rejected: it would make `me` stale-at-N-seconds, unlike every other query.
- **Queries and mutations run offline (`networkMode: "always"`).** With the default `"online"`, TanStack Query does not run a `queryFn` while `navigator.onLine` is false: the query sits in `fetchStatus: "paused"` and stays pending, so the skeleton would show forever. With `"always"` the request runs, fails, and the API client reports `offline`, so the Resident sees the offline alert as today. The default `gcTime` (5 minutes) stays.
- **The cache is cleared on sign-out and is not persisted.** Nothing a Resident saw stays in memory or storage for the next person, and the app never shows a stale copy from an earlier launch.
- **One Axios instance** (`createApiClient`) adds the bearer token, refreshes it first when it is near expiry, and on a 401 refreshes once and retries once. It accepts every status without throwing (`validateStatus` always true), so domain code reads `status` as it does with `fetch`. Its refresh rules live in a pure token keeper (`auth/logic/tokenKeeper.ts`) that the old fetch helper shares while both exist, so two requests never send two Cognito refreshes with the same refresh token.
- **Absolute URLs are refused.** The client throws on any URL with a scheme or starting with `//` before the token is attached, so the token goes only to the API's base URL. (`allowAbsoluteUrls: false` alone is not enough: Axios then joins the two URLs into one string.)
- **Cognito and presigned storage stay on `fetch`.** Cognito calls carry no bearer token, and a presigned S3 URL is signed over its headers, so an `Authorization` header would break it and leak the token to a third party ([ADR 0012](0012-serve-resident-photos-from-a-private-bucket-through-the-web-cloudfront.md)).
- **Loading and fetching are separate states.** Loading means there is nothing to show yet; fetching means a read is in flight, possibly over data already on screen. A screen shows a skeleton for the first and, at most, a quiet indicator for the second.
- **The adapter calls the global `fetch(url, init)`** (`shared/api/fetchAdapter.ts`). Axios's own adapters either bypass a stubbed global `fetch` in Node or call it with a `Request`, which would break the existing `fetch`-stubbing tests and change what Playwright sees. It names no domain, so it sits in `shared/`, which `auth` may import.

## Alternatives rejected

- **Keep per-hook fetching.** It is what causes the duplicated loading and reload code.
- **Persist the cache.** It would show a previous person's data after a sign-out on a shared phone, and an old Day Plan as if it were today's.
- **Retries and a stale time.** They hide failures and show an old Day Plan, which is wrong when the Resident has just acted from another device.
- **The built-in Axios `fetch` adapter.** It calls `fetch(new Request(...))`, so every existing test's expectation on the first argument breaks.

## Consequences

- **A 200 whose body is not JSON is no longer `offline`.** With `fetch`, `response.json()` throws and the caller's catch reports `offline`. Through Axios the body stays a string and the caller sees an `error`. That is more honest, but it is a change.
- **Two transports exist during the migration** (#273, #274), sharing one token keeper. _Update (epic #271): the migration is done; `request.ts` and its fetch helper are gone and every authenticated call uses `authedRequest`. The as-built keys, defaults and cache writes are in [the web architecture](../architecture/web.md#data-layer)._
- **No custom request headers.** The API's CORS allows only `Authorization` and `Content-Type`; Axios's default `Accept` is safelisted.
