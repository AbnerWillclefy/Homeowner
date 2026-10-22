// @vitest-environment jsdom
import { act, createElement } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../shared/query/testing";
import { browserSession } from "../../domains/auth/logic/browserSession";
import { AuthProvider, useAppAuth } from "./AuthProvider";

vi.mock("../../domains/auth/api/meApi", () => ({
  getMe: vi.fn(async () => ({ kind: "ok", email: "ana@example.com" })),
}));

let signOut: () => void;
let kind: string;
let seen: QueryClient;

function Probe() {
  const auth = useAppAuth();
  signOut = auth.signOut;
  kind = auth.state.kind;
  seen = useQueryClient();
  return null;
}

let rendered: Rendered;

const settle = () => act(async () => {});
const cached = () => seen.getQueryCache().getAll().length;

beforeEach(async () => {
  localStorage.clear();
  browserSession.save({ idToken: "a.b.c", refreshToken: "r", expiresAt: Date.now() + 3_600_000 });
  rendered = renderWithQueryClient(createElement(AuthProvider, null, createElement(Probe)), createTestQueryClient());
  await settle();
  rendered.client.setQueryData(["me"], { name: "Ana" });
  rendered.client.setQueryData(["home"], { id: "h1" });
});

afterEach(() => {
  rendered.unmount();
  localStorage.clear();
});

describe("AuthProvider cache clear", () => {
  it("starts signed in with the seeded cache", () => {
    expect(kind).toBe("signed-in");
    expect(cached()).toBe(2);
  });

  it("empties the cache when the Resident signs out", async () => {
    act(() => signOut());
    await settle();
    expect(kind).toBe("signed-out");
    expect(cached()).toBe(0);
  });

  it("empties the cache when the client clears the session after a surviving 401", async () => {
    act(() => browserSession.clear());
    await settle();
    expect(kind).toBe("signed-out");
    expect(cached()).toBe(0);
  });
});
