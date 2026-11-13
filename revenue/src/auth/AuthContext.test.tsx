import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth, type Auth } from "./AuthContext";
import { signIn as cognitoSignIn } from "./cognito";
import { createSessionStore, type StorageLike } from "./session";

vi.mock("./cognito", () => ({ signIn: vi.fn() }));
const cognito = vi.mocked(cognitoSignIn);

function setup() {
  const data = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
  const session = createSessionStore(storage);
  const queryClient = new QueryClient();
  const seen: { auth?: Auth } = {};
  function Probe() {
    seen.auth = useAuth();
    return null;
  }
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider session={session}>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { session, queryClient, seen };
}

describe("AuthProvider", () => {
  it("fails and saves nothing when sign-in returns no refresh token", async () => {
    cognito.mockResolvedValue({ kind: "ok", tokens: { idToken: "id", expiresInSeconds: 3600 } });
    const { session, seen } = setup();
    expect(await seen.auth!.signIn("a@b.c", "pw")).toEqual({ kind: "error" });
    expect(session.load()).toBeNull();
  });

  it("saves the session with its expiry and flips signedIn", async () => {
    cognito.mockResolvedValue({ kind: "ok", tokens: { idToken: "id", refreshToken: "r", expiresInSeconds: 60 } });
    const { session, seen } = setup();
    const before = Date.now();
    await act(async () => {
      expect(await seen.auth!.signIn("a@b.c", "pw")).toBeNull();
    });
    expect(session.load()).toMatchObject({ idToken: "id", refreshToken: "r" });
    expect(session.load()!.expiresAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(seen.auth!.signedIn).toBe(true);
  });

  it("clears the query cache when the session ends", async () => {
    cognito.mockResolvedValue({ kind: "ok", tokens: { idToken: "id", refreshToken: "r", expiresInSeconds: 60 } });
    const { session, queryClient, seen } = setup();
    await act(async () => void (await seen.auth!.signIn("a@b.c", "pw")));
    queryClient.setQueryData(["me"], { kind: "ok" });
    act(() => session.clear());
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
