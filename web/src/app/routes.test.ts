import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS } from "../onboarding/api";
import {
  authState,
  confirmNeedsEmail,
  isWelcomePath,
  normalizePath,
  safeWantedPath,
  stepFromPath,
  stepPath,
} from "./routes";

describe("stepPath and stepFromPath", () => {
  it.each(ONBOARDING_STEPS)("round-trips %s", (step) => {
    expect(stepPath(step)).toBe(`/welcome/${step}`);
    expect(stepFromPath(stepPath(step))).toBe(step);
  });

  it.each(["/welcome", "/welcome/", "/welcome/nope", "/chores", "/", "/welcome/baseline/x"])(
    "gives null for %s",
    (path) => {
      expect(stepFromPath(path)).toBeNull();
    },
  );

  it("ignores a trailing slash, search and hash", () => {
    expect(stepFromPath("/welcome/baseline/?a=1#b")).toBe("baseline");
  });
});

describe("normalizePath", () => {
  it.each([
    ["/", "/"],
    ["", "/"],
    ["/chores/", "/chores"],
    ["/chores?x=1", "/chores"],
    ["/me#top", "/me"],
    ["/home/?a#b", "/home"],
  ])("%s becomes %s", (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
});

describe("isWelcomePath", () => {
  it("matches /welcome and below, nothing that merely starts the same", () => {
    expect(isWelcomePath("/welcome")).toBe(true);
    expect(isWelcomePath("/welcome/home")).toBe(true);
    expect(isWelcomePath("/welcomex")).toBe(false);
  });
});

describe("safeWantedPath", () => {
  it.each(["/", "/chores", "/home", "/me"])("keeps %s", (path) => {
    expect(safeWantedPath(path)).toBe(path);
  });

  it("normalises", () => {
    expect(safeWantedPath("/chores/?x=1")).toBe("/chores");
  });

  it.each([
    ["a protocol-relative URL", "//evil.test"],
    ["an absolute URL", "https://x"],
    ["a backslash trick", "/\\evil.test"],
    ["an auth path", "/signin"],
    ["the confirm path", "/confirm/"],
    ["an onboarding path", "/welcome/home"],
    ["the welcome root", "/welcome"],
    ["a relative path", "chores"],
    ["a number", 3],
    ["undefined", undefined],
    ["null", null],
  ])("rejects %s", (_name, value) => {
    expect(safeWantedPath(value)).toBeNull();
  });
});

describe("authState", () => {
  it("forwards from to the next hop", () => {
    expect(authState({ from: "/chores" }, { email: "a@b.c" })).toEqual({ from: "/chores", email: "a@b.c" });
  });

  it("starts empty with no previous state", () => {
    expect(authState(null)).toEqual({});
    expect(authState(undefined, { email: "a@b.c" })).toEqual({ email: "a@b.c" });
  });

  it("drops an unsafe from, and does not let the patch override it", () => {
    expect(authState({ from: "//evil.test" }, { email: "a@b.c" })).toEqual({ email: "a@b.c" });
    expect(authState({ from: "/me" }, { from: "/home" } as never)).toEqual({ from: "/me" });
  });
});

describe("confirmNeedsEmail", () => {
  it("is true without an email in state", () => {
    expect(confirmNeedsEmail(null)).toBe(true);
    expect(confirmNeedsEmail({})).toBe(true);
    expect(confirmNeedsEmail({ email: "" })).toBe(true);
  });

  it("is false with an email", () => {
    expect(confirmNeedsEmail({ email: "a@b.c" })).toBe(false);
  });
});
