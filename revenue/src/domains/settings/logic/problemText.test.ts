import { describe, expect, it } from "vitest";
import { problemText } from "./problemText";

describe("problemText", () => {
  it.each([
    [{ kind: "denied" }, "notify.problem.denied"],
    [{ kind: "dismissed" }, "notify.problem.dismissed"],
    [{ kind: "not-configured" }, "notify.problem.notConfigured"],
    [{ kind: "not-signed-in" }, "notify.problem.notSignedIn"],
    [{ kind: "error" }, "notify.problem.error"],
    [{ kind: "browser-error", name: "AbortError" }, "notify.problem.browserRegister"],
    [{ kind: "browser-error", name: "NotAllowedError" }, "notify.problem.browserNotAllowed"],
  ] as const)("words %j", (problem, key) => expect(problemText(problem).key).toBe(key));
  it("names an unknown browser error", () => {
    expect(problemText({ kind: "browser-error", name: "Odd" })).toEqual({ key: "notify.problem.browserRefused", params: { name: "Odd" } });
  });
});
