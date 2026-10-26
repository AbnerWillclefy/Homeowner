import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Logo } from "./Logo";

const html = (props: Parameters<typeof Logo>[0] = {}) => renderToStaticMarkup(createElement(Logo, props));

describe("Logo", () => {
  it("is an h1 by default, and its text is the wordmark", () => {
    expect(html()).toMatch(/^<h1[ >]/);
    expect(html().replace(/<svg.*?<\/svg>/s, "").replace(/<[^>]+>/g, "")).toBe("homeowner");
  });

  it("can be a plain element, for a place that is not the page's heading", () => {
    expect(html({ as: "span" })).toMatch(/^<span[ >]/);
    expect(html({ as: "span" })).not.toContain("<h1");
  });

  it("names itself by its text alone, so no aria-label can differ from it", () => {
    expect(html()).not.toContain("aria-label");
  });

  it("hides the drawing from assistive technology", () => {
    expect(html()).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("draws the house in the text colour and the check in the accent token", () => {
    const svg = /<svg.*<\/svg>/s.exec(html())![0];
    expect(svg).toContain("currentColor");
    expect(svg).toContain("text-accent");
  });

  it("falls back to the system text colour in forced-colors mode, so it never vanishes", () => {
    expect(html()).toContain("forced-colors:text-[CanvasText]");
  });

  it("sets the wordmark in the extra-bold weight (Nunito 800)", () => {
    expect(html()).toContain("font-extrabold");
  });
});
