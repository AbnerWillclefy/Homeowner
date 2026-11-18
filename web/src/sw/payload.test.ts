import { describe, expect, it } from "vitest";
import { FALLBACK, KIND_TEXT } from "../shared/i18n/fallback";
import { LOCALES } from "../shared/i18n/locales";
import { notificationFromPush, shouldNavigate } from "./payload";

const unusable: [string, string | null][] = [
  ["no payload", null],
  ["an empty payload", ""],
  ["text that is not JSON", "not json"],
  ["a JSON number", "42"],
  ["JSON null", "null"],
  ["an empty title", JSON.stringify({ title: "" })],
  ["a non-string title", JSON.stringify({ title: 7 })],
  ["no title", JSON.stringify({ body: "x" })],
];

describe("shouldNavigate", () => {
  const origin = "https://app.test";

  it("navigates a window left on another tab to Today", () => {
    expect(shouldNavigate("https://app.test/me", "/", origin)).toBe(true);
    expect(shouldNavigate("https://app.test/chores?x=1", "/", origin)).toBe(true);
  });

  it("leaves a window already on the target alone", () => {
    expect(shouldNavigate("https://app.test/", "/", origin)).toBe(false);
    expect(shouldNavigate("https://app.test/#top", "/", origin)).toBe(false);
  });

  it("never navigates to another origin or on unreadable URLs", () => {
    expect(shouldNavigate("https://other.test/me", "/", origin)).toBe(false);
    expect(shouldNavigate("not a url", "/", origin)).toBe(false);
    expect(shouldNavigate("https://app.test/me", "/", "not an origin")).toBe(false);
  });
});

describe("notificationFromPush", () => {
  describe.each(LOCALES)("fallback in %s", (locale) => {
    it.each(unusable)("is shown for %s", (_name, text) => {
      expect(notificationFromPush(text, locale)).toEqual({ ...FALLBACK[locale], url: "/" });
    });
  });

  it("differs between pt-BR and en-US", () => {
    expect(notificationFromPush(null, "pt-BR").body).not.toBe(notificationFromPush(null, "en-US").body);
  });

  it("uses en-US when no locale is given", () => {
    expect(notificationFromPush(null)).toEqual({ ...FALLBACK["en-US"], url: "/" });
  });

  it("drops a valid body when the title is empty", () => {
    const text = JSON.stringify({ title: "", body: "Server body", url: "/today" });
    expect(notificationFromPush(text, "pt-BR")).toEqual({ ...FALLBACK["pt-BR"], url: "/" });
  });

  it.each(LOCALES)("shows a valid payload exactly as sent in %s", (locale) => {
    const sent = { title: "Reminders are on", body: "Hello", url: "/today" };
    expect(notificationFromPush(JSON.stringify(sent), locale)).toEqual(sent);
    const pt = { title: "Lembretes ativados", body: "Olá", url: "/hoje" };
    expect(notificationFromPush(JSON.stringify(pt), locale)).toEqual(pt);
  });

  it("fills in missing fields individually", () => {
    expect(notificationFromPush(JSON.stringify({ title: "Hi" }))).toEqual({ title: "Hi", body: "", url: "/" });
  });

  describe.each(LOCALES)("a known kind in %s", (locale) => {
    it.each(["checkin_reminder", "day_plan_ready"] as const)("shows the device-language text for %s", (kind) => {
      const text = JSON.stringify({ kind, title: "Server title", body: "Server body", url: "/" });
      expect(notificationFromPush(text, locale)).toEqual({ ...KIND_TEXT[kind][locale], url: "/" });
    });

    it("still shows the kind text when the server sent no title", () => {
      const text = JSON.stringify({ kind: "day_plan_ready" });
      expect(notificationFromPush(text, locale)).toEqual({ ...KIND_TEXT.day_plan_ready[locale], url: "/" });
    });
  });

  it("words the two kinds differently per language", () => {
    const reminder = JSON.stringify({ kind: "checkin_reminder", title: "x" });
    expect(notificationFromPush(reminder, "pt-BR").title).not.toBe(notificationFromPush(reminder, "en-US").title);
    expect(notificationFromPush(reminder, "en-US").title).not.toBe(
      notificationFromPush(JSON.stringify({ kind: "day_plan_ready", title: "x" }), "en-US").title,
    );
  });

  it("keeps the same-origin rule for a known kind", () => {
    const text = JSON.stringify({ kind: "checkin_reminder", url: "https://evil.example/" });
    expect(notificationFromPush(text, "en-US").url).toBe("/");
  });

  it.each([
    ["an unknown kind", { kind: "something_new", title: "Hi", body: "B" }],
    ["a non-string kind", { kind: 3, title: "Hi", body: "B" }],
  ])("passes %s through", (_name, sent) => {
    expect(notificationFromPush(JSON.stringify(sent), "pt-BR")).toEqual({ title: "Hi", body: "B", url: "/" });
  });

  it("falls back for an unknown kind without a title", () => {
    expect(notificationFromPush(JSON.stringify({ kind: "something_new" }), "en-US")).toEqual({
      ...FALLBACK["en-US"],
      url: "/",
    });
  });

  it("only accepts same-origin paths as the url", () => {
    const n = notificationFromPush(JSON.stringify({ title: "Hi", url: "https://evil.example/" }));
    expect(n.url).toBe("/");
    expect(notificationFromPush(JSON.stringify({ title: "Hi", url: "//evil.example" })).url).toBe("/");
  });
});
