import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS, type OnboardingPosition } from "../api/onboarding";
import { stepsFor } from "../onboarding/steps";
import { resolveRoute, type OnboardingInput, type RouteDecision, type RouteInput } from "./resolveRoute";
import { AUTH_PATHS, SHELL_PATHS, stepPath } from "./routes";

const ANDROID = stepsFor({ kind: "available" });
const IOS_TAB = stepsFor({ kind: "needs-install" });

const ready = (position: OnboardingPosition): OnboardingInput => ({ kind: "ready", position });

function input(over: Partial<RouteInput> & { pathname: string }): RouteInput {
  return {
    auth: "signed-in",
    onboarding: ready("done"),
    wanted: null,
    hasPendingInvite: false,
    steps: ANDROID,
    ...over,
  };
}

const wait: RouteDecision = { kind: "wait" };
const retry: RouteDecision = { kind: "retry" };
const render: RouteDecision = { kind: "render" };
const to = (path: string): RouteDecision => ({ kind: "redirect", to: path });

interface Row {
  name: string;
  input: RouteInput;
  expected: RouteDecision;
}

const rows: Row[] = [
  // Signed out
  ...["/", "/chores", "/home", "/me", "/welcome/baseline", "/nope"].map((pathname) => ({
    name: `signed out on ${pathname} goes to sign-in`,
    input: input({ auth: "signed-out", pathname }),
    expected: to("/signin"),
  })),
  ...AUTH_PATHS.map((pathname) => ({
    name: `signed out on ${pathname} renders`,
    input: input({ auth: "signed-out", pathname }),
    expected: render,
  })),
  { name: "signed out with an Invite on / goes to sign-up", input: input({ auth: "signed-out", pathname: "/", hasPendingInvite: true }), expected: to("/signup") },
  { name: "signed out with an Invite on /signin renders", input: input({ auth: "signed-out", pathname: "/signin", hasPendingInvite: true }), expected: render },

  // Auth loading
  ...["/", "/chores", "/signin", "/welcome/home", "/nope"].map((pathname) => ({
    name: `auth loading on ${pathname} waits`,
    input: input({ auth: "loading", pathname }),
    expected: wait,
  })),

  // Onboarding unfinished (Android: no install step)
  { name: "unfinished at baseline on / goes to the step", input: input({ pathname: "/", onboarding: ready("baseline") }), expected: to("/welcome/baseline") },
  { name: "unfinished on /chores goes to the step", input: input({ pathname: "/chores", onboarding: ready("baseline") }), expected: to("/welcome/baseline") },
  { name: "unfinished on the saved step renders", input: input({ pathname: "/welcome/baseline", onboarding: ready("baseline") }), expected: render },
  { name: "unfinished on an earlier step renders (going back)", input: input({ pathname: "/welcome/reminders", onboarding: ready("preferences") }), expected: render },
  { name: "unfinished on a later step goes to the saved step", input: input({ pathname: "/welcome/home", onboarding: ready("restrictions") }), expected: to("/welcome/restrictions") },
  { name: "unfinished on an unknown step goes to the saved step", input: input({ pathname: "/welcome/nope", onboarding: ready("baseline") }), expected: to("/welcome/baseline") },
  { name: "unfinished on /welcome goes to the saved step", input: input({ pathname: "/welcome", onboarding: ready("baseline") }), expected: to("/welcome/baseline") },
  { name: "unfinished on /welcome/ goes to the saved step", input: input({ pathname: "/welcome/", onboarding: ready("baseline") }), expected: to("/welcome/baseline") },
  { name: "unfinished on install without install goes to reminders", input: input({ pathname: "/welcome/install", onboarding: ready("install") }), expected: to("/welcome/reminders") },
  { name: "install stored, no install step: effective step", input: input({ pathname: "/", onboarding: ready("install") }), expected: to("/welcome/reminders") },
  { name: "iOS tab at install renders install", input: input({ pathname: "/welcome/install", onboarding: ready("install"), steps: IOS_TAB }), expected: render },
  { name: "iOS tab at install, on /", input: input({ pathname: "/", onboarding: ready("install"), steps: IOS_TAB }), expected: to("/welcome/install") },
  { name: "iOS tab at home may revisit install", input: input({ pathname: "/welcome/install", onboarding: ready("home"), steps: IOS_TAB }), expected: render },
  { name: "unfinished on /signin goes straight to the step", input: input({ pathname: "/signin", onboarding: ready("preferences"), wanted: "/chores" }), expected: to("/welcome/preferences") },
  { name: "all remaining steps skipped counts as done", input: input({ pathname: "/welcome/install", onboarding: ready("install"), steps: [] }), expected: to("/") },

  // Onboarding unknown: never a guess
  ...["/", "/chores", "/welcome/home", "/signin"].map((pathname) => ({
    name: `onboarding loading on ${pathname} waits`,
    input: input({ pathname, onboarding: { kind: "loading" } }),
    expected: wait,
  })),
  ...["/", "/chores", "/welcome/home", "/signin"].map((pathname) => ({
    name: `onboarding problem on ${pathname} asks to try again`,
    input: input({ pathname, onboarding: { kind: "problem" } }),
    expected: retry,
  })),

  // Done
  ...SHELL_PATHS.map((pathname) => ({
    name: `done on ${pathname} renders`,
    input: input({ pathname }),
    expected: render,
  })),
  ...[...AUTH_PATHS, "/welcome/home", "/welcome", "/nope", "/welcome/baseline"].map((pathname) => ({
    name: `done on ${pathname} goes to Today`,
    input: input({ pathname }),
    expected: to("/"),
  })),
  { name: "done on /chores/ renders", input: input({ pathname: "/chores/" }), expected: render },
  { name: "done on /signin with a wanted tab goes there", input: input({ pathname: "/signin", wanted: "/chores" }), expected: to("/chores") },
  ...["//evil.test", "/signin", "/welcome/home", "https://x", "/nope"].map((wanted) => ({
    name: `done on /signin ignores wanted ${wanted}`,
    input: input({ pathname: "/signin", wanted }),
    expected: to("/"),
  })),

  // Pending Invite (signed in): everything but / goes to /, before onboarding is read
  ...["/chores", "/home", "/me", "/welcome/home", "/signin", "/nope"].flatMap((pathname) =>
    (["done", "baseline"] as const).map((position) => ({
      name: `pending Invite, ${position}, on ${pathname} goes to Today`,
      input: input({ pathname, hasPendingInvite: true, onboarding: ready(position) }),
      expected: to("/"),
    })),
  ),
  ...(["done", "baseline"] as const).map((position) => ({
    name: `pending Invite, ${position}, on / renders`,
    input: input({ pathname: "/", hasPendingInvite: true, onboarding: ready(position) }),
    expected: render,
  })),
  { name: "pending Invite renders / even when onboarding failed to load", input: input({ pathname: "/", hasPendingInvite: true, onboarding: { kind: "problem" } }), expected: render },
  { name: "pending Invite renders / while onboarding loads", input: input({ pathname: "/", hasPendingInvite: true, onboarding: { kind: "loading" } }), expected: render },
  { name: "pending Invite on /signin ignores wanted", input: input({ pathname: "/signin", hasPendingInvite: true, wanted: "/chores" }), expected: to("/") },
];

describe("resolveRoute table", () => {
  it.each(rows)("$name", ({ input: row, expected }) => {
    expect(resolveRoute(row)).toEqual(expected);
  });

  it("never loops: a redirect target never redirects again", () => {
    for (const row of rows) {
      const decision = resolveRoute(row.input);
      if (decision.kind !== "redirect") continue;
      const again = resolveRoute({ ...row.input, pathname: decision.to, wanted: null });
      expect(again.kind, `${row.name}: ${decision.to} redirected to ${JSON.stringify(again)}`).not.toBe("redirect");
    }
  });

  it("never loops over every path, state and device", () => {
    const paths = [
      "/", "/chores", "/home", "/me", "/signin", "/signup", "/confirm", "/welcome", "/welcome/", "/nope", "/chores/",
      ...ONBOARDING_STEPS.map(stepPath),
    ];
    const onboardings: OnboardingInput[] = [
      { kind: "loading" },
      { kind: "problem" },
      ready("done"),
      ...ONBOARDING_STEPS.map(ready),
    ];
    const wanteds = [null, "/chores", "/signin", "//evil.test", "/welcome/home"];
    let checked = 0;
    for (const auth of ["loading", "signed-out", "signed-in"] as const) {
      for (const pathname of paths) {
        for (const onboarding of onboardings) {
          for (const hasPendingInvite of [false, true]) {
            for (const steps of [ANDROID, IOS_TAB]) {
              for (const wanted of wanteds) {
                const row = { auth, pathname, onboarding, hasPendingInvite, steps, wanted };
                const decision = resolveRoute(row);
                if (decision.kind !== "redirect") continue;
                const again = resolveRoute({ ...row, pathname: decision.to, wanted: null });
                checked += 1;
                expect(again.kind, JSON.stringify(row)).not.toBe("redirect");
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("does not bounce between two redirects when the target is the wanted place", () => {
    const row = input({ pathname: "/signin", wanted: "/chores" });
    const first = resolveRoute(row);
    expect(first).toEqual(to("/chores"));
    expect(resolveRoute({ ...row, pathname: "/chores", wanted: null })).toEqual(render);
  });
});
