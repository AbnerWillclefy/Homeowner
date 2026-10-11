import { describe, expect, it } from "vitest";
import { FALLBACK } from "../i18n/fallback";
import { LOCALES } from "../i18n/locales";
import { notificationFromPush } from "./payload";

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

  it("only accepts same-origin paths as the url", () => {
    const n = notificationFromPush(JSON.stringify({ title: "Hi", url: "https://evil.example/" }));
    expect(n.url).toBe("/");
    expect(notificationFromPush(JSON.stringify({ title: "Hi", url: "//evil.example" })).url).toBe("/");
  });
});
