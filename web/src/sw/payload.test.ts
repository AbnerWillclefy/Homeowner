import { describe, expect, it } from "vitest";
import { FALLBACK_BODY, FALLBACK_TITLE, notificationFromPush } from "./payload";

describe("notificationFromPush", () => {
  it("uses the title, body and url the server sent", () => {
    const text = JSON.stringify({ title: "Reminders are on", body: "Hello", url: "/today" });
    expect(notificationFromPush(text)).toEqual({ title: "Reminders are on", body: "Hello", url: "/today" });
  });

  it("falls back to a generic notification when the payload is empty", () => {
    expect(notificationFromPush(null)).toEqual({ title: FALLBACK_TITLE, body: FALLBACK_BODY, url: "/" });
    expect(notificationFromPush("")).toEqual({ title: FALLBACK_TITLE, body: FALLBACK_BODY, url: "/" });
  });

  it("falls back when the payload is not JSON", () => {
    expect(notificationFromPush("not json").title).toBe(FALLBACK_TITLE);
  });

  it("falls back when the JSON is not an object or has no usable title", () => {
    expect(notificationFromPush("42").title).toBe(FALLBACK_TITLE);
    expect(notificationFromPush("null").title).toBe(FALLBACK_TITLE);
    expect(notificationFromPush(JSON.stringify({ title: 7 })).title).toBe(FALLBACK_TITLE);
  });

  it("fills in missing fields individually", () => {
    expect(notificationFromPush(JSON.stringify({ title: "Hi" }))).toEqual({
      title: "Hi",
      body: "",
      url: "/",
    });
  });

  it("only accepts same-origin paths as the url", () => {
    const n = notificationFromPush(JSON.stringify({ title: "Hi", url: "https://evil.example/" }));
    expect(n.url).toBe("/");
    expect(notificationFromPush(JSON.stringify({ title: "Hi", url: "//evil.example" })).url).toBe("/");
  });
});
