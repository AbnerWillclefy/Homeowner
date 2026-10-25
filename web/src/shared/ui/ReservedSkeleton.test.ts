import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReservedSkeleton } from "./ReservedSkeleton";

const render = (show: boolean) =>
  renderToStaticMarkup(createElement(ReservedSkeleton, { show, children: createElement("span", null, "inside") }));
const classesOf = (markup: string) => /class="([^"]*)"/.exec(markup)?.[1].split(/\s+/) ?? [];

describe("ReservedSkeleton", () => {
  it("always renders its children, so their space is held from the first frame", () => {
    expect(render(false)).toContain("inside");
    expect(render(true)).toContain("inside");
  });

  it("hides the skeleton from screen readers whether or not it shows", () => {
    expect(render(false)).toMatch(/^<div[^>]*aria-hidden="true"/);
    expect(render(true)).toMatch(/^<div[^>]*aria-hidden="true"/);
  });

  it("is invisible but keeps its box until it should show", () => {
    expect(classesOf(render(false))).toContain("invisible");
    expect(classesOf(render(true))).not.toContain("invisible");
  });
});
