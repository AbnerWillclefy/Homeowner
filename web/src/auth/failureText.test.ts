import { describe, expect, it } from "vitest";
import type { CognitoFailure } from "./cognito";
import { config } from "../config";
import { failureText } from "./failureText";
import { describeRules } from "./passwordPolicy";

const kinds: CognitoFailure["kind"][] = [
  "already-registered",
  "invalid-password",
  "invalid-input",
  "wrong-code",
  "expired-code",
  "not-confirmed",
  "not-authorized",
  "rate-limited",
  "network",
  "error",
];

describe("failureText", () => {
  it.each(kinds)("has words for %s", (kind) => {
    expect(failureText({ kind }).length).toBeGreaterThan(10);
  });

  it("does not say which of email or password was wrong", () => {
    const text = failureText({ kind: "not-authorized" });
    expect(text).toMatch(/email or password/i);
  });

  it("states the policy's password rules when a password is refused", () => {
    const text = failureText({ kind: "invalid-password" });
    expect(text).toBe(`That password is not strong enough. ${describeRules(config.passwordPolicy)}`);
    expect(text).toMatch(/10 characters.*upper.*lower.*number/i);
    expect(text).not.toMatch(/symbol/i);
  });

  it("blames the connection only for a network failure", () => {
    expect(failureText({ kind: "network" })).toMatch(/connection/i);
    expect(failureText({ kind: "error" })).not.toMatch(/connection/i);
  });

  it("avoids the words the glossary rejects for a User", () => {
    for (const kind of kinds) expect(failureText({ kind })).not.toMatch(/account|profile/i);
  });
});
