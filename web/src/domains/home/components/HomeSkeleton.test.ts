import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TodaySkeleton } from "./HomeSkeleton";

const render = () => renderToStaticMarkup(createElement(TodaySkeleton));

describe("TodaySkeleton", () => {
  it("holds no block for a Replan control", () => {
    expect(render()).not.toContain('data-skeleton="replan"');
  });

  it("is the header, the Check-in, the explanation card and the Task cards", () => {
    const markup = render();
    expect(markup).toContain('data-skeleton="explanation"');
    expect(markup.match(/data-skeleton="task"/g)).toHaveLength(3);
  });

  it("reserves space with rem-based parts, never fixed pixel heights", () => {
    expect(render()).not.toMatch(/\d\s*px/);
  });

  it("is hidden from screen readers", () => {
    expect(render()).toMatch(/^<div[^>]*aria-hidden="true"/);
  });
});
