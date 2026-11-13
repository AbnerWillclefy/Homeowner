import { describe, expect, it } from "vitest";
import { FALLBACK, KIND_TEXT, notificationFromPush, shouldNavigate, workerLocale } from "./payload";

const push = (data: unknown) => JSON.stringify(data);

describe("notificationFromPush", () => {
  describe.each(["bill_due_today", "bill_due_soon", "bill_overdue"] as const)("%s", (kind) => {
    it.each(["pt-BR", "en"] as const)("is worded for %s and opens Bills to pay", (locale) => {
      expect(notificationFromPush(push({ kind, title: "server text" }), locale)).toEqual({ ...KIND_TEXT[kind][locale], url: "/bills" });
    });
  });

  it("uses the payload's same-origin path", () => {
    expect(notificationFromPush(push({ kind: "bill_overdue", url: "/bills?x=1" }), "en").url).toBe("/bills?x=1");
  });

  it.each([["a full URL", "https://evil.test/"], ["a protocol-relative URL", "//evil.test"], ["a number", 7], ["empty", ""]])(
    "sends %s to Bills to pay",
    (_name, url) => {
      expect(notificationFromPush(push({ kind: "bill_due_today", url }), "en").url).toBe("/bills");
    },
  );

  it.each(["checkin_reminder", "day_plan_ready", "other"])("shows the neutral Revenue notification for the kind %s", (kind) => {
    expect(notificationFromPush(push({ kind, title: "Homeowner", body: "x", url: "/chores" }), "en")).toEqual({ ...FALLBACK.en, url: "/" });
  });

  it.each([null, "", "not json", "42", "null", push({ title: "no kind" })])("never fails on %j", (text) => {
    expect(notificationFromPush(text, "pt-BR")).toEqual({ ...FALLBACK["pt-BR"], url: "/" });
  });

  it("defaults to pt-BR", () => {
    expect(notificationFromPush(null).title).toBe(FALLBACK["pt-BR"].title);
  });

  it("names Revenue, never Homeowner", () => {
    expect(JSON.stringify([KIND_TEXT, FALLBACK])).not.toMatch(/homeowner/i);
  });
});

describe("workerLocale", () => {
  it("picks English only when the device prefers it", () => {
    expect(workerLocale(["en-GB", "pt-BR"])).toBe("en");
    expect(workerLocale(["pt-BR", "en"])).toBe("pt-BR");
    expect(workerLocale([])).toBe("pt-BR");
  });
});

describe("shouldNavigate", () => {
  const origin = "https://rev.test";
  it("navigates a window on another page, not one already there", () => {
    expect(shouldNavigate("https://rev.test/", "/bills", origin)).toBe(true);
    expect(shouldNavigate("https://rev.test/bills#top", "/bills", origin)).toBe(false);
  });
  it("never navigates across origins or on unreadable URLs", () => {
    expect(shouldNavigate("https://other.test/", "/bills", origin)).toBe(false);
    expect(shouldNavigate("not a url", "/bills", origin)).toBe(false);
  });
});
