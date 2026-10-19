import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SkeletonBar, SkeletonCard, SkeletonPill, SkeletonTile } from "./Skeleton";

const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
const classesOf = (markup: string) => /class="([^"]*)"/.exec(markup)?.[1].split(/\s+/) ?? [];

describe("Skeleton", () => {
  it("hides a bar from screen readers", () => {
    expect(render(createElement(SkeletonBar))).toMatch(/aria-hidden="true"/);
  });

  it("hides a card, and so everything in it, from screen readers", () => {
    expect(render(createElement(SkeletonCard, null, createElement(SkeletonBar)))).toMatch(/^<div[^>]*aria-hidden="true"/);
  });

  it("hides a pill from screen readers", () => {
    expect(render(createElement(SkeletonPill))).toMatch(/aria-hidden="true"/);
  });

  it("hides a tile from screen readers and pulses it only when motion is allowed", () => {
    const markup = render(createElement(SkeletonTile));
    expect(markup).toMatch(/aria-hidden="true"/);
    expect(classesOf(markup)).toContain("motion-safe:animate-pulse");
  });

  it("fills a bar with the muted token at low opacity, not a palette colour", () => {
    expect(classesOf(render(createElement(SkeletonBar)))).toContain("bg-muted/20");
  });

  it("pulses only when motion is allowed", () => {
    const classes = [SkeletonBar, SkeletonPill].flatMap((part) => classesOf(render(createElement(part))));
    expect(classes).toContain("motion-safe:animate-pulse");
    expect(classes).not.toContain("animate-pulse");
  });

  it("takes the size from the class it is given", () => {
    expect(classesOf(render(createElement(SkeletonBar, { className: "h-4 w-1/2" })))).toEqual(
      expect.arrayContaining(["h-4", "w-1/2"]),
    );
  });
});
