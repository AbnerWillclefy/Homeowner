import { describe, expect, it, vi } from "vitest";
import {
  INVITE_STORAGE_KEY,
  captureInvite,
  clearPendingInvite,
  inviteTokenFromHash,
  readPendingInvite,
  type InviteStorage,
} from "./pendingInvite";

const TOKEN = "AbC-123_xyzAbC-123_xyzAbC-123_xyzAbC-123_xyz";

function memoryStorage(initial?: string): InviteStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(INVITE_STORAGE_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const throwing: InviteStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("inviteTokenFromHash", () => {
  it("reads the token from #invite=<token>", () => {
    expect(inviteTokenFromHash(`#invite=${TOKEN}`)).toBe(TOKEN);
  });

  it("ignores other fragments, an empty token and characters that cannot be in a token", () => {
    expect(inviteTokenFromHash("")).toBeNull();
    expect(inviteTokenFromHash("#other=1")).toBeNull();
    expect(inviteTokenFromHash("#invite=")).toBeNull();
    expect(inviteTokenFromHash("#invite=../admin")).toBeNull();
    expect(inviteTokenFromHash("#invite=a b")).toBeNull();
  });
});

describe("captureInvite", () => {
  it("stores the token, strips the fragment from the address bar and returns the token", () => {
    const storage = memoryStorage();
    const replaceState = vi.fn();
    const token = captureInvite({
      hash: `#invite=${TOKEN}`,
      pathname: "/app",
      search: "?x=1",
      storage,
      replaceState,
    });
    expect(token).toBe(TOKEN);
    expect(storage.data.get(INVITE_STORAGE_KEY)).toBe(TOKEN);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/app?x=1");
  });

  it("falls back to the stored token when the address has none", () => {
    const replaceState = vi.fn();
    const token = captureInvite({ hash: "", pathname: "/", search: "", storage: memoryStorage(TOKEN), replaceState });
    expect(token).toBe(TOKEN);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("is null with no link and nothing stored, and ignores a stored value that is not a token", () => {
    const none = { hash: "", pathname: "/", search: "", replaceState: vi.fn() };
    expect(captureInvite({ ...none, storage: memoryStorage() })).toBeNull();
    expect(captureInvite({ ...none, storage: memoryStorage("a b") })).toBeNull();
  });

  it("leaves a malformed fragment alone", () => {
    const replaceState = vi.fn();
    const storage = memoryStorage();
    const token = captureInvite({ hash: "#invite=a b!", pathname: "/", search: "?x=1", storage, replaceState });
    expect(token).toBeNull();
    expect(storage.data.size).toBe(0);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("never throws when storage or history are blocked, and still uses the link for this session", () => {
    const token = captureInvite({
      hash: `#invite=${TOKEN}`,
      pathname: "/",
      search: "",
      storage: throwing,
      replaceState: () => {
        throw new Error("no history");
      },
    });
    expect(token).toBe(TOKEN);
  });
});

describe("readPendingInvite and clearPendingInvite", () => {
  it("clear removes the stored token, and neither throws on blocked storage", () => {
    const storage = memoryStorage(TOKEN);
    expect(readPendingInvite(storage)).toBe(TOKEN);
    clearPendingInvite(storage);
    expect(readPendingInvite(storage)).toBeNull();
    expect(readPendingInvite(throwing)).toBeNull();
    expect(() => clearPendingInvite(throwing)).not.toThrow();
  });
});
