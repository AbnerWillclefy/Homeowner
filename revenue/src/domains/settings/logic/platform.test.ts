import { describe, expect, it } from "vitest";
import { isIOS, isStandalone, reminderAvailability, type PlatformEnv } from "./platform";

function env(overrides: Partial<PlatformEnv> = {}): PlatformEnv {
  return {
    platform: "Linux armv8l",
    maxTouchPoints: 5,
    standaloneFlag: undefined,
    displayModeStandalone: false,
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    ...overrides,
  };
}

describe("isIOS", () => {
  it("is true for iPhone and iPod", () => {
    expect(isIOS(env({ platform: "iPhone" }))).toBe(true);
    expect(isIOS(env({ platform: "iPod" }))).toBe(true);
  });

  it("is true for iPadOS, which reports as MacIntel with a touch screen", () => {
    expect(isIOS(env({ platform: "MacIntel", maxTouchPoints: 5 }))).toBe(true);
  });

  it("is false for a real Mac and for Android", () => {
    expect(isIOS(env({ platform: "MacIntel", maxTouchPoints: 0 }))).toBe(false);
    expect(isIOS(env({ platform: "Linux armv8l" }))).toBe(false);
  });
});

describe("isStandalone", () => {
  it("is true when the display mode is standalone", () => {
    expect(isStandalone(env({ displayModeStandalone: true }))).toBe(true);
  });

  it("is true when iOS Safari sets navigator.standalone", () => {
    expect(isStandalone(env({ standaloneFlag: true }))).toBe(true);
  });

  it("is false in a normal browser tab", () => {
    expect(isStandalone(env({ standaloneFlag: false }))).toBe(false);
    expect(isStandalone(env())).toBe(false);
  });
});

describe("reminderAvailability", () => {
  it("is available on Android in a browser tab", () => {
    expect(reminderAvailability(env())).toEqual({ kind: "available" });
  });

  it("asks an iPhone in Safari to install first and shows the steps", () => {
    expect(reminderAvailability(env({ platform: "iPhone", hasPushManager: false }))).toEqual({
      kind: "needs-install",
    });
  });

  it("is available on an iPhone launched from the Home Screen", () => {
    expect(reminderAvailability(env({ platform: "iPhone", standaloneFlag: true }))).toEqual({
      kind: "available",
    });
  });

  it("is unsupported when the browser lacks push", () => {
    expect(reminderAvailability(env({ hasPushManager: false }))).toEqual({ kind: "unsupported" });
    expect(reminderAvailability(env({ hasServiceWorker: false }))).toEqual({ kind: "unsupported" });
    expect(reminderAvailability(env({ hasNotification: false }))).toEqual({ kind: "unsupported" });
  });

  it("reports an old iPhone Home Screen app without push as unsupported", () => {
    expect(
      reminderAvailability(env({ platform: "iPhone", standaloneFlag: true, hasPushManager: false })),
    ).toEqual({ kind: "unsupported" });
  });
});
