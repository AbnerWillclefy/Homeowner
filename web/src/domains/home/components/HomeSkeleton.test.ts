import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TodaySkeleton } from "./HomeSkeleton";

const render = () => renderToStaticMarkup(createElement(TodaySkeleton));

describe("TodaySkeleton", () => {
  it("holds no block for a Replan control", () => {
    expect(render()).not.toContain('data-skeleton="replan"');
  });

  it("is the header, one summary line and the Task cards, with no Check-in card or folded explanation", () => {
    const markup = render();
    expect(markup.match(/data-skeleton="summary"/g)).toHaveLength(1);
    expect(markup).not.toContain('data-skeleton="explanation"');
    expect(markup.match(/data-skeleton="task"/g)).toHaveLength(3);
    expect(markup.indexOf("data-skeleton=\"summary\"")).toBeLessThan(markup.indexOf('data-skeleton="task"'));
  });

  it("draws the page header once, with no line under the title", () => {
    const markup = render();
    expect(markup.match(/h-8 w-2\/3/g)).toHaveLength(1);
    expect(markup.match(/h-5 w-1\/3/g)).toBeNull();
    expect(markup).toContain('data-testid="day-plan-skeleton"');
  });

  it("reserves space with rem-based parts, never fixed pixel heights", () => {
    expect(render()).not.toMatch(/\d\s*px/);
  });

  it("is hidden from screen readers", () => {
    expect(render()).toMatch(/^<div[^>]*aria-hidden="true"/);
  });
});
