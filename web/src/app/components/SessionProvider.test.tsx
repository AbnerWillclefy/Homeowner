// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../shared/query/testing";

// The session's other state (onboarding, push, the Invite) is not under test here.
vi.mock("../../domains/onboarding/hooks/useOnboarding", () => ({ useOnboarding: () => ({}) }));
vi.mock("../../domains/push/hooks/usePush", () => ({
  usePush: () => ({ availability: { kind: "unsupported" }, markPageSettled: () => {} }),
}));
vi.mock("../../domains/invite/components/PendingInviteProvider", () => ({ useInvite: () => ({ token: null, clear: () => {} }) }));

const { SessionProvider, useSession } = await import("./SessionProvider");

let rendered: Rendered | undefined;
let session!: ReturnType<typeof useSession>;
const Probe = () => {
  session = useSession();
  return null;
};
const mount = () => {
  rendered = renderWithQueryClient(createElement(SessionProvider, null, createElement(Probe)), createTestQueryClient());
};

afterEach(() => {
  rendered?.unmount();
  rendered = undefined;
  localStorage.clear();
  sessionStorage.clear();
});

describe("SessionProvider Check-in dismissal", () => {
  it("starts with no dismissal", () => {
    mount();
    expect(session.checkInDismissedFor).toBeNull();
  });

  it("remembers the date the Check-in was dismissed for", () => {
    mount();
    act(() => session.dismissCheckIn("2030-01-15"));
    expect(session.checkInDismissedFor).toBe("2030-01-15");
  });

  it("starts at null again after a remount, the cold start", () => {
    mount();
    act(() => session.dismissCheckIn("2030-01-15"));
    rendered!.unmount();
    mount();
    expect(session.checkInDismissedFor).toBeNull();
  });

  it("writes nothing to browser storage", () => {
    mount();
    act(() => session.dismissCheckIn("2030-01-15"));
    expect(JSON.stringify({ ...localStorage })).not.toContain("2030-01-15");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("2030-01-15");
  });
});
