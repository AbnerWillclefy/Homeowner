import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./HealthBanner", () => ({ HealthBanner: () => null }));
const { PageFrame } = await import("./PageFrame");

const frame = (top?: ReactNode) =>
  renderToStaticMarkup(createElement(PageFrame, { top, children: createElement("h2", null, "Sign in") }));
const count = (markup: string, tag: string) => (markup.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;

describe("PageFrame", () => {
  it("shows the logo alone by default, as the page's one h1 named homeowner", () => {
    const markup = frame();
    expect(count(markup, "h1")).toBe(1);
    expect(/<h1[^>]*>.*?<\/h1>/s.exec(markup)![0].replace(/<svg.*?<\/svg>/s, "").replace(/<[^>]+>/g, "")).toBe("homeowner");
  });

  it("no longer shows the app name or the tagline", () => {
    const markup = frame();
    expect(markup).not.toContain("Homeowner");
    expect(markup).not.toContain("Manage the housework");
    expect(markup).not.toContain("Gerencie");
  });

  it("puts the given top in the logo's place, so there is still one h1", () => {
    const markup = frame(createElement("header", null, createElement("h1", null, "bar")));
    expect(count(markup, "h1")).toBe(1);
    expect(markup).toContain("bar");
    expect(markup).not.toContain("homeowner");
  });
});
