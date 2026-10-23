import { Sparkles } from "lucide-react";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CollapsibleCard } from "./CollapsibleCard";

function render(props: Partial<ComponentProps<typeof CollapsibleCard>> = {}): string {
  return renderToStaticMarkup(
    createElement(CollapsibleCard, { id: "c", icon: Sparkles, title: "Title", ...props }, createElement("p", null, "Body")),
  );
}

describe("CollapsibleCard", () => {
  it("is closed by default: aria-expanded false, body present but hidden", () => {
    const html = render();
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/<div id="c-body" hidden=""/);
    expect(html).toContain("<p>Body</p>");
    expect(html).not.toContain("rotate-180");
  });

  it("is open with defaultOpen: aria-expanded true, no hidden body, chevron turned", () => {
    const html = render({ defaultOpen: true });
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toMatch(/<div id="c-body" hidden/);
    expect(html).toContain("rotate-180");
  });

  it("without iconLabel or hint has no description and an h3", () => {
    const html = render();
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("c-icon");
    expect(html).toContain('<h3 id="c"');
  });

  it("describes the button with a hidden span outside the heading when iconLabel is set", () => {
    const html = render({ iconLabel: "Written by the assistant" });
    expect(html).toContain('aria-describedby="c-icon"');
    expect(html).toContain('<span id="c-icon" hidden="">Written by the assistant</span>');
    expect(html.indexOf("</h3>")).toBeLessThan(html.indexOf('id="c-icon"'));
  });

  it("lists the hint id first, then the icon id", () => {
    expect(render({ hint: "Hint", iconLabel: "Label" })).toContain('aria-describedby="c-hint c-icon"');
  });

  it("renders an h4 with headingLevel 4", () => {
    const html = render({ headingLevel: 4 });
    expect(html).toContain('<h4 id="c"');
    expect(html).not.toContain("<h3");
  });
});
