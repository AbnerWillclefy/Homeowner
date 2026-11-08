import { describe, expect, it } from "vitest";
import type { Me } from "../../domains/auth/api/meApi";
import { financeAccess } from "./financeAccess";

const me = (finance: boolean): Me => ({ id: "u", email: "a@b.c", displayName: null, name: "a", photoUrl: null, initials: "A", avatarTone: "kitchen", finance });

describe("financeAccess", () => {
  it("waits while Me loads", () => expect(financeAccess({ kind: "loading" })).toBe("wait"));
  it("renders for the flag", () => expect(financeAccess({ kind: "ready", me: me(true) })).toBe("render"));
  it("redirects without the flag", () => expect(financeAccess({ kind: "ready", me: me(false) })).toBe("redirect"));
  it("fails closed", () => expect(financeAccess({ kind: "failed" })).toBe("redirect"));
});
