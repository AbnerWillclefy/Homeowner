import { Sparkles } from "lucide-react";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionCard } from "./SectionCard";

const render = (props: Partial<ComponentProps<typeof SectionCard>> = {}) =>
  renderToStaticMarkup(createElement(SectionCard, { id: "c", icon: Sparkles, title: "Title", ...props }));

describe("SectionCard", () => {
  it("renders an h3 by default", () => {
    expect(render()).toMatch(/<h3 id="c"[^>]*>Title<\/h3>/);
  });

  it("renders an h4 with headingLevel 4, keeping the id the section is labelled by", () => {
    const html = render({ headingLevel: 4 });
    expect(html).toMatch(/<h4 id="c"[^>]*>Title<\/h4>/);
    expect(html).toContain('aria-labelledby="c"');
  });
});
