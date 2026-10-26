# Start Today's reads at launch, not in route loaders

Opening the app on Today used to read the server as a chain. `GET /me` answered, then the Guard mounted the session, whose `useOnboarding` read `GET /me/onboarding`; only when onboarding was `done` did the Shell read `GET /home`; only when the Home was ready did Today read the Day Plan, Check-in, Streak, Residents and Demands. Each call waited for the one before it, although none of them needs another's answer to be asked. [ADR 0013](0013-own-server-state-with-tanstack-query-over-one-axios-client.md) put every read in one TanStack Query cache; this ADR decides when the first reads start.

## Decision

`main.tsx` starts Today's reads once, at module level, right after `createQueryClient()` and before `createRoot(...)`:

```ts
for (const read of launchReads(window.location.pathname, browserSession.load() !== null)) {
  void queryClient.prefetchQuery(read);
}
```

- **One pure rule picks the reads.** `launchReads(pathname, hasStoredSession)` in `app/logic/launchReads.ts` returns the eight queries when `normalizePath(pathname)` is Today and a session is stored, and `[]` on any other path or without a session. It touches no React and no storage; the caller passes both inputs. The eight are `meQuery`, `onboardingQuery`, `homeQuery`, `dayPlanQuery`, `checkInQuery`, `streakQuery`, `residentsQuery` and `demandsQuery`.
- **The reads start together.** They are requested before the first render and do not wait for each other. They share one token refresh: every request goes through `usableSession()`, whose `refreshOnce` joins parallel callers, so an expiring token is refreshed once for all eight.
- **A failed read is stored, not thrown.** `prefetchQuery` never rejects. The failure sits on the query, and the screen that needs it shows it with its own Retry, as before.
- **The Guard is unchanged.** `resolveRoute` gets the same inputs as before; only their arrival time changes, because the answers may already be in the cache. `useAuth` resolves the User with `ensureQueryData(meQuery)`, which joins the launch read while it is in flight and keeps a result that already arrived (`fetchQuery` would read `GET /me` again at the default `staleTime` of 0).
- **The launch reads follow the rule `me` already had.** `refetchUnlessSucceeded` (`shared/query/queryClient.ts`) sets `refetchOnMount` to "only when the entry has not succeeded". `meQuery` uses it, and so does each launch query, so Today does not ask a second time for what the launch wave fetched. Window focus still refreshes every one of them. This extends the exception ADR 0013 named for `GET /me`.
- **A Home-scoped read that answered "none" is forgotten when a Home appears.** Every Home-scoped read answers 404 "no home" without a Home, and `toQueryData` turns it into `null`, which is a success in the cache. Because a success is no longer read again on mount, that `null` would outlive a new Home and Today would show the "no Home" state. So creating a Home (`homeCreated` in `domains/home/api/queries.ts`, called from the Create Home form in Today's gate and from the last onboarding step) cancels the read of the Home, runs `forgetHomeScope`, and only then writes the new Home. Joining already removes the Home-scoped children.
- **The Residents list is read once even though it is gated on the Home.** `useResidents` keeps its observer disabled until the Home is ready, and turning an observer on reads a stale entry whatever `refetchOnMount` says. The first time it is turned on, a list already in the cache counts as fresh (`staleTime: Infinity`, a function of a ref that is set once the hook has been on).

## Considered Options

- **Route loaders (`createBrowserRouter`).** The usual way to start reads before a screen mounts. Rejected: the app uses the declarative router (`BrowserRouter`), a data router would be a rewrite of the Guard and the layouts, and the loaders would have to hand their results to the cache anyway, leaving two owners of server state. A module-level prefetch keeps one: the cache.
- **Prefetch inside `App` or the Guard, in an effect.** Rejected: it starts after the first render, and StrictMode runs the effect twice. Module level runs once, outside React, like `createQueryClient()`.
- **Start the reads on every path.** Rejected: Chores, Home and Me do not need the Day Plan, and a launch on `/signin` has no session. The pure rule keeps the extra calls to the one path that uses them.
- **Skip the mount refetch only for data no screen has seen yet** (a module-level set of prefetched keys, consumed on first mount). It keeps "opening a screen reads the server again" for later visits. Not chosen: it adds hidden module state for a gain of one request per tab switch, and `refetchUnlessSucceeded` is a rule that already exists and is easy to explain. See the freshness cost below.
- **A short `staleTime` on the launch queries.** Rejected in ADR 0013 for `me` and for the same reason here: it would make some queries stale-at-N-seconds, unlike the rest.

## Consequences

- **A person still in onboarding pays for reads that answer "none".** Launching on `/` without finishing onboarding or without a Home makes about five cheap requests (Day Plan, Check-in, Streak, Residents, Demands) beside the three they need. The Home-scoped ones answer 404 "no home", the Residents list stores a failure, and the person sees no error because no screen shows them. Demands is a global list the onboarding Restrictions step reads anyway. We accept this: it is one wave in parallel, and it makes the common case, a Resident with a Home opening Today, as fast as the slowest single call instead of the sum of the chain.
- **Returning to Today from another tab no longer reads the Day Plan, Check-in and Streak.** Before, opening a screen read the server again (ADR 0013). Now a cached success is kept on mount, so another Resident's Take shows only on window focus (resuming the PWA or returning to the browser tab), after an action of your own, or after a failed read. The Day Plan has no date in its key and relied on mount refetches to move on at midnight; it now moves on at the next focus. We accept this to meet "not requested a second time on mount". If it proves too stale, the narrower rule above restores it without changing `launchReads`.
- **A failed launch read is read once more on mount.** The entry is not a success, so the screen's observer asks again. The Resident sees the loading state and then the result or the Retry, as before.
- **Creating a Home must go through `homeCreated`.** A new place that sets a Home into the cache without it would show the previous "none" answers. The e2e spec `launch-reads.spec.ts` covers the onboarding path.
- **A new launch read is a change to `launchReads`, its test and the list of keys in `docs/architecture/web.md`.** A query added there must use `refetchUnlessSucceeded`.
- **Cold-start numbers are an operational check, not a test.** The before and after Lighthouse figures for staging are in the pull request that introduced this.
