import { describe, expect, it } from "vitest";
import { enUS } from "./en-US";

// Characterisation: the en-US wording of the home/status screen is unchanged
// from before it was moved into the catalog.
describe("en-US home screen wording", () => {
  it("keeps today's literals", () => {
    expect(enUS["app.name"]).toBe("Homeowner");
    expect(enUS["home.tagline"]).toBe("Manage the housework in your Home.");
    expect(enUS["health.unavailable"]).toBe(
      "Service status: unavailable. The service is up but cannot reach its database.",
    );
    expect(enUS["health.unreachable"]).toBe(
      "Service status: unreachable. Check your connection and try again.",
    );
    expect(enUS["health.retry"]).toBe("Try again");
    expect(enUS["auth.checking"]).toBe("Checking your sign-in...");
  });
});
