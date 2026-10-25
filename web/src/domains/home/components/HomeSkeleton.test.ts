import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TodaySkeleton } from "./HomeSkeleton";

const render = (replan: boolean) => renderToStaticMarkup(createElement(TodaySkeleton, { replan }));

describe("TodaySkeleton", () => {
  it("holds a block for the Replan control only when Replan is enabled", () => {
    expect(render(true)).toContain('data-skeleton="replan"');
    expect(render(false)).not.toContain('data-skeleton="replan"');
  });

  it("is the same page otherwise: the header, the Check-in, the explanation card and the Task cards", () => {
    const without = render(false);
    const withReplan = render(true);
    for (const markup of [without, withReplan]) {
      expect(markup).toContain('data-skeleton="explanation"');
      expect(markup.match(/data-skeleton="task"/g)).toHaveLength(3);
    }
    expect(withReplan.replace(/<div data-skeleton="replan".*?<\/p><\/div>/, "")).toBe(without);
  });

  it("reserves space with rem-based parts, never fixed pixel heights", () => {
    expect(render(true)).not.toMatch(/\d\s*px/);
  });

  it("is hidden from screen readers", () => {
    expect(render(false)).toMatch(/^<div[^>]*aria-hidden="true"/);
  });
});
