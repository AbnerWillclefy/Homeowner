import { test as base, expect } from "@playwright/test";
import { apiBaseUrl } from "./env";
import { createFakeApi, initialState, type FakeApi, type FakeState } from "./mocks/api";
import { createRouter, type Router } from "./mocks/router";

interface Fixtures {
  /** Routes every non-app request to the registered fakes; fails the test on any request nothing covered. */
  router: Router;
  /** The stateful fake API, started for every test (every screen calls /healthz). Destructure it to read the state or request log. */
  fakeApi: FakeApi;
}

interface Options {
  /** Overrides for this test's starting FakeState: `test.use({ fakeState: { onboardingStored: "done" } })`. */
  fakeState: Partial<FakeState>;
}

export const test = base.extend<Fixtures & Options>({
  fakeState: [{}, { option: true }],

  router: [
    async ({ page, baseURL }, use) => {
      const router = createRouter();
      await router.install(page, baseURL!);
      await use(router);
      const unmocked = router.takeUnmocked();
      if (unmocked.length > 0) {
        const lines = unmocked.map((request) => `  ${request.method} ${request.url}`).join("\n");
        throw new Error(`${unmocked.length} request(s) had no fake:\n${lines}`);
      }
    },
    { auto: true },
  ],

  fakeApi: [
    async ({ router, fakeState }, use) => {
      // A new state per test, never shared, so any order and any number of runs behave the same.
      const state: FakeState = { ...initialState(), ...structuredClone(fakeState) };
      const api = createFakeApi({ baseUrl: apiBaseUrl, state });
      router.add(api);
      await use(api);
    },
    { auto: true },
  ],
});

export { expect };
